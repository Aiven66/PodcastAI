import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

/**
 * 检查邮箱是否已注册
 *
 * Demo 模式：localStorage 无法在服务端访问，直接返回 exists=false, mode=demo
 * Supabase 模式：查询 profiles 表的 email 字段
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as { email?: unknown }));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required / 缺少邮箱参数' },
        { status: 400 }
      );
    }

    // 检测 Supabase 是否配置
    let supabaseConfigured = false;
    try {
      const { url, anonKey } = getSupabaseCredentials();
      supabaseConfigured = Boolean(url && anonKey);
    } catch {
      supabaseConfigured = false;
    }

    // Demo 模式：服务端无法读取浏览器 localStorage
    if (!supabaseConfigured) {
      return NextResponse.json({ exists: false, mode: 'demo' });
    }

    // Supabase 模式：动态导入客户端避免在 Demo 模式下抛错
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    // 查询 profiles 表（auth.users 通过 auth API 查询需要 service_role 权限）
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to check email / 查询邮箱失败', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exists: Boolean(data),
      mode: 'supabase',
    });
  } catch (error) {
    console.error('check-email error:', error);
    return NextResponse.json(
      { error: 'Internal server error / 内部错误' },
      { status: 500 }
    );
  }
}
