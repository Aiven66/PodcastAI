import { NextRequest, NextResponse } from 'next/server';
import { requireBlogAuthor, uploadBlogAsset, fileToDataUrl } from '@/lib/blog-server';

/**
 * POST /api/blog/upload-cover — 上传博客封面图。
 *
 * 契约来源：packages/blog/client.ts uploadBlogCover
 *   multipart/form-data（file: File）+ Bearer，或 JSON（{ file: string, fileName }）
 *   → { cover_image: string, storage: 'supabase' | 'base64', path?: string }。
 *
 * storage 上传失败时回退 base64 data URL（storage: 'base64'）。
 */

export async function POST(request: NextRequest) {
  const guard = await requireBlogAuthor(request);
  if (!guard.ok) return guard.response;

  try {
    const contentType = request.headers.get('content-type') || '';

    // JSON 分支：客户端直接提交 base64 / data URL 字符串。
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { file?: unknown; fileName?: unknown };
      const file = typeof body.file === 'string' ? body.file : '';
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }
      return NextResponse.json({ cover_image: file, storage: 'base64' });
    }

    // multipart 分支：上传 File 到 blog-images bucket。
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const uploaded = await uploadBlogAsset(guard.author.client, file, 'covers');
    if (uploaded.url) {
      return NextResponse.json({
        cover_image: uploaded.url,
        storage: 'supabase',
        path: uploaded.path || undefined,
      });
    }

    // Storage 不可用 → base64 data URL 回退。
    const dataUrl = await fileToDataUrl(file);
    return NextResponse.json({ cover_image: dataUrl, storage: 'base64' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload cover' },
      { status: 500 },
    );
  }
}
