/**
 * PodcastAI 应用配置（集中管理）
 *
 * 整合 @clipop/packages 通用组件体系的配置注入点。
 * packages 内代码不读环境变量，全部由本文件构建配置后通过
 * AppConfigProvider 注入 —— 域名 / Supabase / 管理员 / 套餐等
 * 项目自有配置都收敛在这里。
 *
 * 域名切换：仅需更新环境变量 NEXT_PUBLIC_APP_URL（或部署平台环境变量），
 * OAuth 回调、桌面端回调、支付回调全部自动跟随。
 */

import type { AppConfig } from '@packages/core/config';

// ── 环境变量读取 ─────────────────────────────────────────────

/** 应用域名。未配置时回退 window.location.origin（客户端）或 localhost。 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

/** 管理员邮箱白名单。环境变量 ADMIN_EMAILS 逗号分隔，默认 admin@126.com。 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const list = raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  return list.length > 0 ? list : ['admin@126.com'];
}

// ── 项目自有常量（套餐沿用现有 pricing 页定义） ────────────────

export const APP_NAME = 'PodcastAI';

export const PLANS: AppConfig['plans'] = [
  {
    id: 'free',
    name: 'Free',
    priceIntl: 0,
    priceCny: 0,
    dailyCredits: 100,
    features: [
      '100 daily credits',
      'Single-host podcast',
      'Basic voice templates',
      'Standard audio quality',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    priceIntl: 9.99,
    priceCny: 49,
    dailyCredits: 500,
    badge: 'Popular',
    features: [
      '500 credits per month',
      'Single & dual-host podcasts',
      'Voice cloning',
      'High audio quality',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceIntl: 29.99,
    priceCny: 199,
    dailyCredits: 1_000_000,
    unlimitedCredits: true,
    features: [
      'Unlimited credits',
      'All podcast modes',
      'Advanced voice cloning',
      'Premium audio quality',
      'Priority support',
    ],
  },
];

/** 支付通道：由环境变量控制启停，未配置的通道自动禁用。 */
export function buildPaymentChannels(): AppConfig['paymentChannels'] {
  const channels: AppConfig['paymentChannels'] = [];

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  if (paypalClientId) {
    channels.push({ provider: 'paypal', enabled: true, config: { clientId: paypalClientId } });
  }

  const creemApiKey = process.env.CREEM_API_KEY || '';
  if (creemApiKey) {
    channels.push({ provider: 'creem', enabled: true, config: { apiKey: creemApiKey } });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (stripeKey) {
    channels.push({ provider: 'stripe', enabled: true, config: { secretKey: stripeKey } });
  }

  return channels;
}

/**
 * 数据库表名映射 —— 保留项目自有 schema：
 * packages 默认 users / credit_transactions，本项目用 profiles / credit_logs。
 * 其余表（credits / subscriptions / blogs / behavior_events / feedbacks）同名直用。
 */
export const TABLE_OVERRIDES = {
  users: 'profiles',
  creditTransactions: 'credit_logs',
} as const;

// ── 客户端配置构建（AppConfigProvider 注入值） ─────────────────

export interface BuildClientConfigInput {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/** 构建客户端 AppConfig。Supabase 连接参数由调用方动态拉取后传入。 */
export function buildClientConfig(input: BuildClientConfigInput): Partial<AppConfig> {
  return {
    appName: APP_NAME,
    appUrl: getAppUrl(),
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseAnonKey,
    authCallbackPath: '/auth/callback',
    googleOAuthScopes: 'email profile',
    admin: {
      adminEmails: getAdminEmails(),
      loginPath: '/login',
    },
    desktop: {
      enabled: true,
      scheme: 'podcastai',
    },
    plans: PLANS,
    paymentChannels: buildPaymentChannels(),
    dailyFreeCredits: 100,
    adminCredits: 10_000,
    blogImageBucket: 'blog-images',
    blogTranslationLocales: ['zh', 'en'],
    blogDefaultCategory: 'General',
    defaultLocale: 'zh',
    supportedLocales: ['zh', 'en'],
  };
}
