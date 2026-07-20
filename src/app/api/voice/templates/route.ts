import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 默认声音模板（Supabase 不可用时使用）
const defaultTemplates = [
  // 女声（普通话）
  { id: 'female-professional', name: 'Sarah 晓晓（专业女主播）', gender: 'female', style: 'professional', preview_url: '' },
  { id: 'female-friendly', name: 'Emma 晓伊（友好亲切）', gender: 'female', style: 'friendly', preview_url: '' },
  // 女声（方言特色）
  { id: 'female-northeast', name: 'Beibei 小北（东北话）', gender: 'female', style: 'northeast', preview_url: '' },
  { id: 'female-shaanxi', name: 'Nini 小妮（陕西话）', gender: 'female', style: 'shaanxi', preview_url: '' },
  // 男声
  { id: 'male-narrator', name: 'David 云希（经典叙述）', gender: 'male', style: 'narrator', preview_url: '' },
  { id: 'male-deep', name: 'James 云健（低沉磁性）', gender: 'male', style: 'deep', preview_url: '' },
  { id: 'male-sunny', name: 'Tom 云扬（阳光活力）', gender: 'male', style: 'sunny', preview_url: '' },
  { id: 'male-youth', name: 'Leo 云夏（青春少年）', gender: 'male', style: 'youth', preview_url: '' },
]

// 获取声音模板列表
export async function GET(request: NextRequest) {
  const sessionToken = request.headers.get('x-session')
  let userClones: any[] = []
  let systemTemplates: any[] = defaultTemplates

  // 尝试从 Supabase 获取系统模板（失败时使用默认模板）
  try {
    const supabase = getSupabaseClient(sessionToken ?? undefined)

    const { data: templates, error } = await supabase
      .from('voice_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (!error && templates && templates.length > 0) {
      systemTemplates = templates
    }

    // 如果有用户会话，也获取用户的克隆声音
    if (sessionToken) {
      try {
        const { data: { user } } = await supabase.auth.getUser(sessionToken)

        if (user) {
          const { data: clones } = await supabase
            .from('voice_clones')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .eq('clone_status', 'completed')
            .order('created_at', { ascending: false })

          userClones = (clones || []).map(clone => ({
            id: `clone-${clone.id}`,
            name: clone.name,
            gender: 'clone',
            style: 'user',
            preview_url: clone.sample_audio_url,
            voice_id: clone.voice_id,
            is_clone: true
          }))
        }
      } catch {
        // 忽略获取克隆声音的错误
      }
    }
  } catch (error) {
    // Supabase 未配置或不可用，使用默认模板
    console.warn('Supabase unavailable, using default templates:', error instanceof Error ? error.message : error)
  }

  // 合并系统模板和用户克隆声音
  return NextResponse.json({
    templates: systemTemplates,
    userClones: userClones
  })
}