import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, isAdminFromToken } from '@packages/admin/server/verify';
import { buildServerConfig } from '@/lib/server-config';

/**
 * POST /api/admin/verify — 服务端管理员校验。
 *
 * 契约来源：packages/auth/admin-gate.tsx verifyAdminAccess
 *   POST + Authorization: Bearer <token> → 200 { isAdmin: boolean, reason?: string }
 *   客户端以 res.ok && data.isAdmin 判定；非管理员返回 200 + isAdmin:false。
 */
export async function POST(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: missing bearer token' }, { status: 401 });
  }

  try {
    const config = buildServerConfig();
    const result = await isAdminFromToken(config, token);
    return NextResponse.json({ isAdmin: result.isAdmin, reason: result.reason });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin verification failed' },
      { status: 500 },
    );
  }
}
