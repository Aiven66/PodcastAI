/**
 * 服务端 AdminConfig 构建器（SERVER-ONLY）
 *
 * 供 API 路由调用 @clipop/admin、@clipop/payments 等 server 模块时
 * 构建配置。沿用项目自有环境变量约定：
 *   - COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY
 *   - COZE_SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_APP_URL（域名切换点）
 *   - ADMIN_EMAILS（管理员白名单，默认 admin@126.com）
 */

import 'server-only';
import type { AdminConfig } from '@packages/admin';
import { DEFAULT_FUNNELS } from '@packages/analytics/funnel-config';
import { APP_NAME, PLANS, TABLE_OVERRIDES, getAppUrl, getAdminEmails } from './app-config';

/** 读取服务端 Supabase 配置（环境变量缺失时返回 undefined，由调用方降级）。 */
export function getServerSupabaseConfig() {
  return {
    url: process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL,
    anonKey: process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    serviceRoleKey:
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** 构建服务端 AdminConfig（含表名映射，保留自有 schema）。 */
export function buildServerConfig(): AdminConfig {
  const sb = getServerSupabaseConfig();
  return {
    appName: APP_NAME,
    appUrl: getAppUrl(),
    supabaseUrl: sb.url,
    supabaseAnonKey: sb.anonKey,
    supabaseServiceRoleKey: sb.serviceRoleKey,
    admin: {
      adminEmails: getAdminEmails(),
      loginPath: '/login',
    },
    desktop: { enabled: true, scheme: 'podcastai' },
    plans: PLANS,
    paymentChannels: [],
    dailyFreeCredits: 100,
    adminCredits: 10_000,
    // 行为漏斗定义（/api/admin/events 与 /api/events/track 使用）
    funnels: DEFAULT_FUNNELS,
    // blog 包服务端能力所需配置
    blogImageBucket: 'blog-images',
    blogTranslationLocales: ['zh', 'en'],
    blogDefaultCategory: 'General',
    // 保留项目自有表名：packages 默认 users / credit_transactions / videos。
    // packages 的 "videos" 活跃/留存指标在本项目映射到 podcasts 表。
    tables: { ...TABLE_OVERRIDES, videos: 'podcasts' },
  };
}
