import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 支付方案配置
const PLAN_CONFIG = {
  basic: {
    price: 9.99,
    credits: 500,
    stripePriceId: 'price_basic_monthly', // 需要在Stripe后台配置
    paypalPlanId: 'P-basic-monthly', // 需要在PayPal后台配置
  },
  pro: {
    price: 29.99,
    credits: 2000,
    stripePriceId: 'price_pro_monthly',
    paypalPlanId: 'P-pro-monthly',
  },
}

// 创建支付checkout session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { planId, locale, paymentMethod = 'stripe' } = body
    
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

    const plan = PLAN_CONFIG[planId as keyof typeof PLAN_CONFIG]
    
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // 根据支付方式创建checkout
    if (paymentMethod === 'paypal') {
      // PayPal checkout URL
      // 实际应用中需要调用PayPal API创建订单
      const paypalCheckoutUrl = `https://www.paypal.com/checkoutnow?token=demo_token&plan=${planId}&user=${user.id}`
      
      return NextResponse.json({
        checkoutUrl: paypalCheckoutUrl,
        paymentMethod: 'paypal',
      })
    } else {
      // Stripe checkout
      // 实际应用中需要调用Stripe API创建checkout session
      // 这里返回一个演示URL
      const stripeCheckoutUrl = `https://checkout.stripe.com/pay/demo_session_id#fid_demo`
      
      return NextResponse.json({
        checkoutUrl: stripeCheckoutUrl,
        paymentMethod: 'stripe',
      })
    }

  } catch (error) {
    console.error('Checkout creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}