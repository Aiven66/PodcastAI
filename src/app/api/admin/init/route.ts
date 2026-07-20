import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 管理员初始化 API - 仅用于首次设置管理员账号
export async function POST(request: Request) {
  try {
    // 使用 service role key 创建用户（绕过 RLS）
    const supabaseUrl = process.env.COZE_SUPABASE_URL!
    const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Supabase configuration not found' 
      }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // 检查管理员是否已存在
    const { data: existingUsers, error: checkError } = await supabase.auth.admin.listUsers()
    
    if (checkError) {
      console.error('Error checking users:', checkError)
      return NextResponse.json({ 
        error: 'Failed to check existing users',
        details: checkError.message 
      }, { status: 500 })
    }
    
    const adminExists = existingUsers.users.some(u => u.email === 'admin@126.com')
    
    if (adminExists) {
      // 确保管理员角色已设置
      const adminUser = existingUsers.users.find(u => u.email === 'admin@126.com')
      
      if (adminUser) {
        // 更新 profiles 表中的角色
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            user_id: adminUser.id,
            email: adminUser.email,
            name: 'Admin',
            role: 'admin',
            credits_balance: 999999,
            subscription_tier: 'pro',
            updated_at: new Date().toISOString()
          })
        
        if (updateError) {
          console.error('Error updating admin profile:', updateError)
        }
        
        return NextResponse.json({ 
          success: true,
          message: 'Admin user already exists, role updated',
          user: { id: adminUser.id, email: adminUser.email, role: 'admin' }
        })
      }
    }
    
    // 创建管理员用户
    const { data: newAdmin, error: createError } = await supabase.auth.admin.createUser({
      email: 'admin@126.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        name: 'Admin',
        role: 'admin'
      }
    })
    
    if (createError) {
      console.error('Error creating admin:', createError)
      return NextResponse.json({ 
        error: 'Failed to create admin user',
        details: createError.message 
      }, { status: 500 })
    }
    
    if (!newAdmin.user) {
      return NextResponse.json({
        error: 'Failed to create admin user - no user returned'
      }, { status: 500 })
    }

    // 在 profiles 表中创建管理员记录
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: newAdmin.user.id,
        email: newAdmin.user.email,
        name: 'Admin',
        role: 'admin',
        credits_balance: 999999,
        subscription_tier: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Error creating admin profile:', profileError)
      // 不影响主流程，用户已创建
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: newAdmin.user.id,
        email: newAdmin.user.email,
        role: 'admin'
      }
    })
    
  } catch (error) {
    console.error('Admin init error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET 方法用于检查管理员状态
export async function GET() {
  try {
    const supabaseUrl = process.env.COZE_SUPABASE_URL!
    const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Supabase configuration not found' 
      }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    const { data: users, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      return NextResponse.json({ 
        error: 'Failed to list users',
        details: error.message 
      }, { status: 500 })
    }
    
    const adminUser = users.users.find(u => u.email === 'admin@126.com')

    return NextResponse.json({
      adminExists: !!adminUser,
      adminEmail: adminUser?.email || 'admin@126.com',
      adminId: adminUser?.id || null
    })
    
  } catch (error) {
    console.error('Error checking admin:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}