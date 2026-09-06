import { NextRequest, NextResponse } from 'next/server';
import { fetchBehaviorEvents } from '@packages/admin/server/events';
import { guardAdmin } from '@/lib/admin-adapter';

/**
 * GET /api/admin/events — 行为数据（漏斗 + 每日趋势）。
 *
 * 契约来源：packages/admin/events-page.tsx fetchData
 *   GET ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD + Bearer → 200
 *   { range: { startDate, endDate }, summary, funnels, dailyTrend }，
 *   失败 { error }。快速范围为 7/30/90 天（endDate=今天）。
 *
 * 适配说明：packages fetchBehaviorEvents 仅支持 days 回看窗口（以今天为终点），
 * 路由层把 startDate/endDate 换算为 days 后调用，并把返回的 range 修正为
 * 请求值。behavior_events 表与 packages 字段一致（无字段差异）。
 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid startDate or endDate, expected YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${endDate}T23:59:59Z`).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
      return NextResponse.json(
        { error: 'Invalid date range: endDate must be >= startDate' },
        { status: 400 },
      );
    }

    const days = Math.round((endMs - startMs) / 86_400_000) + 1;
    const funnelId = url.searchParams.get('funnelId') || undefined;

    const result = await fetchBehaviorEvents(guard.config, guard.client, {
      days: Math.max(1, days),
      funnelId,
    });

    return NextResponse.json({
      ...result,
      range: { startDate, endDate },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load events' },
      { status: 500 },
    );
  }
}
