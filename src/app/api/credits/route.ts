import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 获取用户积分信息
export async function GET(request: NextRequest) {
  try {
    // 从header获取session token
    const sessionToken = request.headers.get('x-session')
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session token' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseClient(sessionToken)
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // 获取用户积分信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_tier')
      .eq('user_id', user.id)
      .single()
    
    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to get profile' },
        { status: 500 }
      )
    }

    // 获取积分使用历史
    const { data: logs, error: logsError } = await supabase
      .from('credit_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (logsError) {
      console.error('Failed to get credit logs:', logsError)
    }

    return NextResponse.json({
      balance: profile.credits_balance,
      tier: profile.subscription_tier,
      logs: logs || [],
    })

  } catch (error) {
    console.error('Credits fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 积分重置（每日0点自动执行）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action === 'reset_daily') {
      // 重置所有免费用户的每日积分
      const supabase = getSupabaseClient()
      
      // 获取所有免费用户
      const { data: freeUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('user_id, credits_balance')
        .eq('subscription_tier', 'free')
      
      if (fetchError) {
        return NextResponse.json(
          { error: 'Failed to fetch users' },
          { status: 500 }
        )
      }

      // 批量重置积分到100
      const updatePromises = freeUsers.map(async (user) => {
        // 只重置到100，不累加
        if (user.credits_balance < 100) {
          await supabase
            .from('profiles')
            .update({
              credits_balance: 100,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.user_id)
          
          // 记录积分重置
          await supabase
            .from('credit_logs')
            .insert({
              user_id: user.user_id,
              action_type: 'daily_reset',
              credits_change: 100 - user.credits_balance,
              balance_after: 100,
              description: 'Daily credits reset',
            })
        }
      })

      await Promise.all(updatePromises)

      return NextResponse.json({
        success: true,
        resetCount: freeUsers.length,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Credits reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}