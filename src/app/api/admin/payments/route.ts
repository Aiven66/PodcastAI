import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, listPaymentsAdapted } from '@/lib/admin-adapter';

/**
 * GET /api/admin/payments — 付费记录 + 汇总。
 *
 * 契约来源：packages/admin/payments-page.tsx fetchPayments
 *   GET ?page=N&limit=N&planType=...&status=... + Bearer → 200
 *   { payments: PaymentRow[], total, totalPages, page,
 *     summary: { totalRevenue, monthRevenue, byPlan, byProvider } }，
 *   失败 { error }。注意 query 参数名为 limit（客户端固定 limit=10）。
 *
 * 字段适配（src/lib/admin-adapter.ts）：购买记录来自
 * credit_logs.action_type='subscription'，金额按 description 匹配套餐价格。
 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const planType = url.searchParams.get('planType') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const { payments, total, summary } = await listPaymentsAdapted(guard.client, guard.config, {
      page,
      pageSize: limit,
      planType,
      status,
    });

    return NextResponse.json({
      payments,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load payments' },
      { status: 500 },
    );
  }
}
