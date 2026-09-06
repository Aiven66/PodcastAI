/**
 * @clipop/blog 服务端适配层（route.ts 专用）。
 *
 * packages/blog/client.ts 只定义 API 契约（host app 负责把调用翻译成 Supabase
 * 查询）。本文件把 BlogPost 契约字段映射到项目 blogs 表实际列（见
 * supabase/migrations/0001_init.sql）：
 *   - cover_image_url → coverImage；is_published → isPublished；
 *     view_count → viewCount；language → locale；author_id → authorId。
 *   - blogs 无 parent_id 列（packages 翻译模型需要）：翻译行的 parentId 存于
 *     tags JSONB（{ parent_id }），列表/详情据此区分根帖与翻译。
 *   - slug 为 NOT NULL UNIQUE，插入时自动生成。
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlogPost } from '@packages/core/types';
import { decodeJwt, randomId, safeFilename } from '@packages/core/utils';
import { extractBearerToken, isAdminFromToken } from '@packages/admin/server/verify';
import type { SaveTranslationInput } from '@packages/blog/client';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { buildServerConfig } from './server-config';

/** 触发项目 env 加载链（dotenv / coze-workload-identity）后再读配置。 */
export function buildConfigAfterEnvLoad() {
  try {
    getSupabaseClient();
  } catch {
    // Supabase 未配置（demo 模式），忽略
  }
  return buildServerConfig();
}

// ── 行映射 ────────────────────────────────────────────────────

export function mapBlogRow(row: Record<string, unknown>): BlogPost {
  const tags =
    row.tags && typeof row.tags === 'object' && !Array.isArray(row.tags)
      ? (row.tags as Record<string, unknown>)
      : null;
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    category: String(row.category || ''),
    content: String(row.content || ''),
    coverImage: (row.cover_image_url as string) || null,
    authorId: (row.author_id as string) || null,
    isPublished: row.is_published == null ? true : Boolean(row.is_published),
    viewCount: Number(row.view_count) || 0,
    locale: String(row.language || 'en'),
    parentId: (tags?.parent_id as string) || null,
    createdAt: String(row.created_at || ''),
    updatedAt: (row.updated_at as string) || undefined,
  };
}

/** 生成唯一 slug（blogs.slug NOT NULL UNIQUE）。 */
export function generateBlogSlug(title: string, suffix?: string): string {
  const base = (title || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'post';
  return `${base}-${suffix || randomId(8)}`;
}

// ── 鉴权（管理员或登录用户） ──────────────────────────────────

export interface BlogAuthor {
  userId: string;
  email: string;
  isAdmin: boolean;
  client: SupabaseClient;
}

export type BlogAuthorGuard =
  | { ok: true; author: BlogAuthor }
  | { ok: false; response: NextResponse };

/**
 * 校验 Authorization: Bearer <token>：
 *   1. 真实 Supabase JWT → auth.getUser 验证；
 *   2. demo token（auth-context 生成的未签名 JWT）→ 解码后按 profiles 邮箱核对。
 * 返回作者 id / email 与 service-role client。
 */
export async function requireBlogAuthor(request: NextRequest): Promise<BlogAuthorGuard> {
  const config = buildConfigAfterEnvLoad();
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: missing bearer token' }, { status: 401 }) };
  }

  // 1. 真实 Supabase JWT。
  try {
    const authClient = getSupabaseClient(token);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data.user) {
      const verify = await isAdminFromToken(config, token);
      return {
        ok: true,
        author: {
          userId: data.user.id,
          email: data.user.email || '',
          isAdmin: verify.isAdmin,
          client: getSupabaseClient(),
        },
      };
    }
  } catch {
    // Supabase 未配置或网络错误 → 走 demo 兜底。
  }

  // 2. Demo token 兜底：解码 JWT 后按邮箱核对 profiles。
  try {
    const payload = decodeJwt<{ sub?: string; email?: string; role?: string }>(token);
    const email = (payload?.email || '').trim().toLowerCase();
    if (!email) {
      return { ok: false, response: NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 }) };
    }
    const client = getSupabaseClient();
    const { data } = await client.from('profiles').select('user_id, email, role').eq('email', email).limit(1);
    const row = (data?.[0] || null) as Record<string, unknown> | null;
    if (!row) {
      return { ok: false, response: NextResponse.json({ error: 'Unauthorized: user not found' }, { status: 401 }) };
    }
    const verify = await isAdminFromToken(config, token);
    return {
      ok: true,
      author: {
        userId: String(row.user_id || payload?.sub || ''),
        email,
        isAdmin: verify.isAdmin,
        client,
      },
    };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: authentication failed' }, { status: 401 }) };
  }
}

/** 无鉴权场景下（GET 详情的 isAdmin 判断）验证 token 是否管理员。 */
export async function checkBlogAdmin(request: NextRequest): Promise<boolean> {
  const config = buildConfigAfterEnvLoad();
  const token = extractBearerToken(request);
  if (!token) return false;
  try {
    const result = await isAdminFromToken(config, token);
    return result.isAdmin;
  } catch {
    return false;
  }
}

// ── 存取 ──────────────────────────────────────────────────────

/** 查单行博客（service-role client，绕过 RLS）。 */
export async function fetchBlogRow(
  client: SupabaseClient,
  id: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client.from('blogs').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to fetch blog: ${error.message}`);
  return (data || null) as Record<string, unknown> | null;
}

/** 翻译行查询：tags JSONB 包含 { parent_id: rootId }。 */
export async function fetchTranslations(
  client: SupabaseClient,
  rootId: string,
): Promise<BlogPost[]> {
  const { data, error } = await client
    .from('blogs')
    .select('*')
    .contains('tags', { parent_id: rootId })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to fetch translations: ${error.message}`);
  return (data || []).map((row: Record<string, unknown>) => mapBlogRow(row));
}

/** 保存（创建或更新）某语言翻译行，返回翻译后的 BlogPost。 */
export async function upsertBlogTranslation(
  client: SupabaseClient,
  rootId: string,
  payload: SaveTranslationInput,
  authorId: string,
): Promise<BlogPost> {
  const { locale, title, category, content, coverImage, publish } = payload;

  const { data: existing, error: findError } = await client
    .from('blogs')
    .select('*')
    .contains('tags', { parent_id: rootId })
    .eq('language', locale)
    .maybeSingle();
  if (findError) throw new Error(`Failed to find translation: ${findError.message}`);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (category !== undefined) patch.category = category;
  if (content !== undefined) patch.content = content;
  if (coverImage !== undefined) patch.cover_image_url = coverImage;
  if (publish !== undefined) patch.is_published = publish;

  if (existing) {
    const row = existing as Record<string, unknown>;
    const { data: updated, error } = await client
      .from('blogs')
      .update(patch)
      .eq('id', String(row.id))
      .select('*')
      .single();
    if (error) throw new Error(`Failed to update translation: ${error.message}`);
    return mapBlogRow(updated as Record<string, unknown>);
  }

  const root = await fetchBlogRow(client, rootId);
  if (!root) throw new Error('Root post not found');

  const { data: inserted, error } = await client
    .from('blogs')
    .insert({
      author_id: authorId || (root.author_id as string) || null,
      title: title ?? String(root.title || ''),
      slug: generateBlogSlug(String(title ?? root.title ?? 'post'), `${locale}-${randomId(6)}`),
      category: category ?? String(root.category || 'General'),
      summary: (root.summary as string) || null,
      content: content ?? String(root.content || ''),
      cover_image_url: coverImage ?? ((root.cover_image_url as string) || null),
      is_published: publish ?? true,
      language: locale,
      tags: { parent_id: rootId },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create translation: ${error.message}`);
  return mapBlogRow(inserted as Record<string, unknown>);
}

// ── 封面 / 图片资产 ───────────────────────────────────────────

/** 上传文件到 blog-images bucket，成功返回公共 URL 与 storage 路径。 */
export async function uploadBlogAsset(
  client: SupabaseClient,
  file: File,
  prefix: string,
): Promise<{ url: string | null; path: string | null }> {
  try {
    const path = `${prefix}/${Date.now()}-${randomId(6)}-${safeFilename(file.name)}`;
    const { data, error } = await client.storage.from('blog-images').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
    if (error || !data) return { url: null, path: null };
    const { data: pub } = client.storage.from('blog-images').getPublicUrl(path);
    return { url: pub?.publicUrl || null, path };
  } catch {
    return { url: null, path: null };
  }
}

/** 文件转 data URL（storage 不可用时的 base64 回退）。 */
export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** 纯文本摘要（blogs.summary 列）。 */
export function summarizeHtml(html: string, maxLen = 200): string {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLen);
}
