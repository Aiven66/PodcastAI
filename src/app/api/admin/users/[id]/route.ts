import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, getUserDetailAdapted, updateUserAdapted, deleteUserAdapted } from '@/lib/admin-adapter';

/**
 * /api/admin/users/[id] — 用户详情 / 角色切换 / 删除。
 *
 * 契约来源：packages/admin/users-page.tsx
 *   GET    + Bearer → 200 AdminUserDetail JSON（含 creditsBalance /
 *          subscriptionPlan / videosProcessed / recentTransactions）。
 *   PATCH  + Bearer + { role: 'admin' | 'user' } → 200（客户端只看 res.ok）。
 *   DELETE + Bearer → 200。
 *
 * 字段适配（src/lib/admin-adapter.ts）：详情聚合 profiles + credit_logs +
 * subscriptions + podcasts；PATCH 落 profiles.role（profiles 无 is_active）。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const detail = await getUserDetailAdapted(guard.client, id);
    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load user';
    const status = message.includes('not found') || message.includes('Invalid') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as { role?: unknown };

    if (body.role !== 'admin' && body.role !== 'user') {
      return NextResponse.json(
        { error: 'Invalid role, must be "admin" or "user"' },
        { status: 400 },
      );
    }

    await updateUserAdapted(guard.client, id, { role: body.role });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update user' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    await deleteUserAdapted(guard.client, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete user' },
      { status: 500 },
    );
  }
}
