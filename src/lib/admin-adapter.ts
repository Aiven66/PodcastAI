/**
 * packages（@clipop/admin）server 能力 → 项目自有 schema 的路由层适配。
 *
 * 字段差异（见 supabase/migrations/0001_init.sql）：
 *   - profiles：主键关联列是 user_id（packages 按 id 查询），无 google_id / is_active；
 *     积分与订阅在 profiles.credits_balance / profiles.subscription_tier（packages 预期
 *     credits / subscriptions.plan_type 分表）。
 *   - credit_logs：action_type / credits_change / balance_after（packages 预期
 *     type / amount），购买记录 action_type='subscription'（packages 预期 type='purchase'）。
 *   - subscriptions：tier / status / payment_method（packages 预期 plan_type / status）。
 *
 * 适配层 select 实际字段后映射为 packages 的 AdminUserRow / AdminUserDetail /
 * PaymentRow / TransactionRow / AnalyticsStats 形状，packages 源码保持不动。
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@packages/admin/server/verify';
import { fetchAnalytics } from '@packages/admin/server/analytics';
import type { AnalyticsStats, RetentionRates } from '@packages/admin/server/analytics';
import type { AdminConfig, AdminContext } from '@packages/admin/server/verify';
import type {
  AdminUserDetail,
  AdminUserRow,
  ListUsersOptions,
  ListUsersResult,
  UpdateUserInput,
} from '@packages/admin/server/users';
import type {
  ListPaymentsOptions,
  ListPaymentsResult,
  ListTransactionsOptions,
  ListTransactionsResult,
  PaymentRow,
  TransactionRow,
} from '@packages/admin/server/payments';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { buildServerConfig } from './server-config';

// ── 管理员守卫 ────────────────────────────────────────────────

export type AdminGuard =
  | { ok: true; config: AdminConfig; client: SupabaseClient; context: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * requireAdmin 包装：把 packages 抛出的 401/403 风格错误转换为 JSON 响应。
 *   1. 先触发项目 env 加载链（dotenv / coze-workload-identity）再构建 config；
 *   2. requireAdmin 校验通过后，优先改用项目 getSupabaseClient()
 *      （service-role，带项目 env 加载与请求包装），失败时回退 packages client。
 * 用法：const guard = await guardAdmin(request); if (!guard.ok) return guard.response;
 */
export async function guardAdmin(request: NextRequest): Promise<AdminGuard> {
  try {
    getSupabaseClient();
  } catch {
    // Supabase 未配置（demo 模式），config 走 packages client 兜底
  }
  const config = buildServerConfig();
  try {
    const context = await requireAdmin(config, request);
    let client = context.client;
    try {
      client = getSupabaseClient();
    } catch {
      // 回退 requireAdmin 构建的 client
    }
    return { ok: true, config, client, context };
  } catch (err) {
    const status =
      err instanceof Error && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Admin authentication failed';
    const code = status === 401 || status === 403 ? status : 500;
    return { ok: false, response: NextResponse.json({ error: message }, { status: code }) };
  }
}

// ── 用户管理（profiles 适配） ─────────────────────────────────

const PROFILE_COLUMNS =
  'user_id, email, name, role, avatar_url, subscription_tier, credits_balance, created_at';

function toAdminUserRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: String(row.user_id || ''),
    email: String(row.email || ''),
    name: (row.name as string) || null,
    role: String(row.role || 'user'),
    avatarUrl: (row.avatar_url as string) || null,
    googleId: null, // profiles 无 google_id 列
    isActive: true, // profiles 无 is_active 列，默认视为活跃
    createdAt: String(row.created_at || ''),
  };
}

/** listUsers 适配版：select profiles 实际字段并映射 AdminUserRow。 */
export async function listUsersAdapted(
  client: SupabaseClient,
  opts: ListUsersOptions,
): Promise<ListUsersResult> {
  const { page, pageSize, search } = opts;
  const offset = (page - 1) * pageSize;

  let query = client.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' });
  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`listUsers failed: ${error.message}`);

  const users = (data || []).map((row: Record<string, unknown>) => toAdminUserRow(row));
  return { users, total: count || 0 };
}

/** getUserDetail 适配版：profiles + credit_logs + subscriptions + podcasts。 */
export async function getUserDetailAdapted(
  client: SupabaseClient,
  userId: string,
): Promise<AdminUserDetail> {
  if (!userId || userId === 'undefined') {
    throw new Error('Invalid user ID');
  }

  const [profileRes, txRes, subsRes, podcastsRes] = await Promise.all([
    client.from('profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle(),
    client
      .from('credit_logs')
      .select('id, credits_change, action_type, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    client
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    client.from('podcasts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (profileRes.error) throw new Error(`getUserDetail failed: ${profileRes.error.message}`);
  if (!profileRes.data) throw new Error('User not found');

  const profile = profileRes.data as Record<string, unknown>;
  const sub = (subsRes.data?.[0] || null) as Record<string, unknown> | null;
  const tier = (sub?.tier as string) || (profile.subscription_tier as string) || 'free';

  return {
    ...toAdminUserRow(profile),
    creditsBalance: Number(profile.credits_balance) || 0,
    subscriptionPlan: tier,
    subscriptionStatus: (sub?.status as string) || (tier !== 'free' ? 'active' : undefined),
    videosProcessed: podcastsRes.count || 0,
    recentTransactions: (txRes.data || []).map((tx: Record<string, unknown>) => ({
      id: String(tx.id),
      amount: Number(tx.credits_change) || 0,
      type: String(tx.action_type || ''),
      description: String(tx.description || ''),
      createdAt: String(tx.created_at || ''),
    })),
  };
}

/** updateUser 适配版：profiles.role（profiles 无 is_active，status 不落库）。 */
export async function updateUserAdapted(
  client: SupabaseClient,
  userId: string,
  input: UpdateUserInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.role) patch.role = input.role;
  patch.updated_at = new Date().toISOString();

  const { error } = await client.from('profiles').update(patch).eq('user_id', userId);
  if (error) throw new Error(`updateUser failed: ${error.message}`);
}

/** deleteUser 适配版：级联清理 podcasts / voice_clones / credit_logs / subscriptions 后删 profiles。 */
export async function deleteUserAdapted(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  await Promise.all([
    client.from('credit_logs').delete().eq('user_id', userId),
    client.from('subscriptions').delete().eq('user_id', userId),
    client.from('podcasts').delete().eq('user_id', userId),
    client.from('voice_clones').delete().eq('user_id', userId),
  ]);

  const { error } = await client.from('profiles').delete().eq('user_id', userId);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}

// ── 付费管理（credit_logs / subscriptions 适配） ──────────────

function buildPriceMap(config: AdminConfig): Record<string, number> {
  const map: Record<string, number> = {};
  for (const plan of config.plans || []) map[plan.id.toLowerCase()] = plan.priceIntl;
  return map;
}

function parsePlanFromDescription(desc: string, priceMap: Record<string, number>): string | null {
  const lower = (desc || '').toLowerCase();
  for (const planId of Object.keys(priceMap)) {
    if (lower.includes(planId)) return planId;
  }
  return null;
}

function parseProviderFromDescription(desc: string): string {
  const match = (desc || '').match(/via\s+(\w+)/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

function startOfMonthUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

/**
 * listPayments 适配版：购买记录来自 credit_logs.action_type='subscription'
 * （本项目 webhook 写入），金额按 description 匹配套餐价格。
 */
export async function listPaymentsAdapted(
  client: SupabaseClient,
  config: AdminConfig,
  opts: ListPaymentsOptions,
): Promise<ListPaymentsResult> {
  const priceMap = buildPriceMap(config);
  const { page, pageSize, planType, status } = opts;
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await client
    .from('credit_logs')
    .select('id, user_id, description, created_at', { count: 'exact' })
    .eq('action_type', 'subscription')
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`listPayments failed: ${error.message}`);

  const txRows = (data || []) as Array<Record<string, unknown>>;
  const userIds = [...new Set(txRows.map((tx) => String(tx.user_id)).filter(Boolean))];
  const userMap: Record<string, { email: string; name: string }> = {};
  if (userIds.length > 0) {
    const { data: usersData } = await client
      .from('profiles')
      .select('user_id, email, name')
      .in('user_id', userIds);
    for (const u of (usersData || []) as Array<Record<string, unknown>>) {
      userMap[String(u.user_id)] = { email: String(u.email || ''), name: String(u.name || '') };
    }
  }

  let payments: PaymentRow[] = txRows.map((tx) => {
    const desc = String(tx.description || '');
    const planId = parsePlanFromDescription(desc, priceMap);
    const user = userMap[String(tx.user_id)] || { email: '', name: '' };
    return {
      id: String(tx.id),
      userId: String(tx.user_id || ''),
      userEmail: user.email,
      userName: user.name,
      amount: planId && priceMap[planId] != null ? priceMap[planId] : 0,
      planType: planId || 'unknown',
      description: desc,
      createdAt: String(tx.created_at || ''),
    };
  });

  if (planType) {
    payments = payments.filter((p) => p.planType === planType);
  }

  if (status) {
    const subUserIds = payments.map((p) => p.userId);
    const { data: subsData } = await client
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', subUserIds)
      .eq('status', status);
    const activeIds = new Set((subsData || []).map((s: Record<string, unknown>) => String(s.user_id)));
    payments = payments.filter((p) => activeIds.has(p.userId));
  }

  // 汇总：扫描全部购买记录。
  const { data: allTx } = await client
    .from('credit_logs')
    .select('description, created_at')
    .eq('action_type', 'subscription');

  const monthStart = startOfMonthUtcIso();
  const summary = {
    totalRevenue: 0,
    monthRevenue: 0,
    byPlan: {} as Record<string, { count: number; revenue: number }>,
    byProvider: {} as Record<string, { count: number; revenue: number }>,
  };

  for (const tx of (allTx || []) as Array<Record<string, unknown>>) {
    const desc = String(tx.description || '');
    const planId = parsePlanFromDescription(desc, priceMap);
    const provider = parseProviderFromDescription(desc);
    const amount = planId && priceMap[planId] != null ? priceMap[planId] : 0;
    const createdAt = String(tx.created_at || '');

    summary.totalRevenue += amount;
    if (createdAt >= monthStart) summary.monthRevenue += amount;

    if (planId) {
      if (!summary.byPlan[planId]) summary.byPlan[planId] = { count: 0, revenue: 0 };
      summary.byPlan[planId].count++;
      summary.byPlan[planId].revenue += amount;
    }
    if (!summary.byProvider[provider]) summary.byProvider[provider] = { count: 0, revenue: 0 };
    summary.byProvider[provider].count++;
    summary.byProvider[provider].revenue += amount;
  }

  summary.totalRevenue = Math.round(summary.totalRevenue * 100) / 100;
  summary.monthRevenue = Math.round(summary.monthRevenue * 100) / 100;

  return { payments, total: count || 0, summary };
}

/** listTransactions 适配版：credit_logs（credits_change → amount, action_type → type）。 */
export async function listTransactionsAdapted(
  client: SupabaseClient,
  opts: ListTransactionsOptions,
): Promise<ListTransactionsResult> {
  const { page, pageSize, userId, type } = opts;
  const offset = (page - 1) * pageSize;

  let query = client
    .from('credit_logs')
    .select('id, user_id, credits_change, action_type, description, created_at', { count: 'exact' });

  if (userId) query = query.eq('user_id', userId);
  if (type) query = query.eq('action_type', type);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`listTransactions failed: ${error.message}`);

  const transactions: TransactionRow[] = (data || []).map((tx: Record<string, unknown>) => ({
    id: String(tx.id),
    userId: String(tx.user_id || ''),
    amount: Number(tx.credits_change) || 0,
    type: String(tx.action_type || ''),
    description: String(tx.description || ''),
    createdAt: String(tx.created_at || ''),
  }));

  return { transactions, total: count || 0 };
}

// ── 数据统计（fetchAnalytics + 修正） ─────────────────────────

function startOfDaysAgoUtcIso(days: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 0, 0, 0, 0)).toISOString();
}

/**
 * 留存修正：packages computeRetention 以 profiles.id 关联 podcasts.user_id，
 * 两列不一致导致留存恒为 0；这里用 profiles.user_id 重算。
 */
async function computeRetentionAdapted(
  client: SupabaseClient,
  days: number[],
): Promise<RetentionRates> {
  const result: RetentionRates = { day1: 0, day3: 0, day7: 0, day30: 0 };
  try {
    const maxDays = Math.max(...days);
    const cutoff = startOfDaysAgoUtcIso(maxDays + 1);
    const { data: cohort } = await client
      .from('profiles')
      .select('user_id, created_at')
      .lt('created_at', cutoff)
      .limit(500);

    const users = (cohort || []) as Array<Record<string, unknown>>;
    if (users.length === 0) return result;

    const userIds = users.map((u) => String(u.user_id));
    const { data: activityRows } = await client
      .from('podcasts')
      .select('user_id, created_at')
      .in('user_id', userIds);

    const activityByUser: Record<string, string[]> = {};
    for (const row of (activityRows || []) as Array<Record<string, unknown>>) {
      const uid = String(row.user_id || '');
      if (!uid) continue;
      if (!activityByUser[uid]) activityByUser[uid] = [];
      activityByUser[uid].push(String(row.created_at || ''));
    }

    for (const day of days) {
      let retained = 0;
      for (const user of users) {
        const activity = activityByUser[String(user.user_id)] || [];
        const userCreatedMs = new Date(String(user.created_at || '')).getTime();
        for (const ts of activity) {
          const diffDays = (new Date(ts).getTime() - userCreatedMs) / (1000 * 60 * 60 * 24);
          if (diffDays >= day && diffDays <= day + 1) {
            retained++;
            break;
          }
        }
      }
      const rate = (retained / users.length) * 100;
      const key = `day${day}` as keyof RetentionRates;
      result[key] = Math.round(rate * 100) / 100;
    }
  } catch {
    // 留存是尽力而为指标
  }
  return result;
}

/**
 * fetchAnalytics 适配版：
 *   1. 先调 packages fetchAnalytics（videos 已映射到 podcasts，用户/活跃/视频数正确）；
 *   2. 修正因字段差异失真的指标 —— activeSubs（subscriptions.plan_type → tier）、
 *      totalRevenue（credit_logs.type='purchase' → action_type='subscription'）及
 *      由其派生的 arpu / conversionRate，与以 user_id 重算的留存。
 */
export async function fetchAnalyticsAdapted(
  config: AdminConfig,
  client: SupabaseClient,
): Promise<AnalyticsStats> {
  const stats = await fetchAnalytics(config, client);
  const priceMap = buildPriceMap(config);

  const [subsRes, txRes] = await Promise.all([
    client
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .neq('tier', 'free'),
    client
      .from('credit_logs')
      .select('description, created_at')
      .eq('action_type', 'subscription'),
  ]);

  const activeSubs = subsRes.count || 0;

  let totalRevenue = 0;
  for (const tx of (txRes.data || []) as Array<Record<string, unknown>>) {
    const planId = parsePlanFromDescription(String(tx.description || ''), priceMap);
    if (planId && priceMap[planId] != null) totalRevenue += priceMap[planId];
  }
  totalRevenue = Math.round(totalRevenue * 100) / 100;

  const retentionRates = await computeRetentionAdapted(client, [1, 3, 7, 30]);

  const arpu = stats.totalUsers > 0 ? totalRevenue / stats.totalUsers : 0;
  const conversionRate = stats.totalUsers > 0 ? (activeSubs / stats.totalUsers) * 100 : 0;

  return {
    ...stats,
    activeSubs,
    totalRevenue,
    retentionRates,
    arpu: Math.round(arpu * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
  };
}
