import { NextRequest, NextResponse } from 'next/server';
import {
  mapBlogRow,
  requireBlogAuthor,
  fetchBlogRow,
  fetchTranslations,
  upsertBlogTranslation,
  checkBlogAdmin,
} from '@/lib/blog-server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * /api/blog/posts/[id] — 博客详情 / 翻译保存。
 *
 * 契约来源：packages/blog/client.ts
 *   GET   （可选 Bearer）→ { post: BlogPost, translations: BlogPost[], isAdmin?: boolean }
 *   PATCH SaveTranslationInput + Bearer → { translation: BlogPost }
 *
 * 字段适配：翻译行的 parentId 存于 tags JSONB（{ parent_id }），
 * 详情据此返回根帖 + 全部语言翻译。
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Blog id is required' }, { status: 400 });

    const client = getSupabaseClient();
    const row = await fetchBlogRow(client, id);
    if (!row) return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });

    const isPublished = row.is_published == null ? true : Boolean(row.is_published);
    const isAdmin = await checkBlogAdmin(request);
    if (!isPublished && !isAdmin) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const post = mapBlogRow(row);
    // 仅根帖携带翻译列表；翻译行自身的 translations 为空数组。
    const translations = post.parentId ? [] : await fetchTranslations(client, id);

    return NextResponse.json({ post, translations, isAdmin });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch blog post' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const { id: rootId } = await params;
    if (!rootId) return NextResponse.json({ error: 'Root post id is required' }, { status: 400 });

    const body = (await request.json()) as {
      locale?: unknown;
      title?: unknown;
      category?: unknown;
      content?: unknown;
      coverImage?: unknown;
      publish?: unknown;
    };

    const locale = typeof body.locale === 'string' ? body.locale.trim() : '';
    if (!locale) {
      return NextResponse.json({ error: 'Translation locale is required' }, { status: 400 });
    }

    const root = await fetchBlogRow(guard.author.client, rootId);
    if (!root) return NextResponse.json({ error: 'Root post not found' }, { status: 404 });

    const authorId = (root.author_id as string) || '';
    if (!guard.author.isAdmin && guard.author.userId !== authorId) {
      return NextResponse.json({ error: 'Forbidden: not the post author' }, { status: 403 });
    }

    const translation = await upsertBlogTranslation(
      guard.author.client,
      rootId,
      {
        locale,
        title: typeof body.title === 'string' ? body.title : undefined,
        category: typeof body.category === 'string' ? body.category : undefined,
        content: typeof body.content === 'string' ? body.content : undefined,
        coverImage: typeof body.coverImage === 'string' ? body.coverImage : undefined,
        publish: body.publish === undefined ? undefined : Boolean(body.publish),
      },
      guard.author.userId || authorId,
    );

    return NextResponse.json({ translation });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save translation' },
      { status: 500 },
    );
  }
}
