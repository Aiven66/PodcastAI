import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, fetchAnalyticsAdapted } from '@/lib/admin-adapter';

/**
 * GET /api/admin/analytics — 数据统计。
 *
 * 契约来源：packages/admin/stats-page.tsx fetchStats
 *   GET + Bearer → 200 AnalyticsStats JSON（totalUsers / newToday / newThisMonth /
 *   activeSubs / totalVideos / totalRevenue / activeUsers7d / retentionRates /
 *   arpu / conversionRate），失败 { error } + 4xx/5xx。
 *
 * 字段适配（src/lib/admin-adapter.ts）：videos→podcasts、
 * subscriptions.plan_type→tier、credit_logs.type='purchase'→action_type='subscription'，
 * 留存以 profiles.user_id 重算。
 */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const stats = await fetchAnalyticsAdapted(guard.config, guard.client);
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load analytics' },
      { status: 500 },
    );
  }
}
