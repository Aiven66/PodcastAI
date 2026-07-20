import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 支付webhook处理（Stripe/PayPal回调）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, planId, paymentId, paymentMethod } = body
    
    // 验证支付（实际应用中需要验证webhook签名）
    // 这里简化处理，假设支付成功
    
    const supabase = getSupabaseClient()
    
    // 获取方案配置
    const planCredits: Record<string, number> = {
      basic: 500,
      pro: 2000,
    }
    
    const credits = planCredits[planId] || 0
    
    // 获取用户当前profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (profileError) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 更新用户订阅状态
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: planId,
        credits_balance: profile.credits_balance + credits,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      )
    }

    // 创建订阅记录
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        payment_id: paymentId,
        payment_method: paymentMethod,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后
      })
    
    if (subscriptionError) {
      console.error('Failed to create subscription record:', subscriptionError)
    }

    // 记录积分变更
    await supabase
      .from('credit_logs')
      .insert({
        user_id: userId,
        action_type: 'subscription',
        credits_change: credits,
        balance_after: profile.credits_balance + credits,
        description: `Subscribed to ${planId} plan`,
      })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Payment webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}