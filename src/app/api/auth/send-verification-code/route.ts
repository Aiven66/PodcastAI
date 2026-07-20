import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

/**
 * 邮箱验证码 API
 *
 * POST：发送验证码到邮箱
 *   - Demo 模式：不实际发送邮件，将验证码存内存（5 分钟过期），开发模式下返回 code
 *   - Supabase 模式：调用 Supabase Auth signUp 触发邮件发送（或调用第三方邮件服务）
 *
 * PUT：校验验证码
 *   - 成功返回 { verified: true }
 *   - 失败返回 { verified: false, error: 'Invalid code' }
 */

interface VerificationEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

// 内存存储验证码（仅适用于单实例部署；多实例需要使用 Redis 等）
const verificationCodes = new Map<string, VerificationEntry>();

const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isSupabaseConfigured(): boolean {
  try {
    const { url, anonKey } = getSupabaseCredentials();
    return Boolean(url && anonKey);
  } catch {
    return false;
  }
}

function generateSixDigitCode(): string {
  // 使用 crypto.randomUUID 提供更强的随机性，再取模得到 6 位
  let raw = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    raw = globalThis.crypto.randomUUID().replace(/-/g, '');
  } else {
    raw = Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  let num = 0;
  for (let i = 0; i < raw.length; i++) {
    num = (num * 16 + parseInt(raw[i], 16)) % 1_000_000;
  }
  return num.toString().padStart(6, '0');
}

function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * POST /api/auth/send-verification-code
 * body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email is required / 请输入有效的邮箱' },
        { status: 400 }
      );
    }

    const code = generateSixDigitCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    verificationCodes.set(email, { code, expiresAt, attempts: 0 });

    // Demo 模式：不实际发送邮件
    if (!isSupabaseConfigured()) {
      const payload: { success: boolean; demo: boolean; code?: string } = {
        success: true,
        demo: true,
      };
      // 开发模式下返回 code 方便测试
      if (isDevMode()) {
        payload.code = code;
      }
      return NextResponse.json(payload);
    }

    // Supabase 模式：使用 Supabase Auth signUp 发送 OTP
    // 注意：此处仅用于发送验证码，不创建用户。需在 PUT 验证后由调用方真正 signUp
    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (sendError) {
        return NextResponse.json(
          { success: false, error: sendError.message },
          { status: 500 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to send email / 发送邮件失败',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, demo: false });
  } catch (error) {
    console.error('send-verification-code POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error / 内部错误' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/send-verification-code
 * body: { email: string, code: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!email || !code) {
      return NextResponse.json(
        { verified: false, error: 'Invalid code / 验证码错误' },
        { status: 400 }
      );
    }

    const entry = verificationCodes.get(email);

    if (!entry) {
      return NextResponse.json(
        { verified: false, error: 'Invalid code / 验证码错误' },
        { status: 400 }
      );
    }

    // 已过期
    if (Date.now() > entry.expiresAt) {
      verificationCodes.delete(email);
      return NextResponse.json(
        { verified: false, error: 'Invalid code / 验证码错误' },
        { status: 400 }
      );
    }

    // 防爆破：尝试次数过多
    if (entry.attempts >= MAX_ATTEMPTS) {
      verificationCodes.delete(email);
      return NextResponse.json(
        { verified: false, error: 'Too many attempts / 尝试次数过多' },
        { status: 429 }
      );
    }

    entry.attempts += 1;

    if (entry.code !== code) {
      return NextResponse.json(
        { verified: false, error: 'Invalid code / 验证码错误' },
        { status: 400 }
      );
    }

    // 验证成功，删除记录
    verificationCodes.delete(email);
    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('send-verification-code PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error / 内部错误' },
      { status: 500 }
    );
  }
}
