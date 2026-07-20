import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 创建或更新用户profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, role = 'user', name } = body
    
    // 从header获取session token
    const sessionToken = request.headers.get('x-session')
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session token' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseClient(sessionToken)
    
    // 获取当前用户信息
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // 检查profile是否已存在
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, 其他错误需要处理
      return NextResponse.json(
        { error: 'Failed to check existing profile' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      // 更新现有profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email: email || user.email,
          name: name || user.user_metadata?.full_name || email?.split('@')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, profile: existingProfile })
    }

    // 创建新profile
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        email: email || user.email,
        name: name || user.user_metadata?.full_name || email?.split('@')[0],
        role: role,
        credits_balance: 100,
        subscription_tier: 'free',
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, profile: newProfile })
  } catch (error) {
    console.error('Profile creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}