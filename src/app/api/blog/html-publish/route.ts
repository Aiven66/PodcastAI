import { NextRequest, NextResponse } from 'next/server';
import { sanitizeHtmlContent } from '@packages/blog/sanitize';
import {
  mapBlogRow,
  generateBlogSlug,
  requireBlogAuthor,
  uploadBlogAsset,
  fileToDataUrl,
  summarizeHtml,
} from '@/lib/blog-server';

/**
 * POST /api/blog/html-publish — 发布完整 HTML 文章（multipart/form-data）。
 *
 * 契约来源：packages/blog/client.ts publishHtmlBlog
 *   formData：title / category / htmlFile（UTF-8 HTML File）/
 *             coverFile?（封面图）/ img_*?（HTML 引用的附加图片）
 *   + Bearer → { posts: BlogPost[] }（或 { post }），失败 { error }。
 *
 * 处理：HTML 经 sanitizeHtmlContent 清理（packages/blog/sanitize.ts）；
 * img_* 上传到 blog-images 后替换 HTML 中按文件名引用的 src；
 * cover 上传失败时回退 base64 data URL。
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(request: NextRequest) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const category = String(form.get('category') || '').trim() || 'General';
    const htmlFile = form.get('htmlFile');
    const coverFile = form.get('coverFile');

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!(htmlFile instanceof File)) {
      return NextResponse.json({ error: 'htmlFile is required' }, { status: 400 });
    }
    if (!guard.author.userId) {
      return NextResponse.json({ error: 'Unauthorized: author profile not found' }, { status: 401 });
    }

    let html = sanitizeHtmlContent(await htmlFile.text());

    // 上传 HTML 引用的附加图片（img_*），并替换对应 src 引用。
    const imageFiles: File[] = [];
    for (const [key, value] of form.entries()) {
      if (key.startsWith('img_') && value instanceof File) imageFiles.push(value);
    }
    for (const file of imageFiles) {
      const uploaded = await uploadBlogAsset(guard.author.client, file, 'posts');
      const url = uploaded.url || (await fileToDataUrl(file));
      if (!url) continue;
      // 匹配原名与 URL 编码名（src="my image.png" / src="my%20image.png"）。
      for (const name of [file.name, encodeURIComponent(file.name)]) {
        const pattern = new RegExp(
          `(src\\s*=\\s*)(["'])[^"']*${escapeRegExp(name)}[^"']*\\2`,
          'gi',
        );
        html = html.replace(pattern, (_m, p1: string, p2: string) => `${p1}${p2}${url}${p2}`);
      }
    }

    // 封面：上传 storage，失败回退 data URL。
    let coverUrl: string | null = null;
    if (coverFile instanceof File) {
      const uploaded = await uploadBlogAsset(guard.author.client, coverFile, 'covers');
      coverUrl = uploaded.url || (await fileToDataUrl(coverFile));
    }

    const now = new Date().toISOString();
    const { data, error } = await guard.author.client
      .from('blogs')
      .insert({
        author_id: guard.author.userId,
        title,
        slug: generateBlogSlug(title),
        category,
        summary: summarizeHtml(html) || null,
        content: html,
        cover_image_url: coverUrl,
        is_published: true,
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
      { error: err instanceof Error ? err.message : 'Failed to publish HTML blog' },
      { status: 500 },
    );
  }
}
