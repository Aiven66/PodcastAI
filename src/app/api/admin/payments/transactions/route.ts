import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, listTransactionsAdapted } from '@/lib/admin-adapter';

/**
 * GET /api/admin/payments/transactions — 积分交易记录。
 *
 * 契约来源：packages/admin/payments-page.tsx fetchTransactions
 *   GET `${endpoint}/transactions?page=N&limit=N` + Bearer → 200
 *   { transactions: TransactionRow[], total }，失败 { error }。
 *
 * 字段适配（src/lib/admin-adapter.ts）：credit_logs.credits_change→amount、
 * action_type→type。
 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const userId = url.searchParams.get('userId') || undefined;
    const type = url.searchParams.get('type') || undefined;

    const { transactions, total } = await listTransactionsAdapted(guard.client, {
      page,
      pageSize: limit,
      userId,
      type,
    });

    return NextResponse.json({ transactions, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load transactions' },
      { status: 500 },
    );
  }
}
