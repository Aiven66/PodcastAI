import { NextRequest, NextResponse } from 'next/server';
import { mapBlogRow, generateBlogSlug, requireBlogAuthor, fetchBlogRow, summarizeHtml } from '@/lib/blog-server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { BlogPost } from '@packages/core/types';

/**
 * /api/blog/posts — 博客列表 / 创建 / 更新。
 *
 * 契约来源：packages/blog/client.ts
 *   GET   ?page&pageSize&category&locale → { posts: BlogPost[], total, page, pageSize }
 *   POST  CreateBlogPostInput + Bearer   → { posts: BlogPost[] }（英文根帖）
 *   PATCH UpdateBlogPostInput + Bearer   → { post: BlogPost }
 *
 * 字段适配（src/lib/blog-server.ts）：cover_image_url→coverImage、
 * is_published→isPublished、view_count→viewCount、language→locale、
 * author_id→authorId；slug 自动生成（blogs.slug NOT NULL UNIQUE）。
 */

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));
    const category = url.searchParams.get('category') || undefined;
    const locale = url.searchParams.get('locale') || undefined;

    const client = getSupabaseClient();

    let query = client
      .from('blogs')
      .select('*', { count: 'exact' })
      .eq('is_published', true);
    if (category) query = query.eq('category', category);
    if (locale) query = query.eq('language', locale);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw new Error(error.message);

    const posts: BlogPost[] = (data || []).map((row: Record<string, unknown>) => mapBlogRow(row));
    return NextResponse.json({ posts, total: count || 0, page, pageSize });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list blog posts' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      title?: unknown;
      category?: unknown;
      content?: unknown;
      coverImage?: unknown;
      publish?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content : '';
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    if (!guard.author.userId) {
      return NextResponse.json({ error: 'Unauthorized: author profile not found' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { data, error } = await guard.author.client
      .from('blogs')
      .insert({
        author_id: guard.author.userId,
        title,
        slug: generateBlogSlug(title),
        category: typeof body.category === 'string' && body.category.trim()
          ? body.category.trim()
          : 'General',
        summary: summarizeHtml(content) || null,
        content,
        cover_image_url: typeof body.coverImage === 'string' ? body.coverImage : null,
        is_published: body.publish === undefined ? true : Boolean(body.publish),
        language: 'en',
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const post = mapBlogRow(data as Record<string, unknown>);
    return NextResponse.json({ posts: [post] }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create blog post' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      id?: unknown;
      title?: unknown;
      category?: unknown;
      content?: unknown;
      coverImage?: unknown;
      publish?: unknown;
    };

    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Post id is required' }, { status: 400 });

    const row = await fetchBlogRow(guard.author.client, id);
    if (!row) return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });

    const authorId = (row.author_id as string) || '';
    if (!guard.author.isAdmin && guard.author.userId !== authorId) {
      return NextResponse.json({ error: 'Forbidden: not the post author' }, { status: 403 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.category === 'string' && body.category.trim()) patch.category = body.category.trim();
    if (typeof body.content === 'string') {
      patch.content = body.content;
      patch.summary = summarizeHtml(body.content) || null;
    }
    if (typeof body.coverImage === 'string') patch.cover_image_url = body.coverImage;
    if (body.publish !== undefined) patch.is_published = Boolean(body.publish);

    const { data, error } = await guard.author.client
      .from('blogs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ post: mapBlogRow(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update blog post' },
      { status: 500 },
    );
  }
}
