import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

/**
 * 桌面客户端认证回调 API
 *
 * GET/POST：接收桌面客户端回传的 { token, verifier }
 *   - 验证 token 有效性（demo token 解析 JWT；Supabase token 通过 getUser 校验）
 *   - 返回用户信息 { user, token }
 */

interface DesktopUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
}

interface DesktopCallbackBody {
  token?: string;
  verifier?: string;
}

interface DesktopCallbackQuery {
  token?: string;
  verifier?: string;
}

function parseQueryParams(request: NextRequest): DesktopCallbackQuery {
  const url = new URL(request.url);
  return {
    token: url.searchParams.get('token') ?? undefined,
    verifier: url.searchParams.get('verifier') ?? undefined,
  };
}

function base64UrlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf-8');
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isDemoToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload?.demo === true;
}

function createUserFromDemoToken(token: string): DesktopUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  if (!sub) return null;
  const name = typeof payload.name === 'string' ? payload.name : null;
  const role = typeof payload.role === 'string' ? payload.role : 'user';
  const avatarUrl = typeof payload.avatar_url === 'string' ? payload.avatar_url : null;
  return {
    id: sub,
    email,
    name: name || email.split('@')[0] || null,
    role,
    avatarUrl,
  };
}

function isSupabaseConfigured(): boolean {
  try {
    const { url, anonKey } = getSupabaseCredentials();
    return Boolean(url && anonKey);
  } catch {
    return false;
  }
}

async function verifyToken(token: string): Promise<DesktopUser | null> {
  // 1. 优先按 demo token 处理
  if (isDemoToken(token)) {
    return createUserFromDemoToken(token);
  }

  // 2. Supabase token 校验
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;

    const authUser = data.user;
    const { data: userData } = await supabase
      .from('profiles')
      .select('id, user_id, email, name, role, avatar_url')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (userData) {
      // admin@126.com 强制为 admin 角色
      const isAdmin = authUser.email === 'admin@126.com' || userData.role === 'admin' || authUser.user_metadata?.role === 'admin';
      return {
        id: authUser.id,
        email: userData.email ?? authUser.email ?? '',
        name: userData.name ?? null,
        role: isAdmin ? 'admin' : (userData.role ?? 'user'),
        avatarUrl: userData.avatar_url ?? null,
      };
    }

    // 没有找到 profile 记录，使用 auth user 信息（admin@126.com 强制 admin 角色）
    const isAdminByEmail = authUser.email === 'admin@126.com';
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      name: authUser.user_metadata?.name ?? authUser.user_metadata?.full_name ?? null,
      role: isAdminByEmail || authUser.user_metadata?.role === 'admin' ? 'admin' : 'user',
      avatarUrl: authUser.user_metadata?.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  try {
    let token: string | undefined;
    let verifier: string | undefined;

    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as DesktopCallbackBody;
      token = body.token;
      verifier = body.verifier;
    } else {
      const query = parseQueryParams(request);
      token = query.token;
      verifier = query.verifier;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required / 缺少 token' },
        { status: 400 }
      );
    }

    // verifier 可选校验（如果传入则期望为非空字符串）
    if (verifier !== undefined && typeof verifier !== 'string') {
      return NextResponse.json(
        { error: 'Invalid verifier / verifier 无效' },
        { status: 400 }
      );
    }

    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token / token 无效或已过期' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user, token });
  } catch (error) {
    console.error('desktop-callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error / 内部错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleRequest(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleRequest(request);
}
