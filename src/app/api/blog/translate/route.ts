import { NextRequest, NextResponse } from 'next/server';
import { translateBlogPostToAllLocales } from '@packages/blog/translate';
import {
  requireBlogAuthor,
  fetchBlogRow,
  upsertBlogTranslation,
  buildConfigAfterEnvLoad,
} from '@/lib/blog-server';

/**
 * POST /api/blog/translate — 服务端批量翻译根帖。
 *
 * 契约来源：packages/blog/client.ts translateBlogPost
 *   POST { sourcePostId, authorId? } + Bearer →
 *   { total, successCount, failCount, results: [{ locale, success, error? }] }
 *
 * 翻译能力来自 packages/blog/translate.ts（MyMemory 免费翻译 API，
 * 品牌词保护 + HTML 结构保留），目标语言来自 config.blogTranslationLocales。
 * 翻译结果通过 upsertBlogTranslation 持久化（tags JSONB 存 parent_id）。
 */
export async function POST(request: NextRequest) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as { sourcePostId?: unknown; authorId?: unknown };
    const sourcePostId = typeof body.sourcePostId === 'string' ? body.sourcePostId : '';
    const bodyAuthorId = typeof body.authorId === 'string' ? body.authorId : '';

    if (!sourcePostId) {
      return NextResponse.json({ error: 'sourcePostId is required' }, { status: 400 });
    }

    const root = await fetchBlogRow(guard.author.client, sourcePostId);
    if (!root) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const authorId = (root.author_id as string) || '';
    if (!guard.author.isAdmin && guard.author.userId !== authorId) {
      return NextResponse.json({ error: 'Forbidden: not the post author' }, { status: 403 });
    }

    const config = buildConfigAfterEnvLoad();
    const sourceLocale = String(root.language || 'en');
    const title = String(root.title || '');
    const category = String(root.category || '');
    const content = String(root.content || '');

    const translationResults = await translateBlogPostToAllLocales(
      config,
      { title, category, content },
      sourceLocale,
    );

    const results: Array<{ locale: string; success: boolean; error?: string }> = [];
    let successCount = 0;

    for (const result of translationResults) {
      if (!result.success) {
        results.push({ locale: result.locale, success: false, error: result.error });
        continue;
      }
      try {
        await upsertBlogTranslation(
          guard.author.client,
          sourcePostId,
          {
            locale: result.locale,
            title: result.title,
            category: result.category,
            content: result.content,
          },
          guard.author.userId || bodyAuthorId || authorId,
        );
        results.push({ locale: result.locale, success: true });
        successCount++;
      } catch (err) {
        results.push({
          locale: result.locale,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save translation',
        });
      }
    }

    return NextResponse.json({
      total: results.length,
      successCount,
      failCount: results.length - successCount,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to translate blog post' },
      { status: 500 },
    );
  }
}
