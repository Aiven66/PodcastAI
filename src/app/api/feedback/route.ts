import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 用户反馈API - 支持匿名提交
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, category, message, email } = body
    
    // 验证必填字段
    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      )
    }
    
    // 从header获取session token（可选）
    const sessionToken = request.headers.get('x-session')
    
    let userId: string | null = null
    
    if (sessionToken) {
      try {
        const supabase = getSupabaseClient(sessionToken)
        const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)
        
        if (!authError && user) {
          userId = user.id
        }
      } catch {
        // 忽略认证错误，继续处理匿名反馈
      }
    }

    // 使用 anon key 创建客户端（RLS 已配置允许匿名插入）
    const supabase = getSupabaseClient()
    
    const { error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        user_id: userId,
        email: email || null,
        subject: subject,
        category: category || 'general',
        message: message,
        status: 'pending',
      })

    if (insertError) {
      console.error('Feedback insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit feedback', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 获取用户反馈列表（需要认证）
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('x-session')
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session token' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseClient(sessionToken)
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const { data: feedbacks, error: fetchError } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch feedbacks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ feedbacks })

  } catch (error) {
    console.error('Feedback fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}