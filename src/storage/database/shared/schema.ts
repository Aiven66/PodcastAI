import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 系统表 - 必须保留
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户扩展信息表
export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().unique(), // Supabase auth.users id
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }),
    avatar_url: text("avatar_url"),
    role: varchar("role", { length: 20 }).notNull().default("user"), // admin, user
    credits_balance: integer("credits_balance").notNull().default(100), // 当前积分余额
    last_credits_reset: timestamp("last_credits_reset", { withTimezone: true }).defaultNow(), // 上次积分重置时间
    subscription_tier: varchar("subscription_tier", { length: 20 }).notNull().default("free"), // free, basic, pro
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("profiles_user_id_idx").on(table.user_id),
    index("profiles_email_idx").on(table.email),
    index("profiles_role_idx").on(table.role),
  ]
);

// 播客表
export const podcasts = pgTable(
  "podcasts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => profiles.user_id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    source_type: varchar("source_type", { length: 20 }).notNull(), // link, file, text
    source_url: text("source_url"), // 链接地址或文件key
    source_text: text("source_text"), // 原始文本内容
    audio_url: text("audio_url").notNull(), // 生成的音频URL
    audio_key: text("audio_key"), // 对象存储key
    duration: integer("duration"), // 音频时长（秒）
    podcast_type: varchar("podcast_type", { length: 20 }).notNull().default("single"), // single, dual
    voice_settings: jsonb("voice_settings"), // 声音配置
    highlights: text("highlights"), // AI提取的亮点
    status: varchar("status", { length: 20 }).notNull().default("processing"), // processing, completed, failed
    credits_used: integer("credits_used").notNull().default(30), // 消耗的积分
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("podcasts_user_id_idx").on(table.user_id),
    index("podcasts_status_idx").on(table.status),
    index("podcasts_created_at_idx").on(table.created_at),
  ]
);

// 声音克隆表
export const voiceClones = pgTable(
  "voice_clones",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => profiles.user_id),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    sample_audio_url: text("sample_audio_url").notNull(), // 样本音频URL
    sample_audio_key: text("sample_audio_key"), // 样本音频存储key
    clone_status: varchar("clone_status", { length: 20 }).notNull().default("processing"), // processing, completed, failed
    voice_id: varchar("voice_id", { length: 128 }), // 克隆后的voice_id
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("voice_clones_user_id_idx").on(table.user_id),
    index("voice_clones_voice_id_idx").on(table.voice_id),
  ]
);

// 博客表
export const blogs = pgTable(
  "blogs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    author_id: varchar("author_id", { length: 36 }).notNull().references(() => profiles.user_id),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    category: varchar("category", { length: 100 }).notNull(), // tutorial, news, tips, etc.
    summary: text("summary"),
    content: text("content").notNull(), // 富文本内容（HTML）
    cover_image_url: text("cover_image_url"),
    is_published: boolean("is_published").notNull().default(true),
    view_count: integer("view_count").notNull().default(0),
    tags: jsonb("tags"), // 标签数组
    language: varchar("language", { length: 10 }).notNull().default("en"), // en, zh
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("blogs_author_id_idx").on(table.author_id),
    index("blogs_slug_idx").on(table.slug),
    index("blogs_category_idx").on(table.category),
    index("blogs_is_published_idx").on(table.is_published),
    index("blogs_created_at_idx").on(table.created_at),
  ]
);

// 积分使用记录表
export const creditLogs = pgTable(
  "credit_logs",
  {
    id: serial().primaryKey(),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => profiles.user_id),
    action_type: varchar("action_type", { length: 50 }).notNull(), // daily_reset, podcast_generate, voice_clone, etc.
    credits_change: integer("credits_change").notNull(), // 积分变化（正数增加，负数减少）
    balance_after: integer("balance_after").notNull(), // 操作后余额
    related_id: varchar("related_id", { length: 36 }), // 关联的播客/克隆等ID
    description: text("description"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("credit_logs_user_id_idx").on(table.user_id),
    index("credit_logs_created_at_idx").on(table.created_at),
  ]
);

// 订阅表
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => profiles.user_id),
    tier: varchar("tier", { length: 20 }).notNull(), // free, basic, pro
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, cancelled, expired
    payment_method: varchar("payment_method", { length: 20 }), // paypal, stripe
    payment_id: varchar("payment_id", { length: 128 }), // 支付平台订单ID
    amount: numeric("amount", { precision: 10, scale: 2 }), // 金额
    currency: varchar("currency", { length: 10 }).default("USD"),
    start_date: timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
    end_date: timestamp("end_date", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.user_id),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_end_date_idx").on(table.end_date),
  ]
);

// 用户反馈表
export const feedbacks = pgTable(
  "feedbacks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }), // 可为空，支持匿名反馈
    email: varchar("email", { length: 255 }), // 用户邮箱（用于匿名反馈）
    subject: varchar("subject", { length: 255 }).notNull(), // 反馈主题
    category: varchar("category", { length: 50 }).notNull().default("general"), // general, bug, feature, payment, other
    message: text("message").notNull(), // 反馈内容
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, reviewed, resolved
    admin_reply: text("admin_reply"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("feedbacks_user_id_idx").on(table.user_id),
    index("feedbacks_status_idx").on(table.status),
    index("feedbacks_category_idx").on(table.category),
  ]
);

// FAQ表
export const faqs = pgTable(
  "faqs",
  {
    id: serial().primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 100 }).notNull(), // general, pricing, usage, etc.
    order_num: integer("order_num").notNull().default(0), // 排序
    language: varchar("language", { length: 10 }).notNull().default("en"), // en, zh
    is_active: boolean("is_active").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("faqs_category_idx").on(table.category),
    index("faqs_language_idx").on(table.language),
  ]
);

// 预设声音模板表
export const voiceTemplates = pgTable(
  "voice_templates",
  {
    id: serial().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    voice_id: varchar("voice_id", { length: 128 }).notNull(), // TTS系统使用的voice_id
    gender: varchar("gender", { length: 10 }).notNull(), // male, female
    language: varchar("language", { length: 10 }).notNull().default("en"), // en, zh
    style: varchar("style", { length: 50 }), // audiobook, video, roleplay, etc.
    sample_audio_url: text("sample_audio_url"),
    is_active: boolean("is_active").notNull().default(true),
    order_num: integer("order_num").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("voice_templates_voice_id_idx").on(table.voice_id),
    index("voice_templates_language_idx").on(table.language),
  ]
);

// 类型导出
export type Profile = typeof profiles.$inferSelect;
export type Podcast = typeof podcasts.$inferSelect;
export type VoiceClone = typeof voiceClones.$inferSelect;
export type Blog = typeof blogs.$inferSelect;
export type CreditLog = typeof creditLogs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Feedback = typeof feedbacks.$inferSelect;
export type FAQ = typeof faqs.$inferSelect;
export type VoiceTemplate = typeof voiceTemplates.$inferSelect;