-- PodcastAI 初始化数据库 Schema
-- 基于 src/storage/database/shared/schema.ts

-- 启用必要扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============= 用户扩展信息表 =============
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(128),
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  credits_balance INTEGER NOT NULL DEFAULT 100,
  last_credits_reset TIMESTAMPTZ DEFAULT NOW(),
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- ============= 播客表 =============
CREATE TABLE IF NOT EXISTS podcasts (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES profiles(user_id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(20) NOT NULL,
  source_url TEXT,
  source_text TEXT,
  audio_url TEXT NOT NULL,
  audio_key TEXT,
  duration INTEGER,
  podcast_type VARCHAR(20) NOT NULL DEFAULT 'single',
  voice_settings JSONB,
  highlights TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  credits_used INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS podcasts_user_id_idx ON podcasts(user_id);
CREATE INDEX IF NOT EXISTS podcasts_status_idx ON podcasts(status);
CREATE INDEX IF NOT EXISTS podcasts_created_at_idx ON podcasts(created_at);

-- ============= 声音克隆表 =============
CREATE TABLE IF NOT EXISTS voice_clones (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES profiles(user_id),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  sample_audio_url TEXT NOT NULL,
  sample_audio_key TEXT,
  clone_status VARCHAR(20) NOT NULL DEFAULT 'processing',
  voice_id VARCHAR(128),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS voice_clones_user_id_idx ON voice_clones(user_id);
CREATE INDEX IF NOT EXISTS voice_clones_voice_id_idx ON voice_clones(voice_id);

-- ============= 博客表 =============
CREATE TABLE IF NOT EXISTS blogs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id VARCHAR(36) NOT NULL REFERENCES profiles(user_id),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  tags JSONB,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS blogs_author_id_idx ON blogs(author_id);
CREATE INDEX IF NOT EXISTS blogs_slug_idx ON blogs(slug);
CREATE INDEX IF NOT EXISTS blogs_category_idx ON blogs(category);
CREATE INDEX IF NOT EXISTS blogs_is_published_idx ON blogs(is_published);
CREATE INDEX IF NOT EXISTS blogs_created_at_idx ON blogs(created_at);

-- ============= 积分使用记录表 =============
CREATE TABLE IF NOT EXISTS credit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES profiles(user_id),
  action_type VARCHAR(50) NOT NULL,
  credits_change INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  related_id VARCHAR(36),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_logs_user_id_idx ON credit_logs(user_id);
CREATE INDEX IF NOT EXISTS credit_logs_created_at_idx ON credit_logs(created_at);

-- ============= 订阅表 =============
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES profiles(user_id),
  tier VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  payment_method VARCHAR(20),
  payment_id VARCHAR(128),
  amount NUMERIC(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_end_date_idx ON subscriptions(end_date);

-- ============= 用户反馈表 =============
CREATE TABLE IF NOT EXISTS feedbacks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36),
  email VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS feedbacks_user_id_idx ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS feedbacks_status_idx ON feedbacks(status);
CREATE INDEX IF NOT EXISTS feedbacks_category_idx ON feedbacks(category);

-- ============= FAQ表 =============
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 0,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS faqs_category_idx ON faqs(category);
CREATE INDEX IF NOT EXISTS faqs_language_idx ON faqs(language);

-- ============= 预设声音模板表 =============
CREATE TABLE IF NOT EXISTS voice_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  voice_id VARCHAR(128) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  style VARCHAR(50),
  sample_audio_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_templates_voice_id_idx ON voice_templates(voice_id);
CREATE INDEX IF NOT EXISTS voice_templates_language_idx ON voice_templates(language);

-- ============= 健康检查表 =============
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============= 初始数据：FAQ =============
INSERT INTO faqs (question, answer, category, order_num, language, is_active) VALUES
  ('What is PodcastAI?', 'PodcastAI is an AI-powered platform that transforms written content into engaging podcasts using natural voice synthesis. Simply paste a link, upload a file, or enter text to generate professional-quality podcasts.', 'general', 1, 'en', TRUE),
  ('How does the credit system work?', 'Free users receive 100 credits daily, which reset at midnight. Each podcast generation costs 100 credits. Paid plans offer more credits and additional features.', 'general', 2, 'en', TRUE),
  ('What input formats are supported?', 'PodcastAI supports three input formats: 1) Article URLs (paste any link), 2) File uploads (PDF, TXT, DOCX), 3) Direct text input. All formats are processed by AI to generate engaging podcast content.', 'podcast', 1, 'en', TRUE),
  ('Can I create dual-host podcasts?', 'Yes! PodcastAI supports both single-host (narration style) and dual-host (interview style) podcasts. Dual-host mode uses two different voices that alternate based on speaker roles.', 'podcast', 2, 'en', TRUE),
  ('How does voice cloning work?', 'Voice cloning uses CosyVoice2 AI model to create a custom voice from a short sample audio (5-8 seconds). The cloned voice can then be used to generate podcasts with your unique voice timbre.', 'voice', 1, 'en', TRUE),
  ('Is voice cloning safe?', 'Yes, voice cloning is safe. Audio samples are processed locally and only used to create your custom voice. We do not share or distribute your voice data.', 'voice', 2, 'en', TRUE),
  ('What payment methods are available?', 'We support PayPal and Creem for subscriptions. Both methods accept major credit cards and provide secure payment processing.', 'payment', 1, 'en', TRUE),
  ('Can I cancel my subscription?', 'Yes, you can cancel your subscription at any time from your account settings. Your subscription remains active until the end of the current billing period.', 'payment', 2, 'en', TRUE),
  ('什么是 PodcastAI？', 'PodcastAI 是一个 AI 驱动的平台，使用自然语音合成技术将文字内容转换为引人入胜的播客。只需粘贴链接、上传文件或输入文本，即可生成专业品质的播客。', 'general', 1, 'zh', TRUE),
  ('积分系统如何工作？', '免费用户每日获得 100 积分，午夜重置。每次生成播客消耗 100 积分。付费方案提供更多积分和额外功能。', 'general', 2, 'zh', TRUE),
  ('支持哪些输入格式？', 'PodcastAI 支持三种输入格式：1）文章 URL（粘贴任何链接），2）文件上传（PDF、TXT、DOCX），3）直接文本输入。所有格式都由 AI 处理生成引人入胜的播客内容。', 'podcast', 1, 'zh', TRUE),
  ('可以创建双人播客吗？', '可以！PodcastAI 支持单人（叙述风格）和双人（访谈风格）播客。双人模式使用两个不同的声音，根据说话者角色交替朗读。', 'podcast', 2, 'zh', TRUE),
  ('声音克隆如何工作？', '声音克隆使用 CosyVoice2 AI 模型，从短样本音频（5-8 秒）创建自定义声音。然后可以使用克隆的声音生成具有您独特音色的播客。', 'voice', 1, 'zh', TRUE),
  ('声音克隆安全吗？', '安全，声音克隆是安全的。音频样本在本地处理，仅用于创建您的自定义声音。我们不会分享或分发您的声音数据。', 'voice', 2, 'zh', TRUE),
  ('支持哪些支付方式？', '我们支持 PayPal 和 Creem 订阅。两种方式都接受主要信用卡并提供安全的支付处理。', 'payment', 1, 'zh', TRUE),
  ('可以取消订阅吗？', '可以，您随时可以从账户设置中取消订阅。您的订阅将在当前计费周期结束前保持活跃。', 'payment', 2, 'zh', TRUE)
ON CONFLICT DO NOTHING;

-- ============= 初始数据：声音模板 =============
INSERT INTO voice_templates (name, description, voice_id, gender, language, style, is_active, order_num) VALUES
  ('Sarah 晓晓（专业女主播）', 'Professional female host voice', 'zh-CN-XiaoxiaoNeural', 'female', 'zh', 'professional', TRUE, 1),
  ('Emma 晓伊（友好亲切）', 'Friendly and warm female voice', 'zh-CN-XiaoyiNeural', 'female', 'zh', 'friendly', TRUE, 2),
  ('Beibei 小北（东北话）', 'Northeast dialect female voice', 'zh-CN-liaoning-XiaobeiNeural', 'female', 'zh', 'northeast', TRUE, 3),
  ('Nini 小妮（陕西话）', 'Shaanxi dialect female voice', 'zh-CN-shaanxi-XiaoniNeural', 'female', 'zh', 'shaanxi', TRUE, 4),
  ('David 云希（经典叙述）', 'Classic narrator male voice', 'zh-CN-YunxiNeural', 'male', 'zh', 'narrator', TRUE, 5),
  ('James 云健（低沉磁性）', 'Deep and magnetic male voice', 'zh-CN-YunjianNeural', 'male', 'zh', 'deep', TRUE, 6),
  ('Tom 云扬（阳光活力）', 'Sunny and energetic male voice', 'zh-CN-YunyangNeural', 'male', 'zh', 'sunny', TRUE, 7),
  ('Leo 云夏（青春少年）', 'Youthful boy voice', 'zh-CN-YunxiaNeural', 'male', 'zh', 'youth', TRUE, 8),
  ('Jenny (US English)', 'Friendly American English female voice', 'en-US-JennyNeural', 'female', 'en', 'friendly', TRUE, 9),
  ('Aria (US English)', 'Professional American English female voice', 'en-US-AriaNeural', 'female', 'en', 'professional', TRUE, 10),
  ('Sarah (UK English)', 'British English female voice', 'en-GB-SarahNeural', 'female', 'en', 'British', TRUE, 11),
  ('Guy (US English)', 'Warm American English male voice', 'en-US-GuyNeural', 'male', 'en', 'warm', TRUE, 12),
  ('Ryan (US English)', 'Energetic American English male voice', 'en-US-RyanNeural', 'male', 'en', 'energetic', TRUE, 13),
  ('James (UK English)', 'British English male voice', 'en-GB-RyanNeural', 'male', 'en', 'British', TRUE, 14)
ON CONFLICT DO NOTHING;

-- ============= 健康检查初始记录 =============
INSERT INTO health_check (updated_at) VALUES (NOW()) ON CONFLICT DO NOTHING;

-- ============= Row Level Security (RLS) 策略 =============
-- profiles: 用户只能查看和修改自己的资料
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- podcasts: 用户只能查看和修改自己的播客
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own podcasts" ON podcasts FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own podcasts" ON podcasts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own podcasts" ON podcasts FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own podcasts" ON podcasts FOR DELETE USING (auth.uid()::text = user_id);

-- voice_clones: 用户只能查看和修改自己的克隆声音
ALTER TABLE voice_clones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own voice clones" ON voice_clones FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own voice clones" ON voice_clones FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own voice clones" ON voice_clones FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own voice clones" ON voice_clones FOR DELETE USING (auth.uid()::text = user_id);

-- blogs: 已发布的博客所有人可见，作者可管理
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published blogs" ON blogs FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Authors can insert blogs" ON blogs FOR INSERT WITH CHECK (auth.uid()::text = author_id);
CREATE POLICY "Authors can update blogs" ON blogs FOR UPDATE USING (auth.uid()::text = author_id);
CREATE POLICY "Authors can delete blogs" ON blogs FOR DELETE USING (auth.uid()::text = author_id);

-- credit_logs: 用户只能查看自己的积分记录
ALTER TABLE credit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credit logs" ON credit_logs FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own credit logs" ON credit_logs FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- subscriptions: 用户只能查看自己的订阅
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid()::text = user_id);

-- feedbacks: 用户只能查看自己的反馈，可以匿名提交
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own feedbacks" ON feedbacks FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL);
CREATE POLICY "Anyone can insert feedbacks" ON feedbacks FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can update own feedbacks" ON feedbacks FOR UPDATE USING (auth.uid()::text = user_id);

-- faqs: 所有人可查看
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active FAQs" ON faqs FOR SELECT USING (is_active = TRUE);

-- voice_templates: 所有人可查看
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active voice templates" ON voice_templates FOR SELECT USING (is_active = TRUE);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'PodcastAI database schema initialized successfully';
END $$;
