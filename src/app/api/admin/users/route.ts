import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, listUsersAdapted } from '@/lib/admin-adapter';

/**
 * GET /api/admin/users — 用户列表。
 *
 * 契约来源：packages/admin/users-page.tsx fetchUsers
 *   GET ?page=N&limit=N&search=... + Bearer → 200
 *   { users: AdminUserRow[], total, totalPages, page }，失败 { error }。
 *   注意 query 参数名为 limit（客户端固定 limit=10）。
 *
 * 字段适配（src/lib/admin-adapter.ts）：profiles.user_id→id，
 * credits_balance / subscription_tier 在详情接口返回。
 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const search = url.searchParams.get('search') || undefined;

    const { users, total } = await listUsersAdapted(guard.client, { page, pageSize: limit, search });
    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load users' },
      { status: 500 },
    );
  }
}
