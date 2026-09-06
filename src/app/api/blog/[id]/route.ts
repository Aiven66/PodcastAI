import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { requireBlogAuthor, fetchBlogRow } from '@/lib/blog-server'

// 获取博客详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient()
    const { id: blogId } = await params
    
    const { data: blog, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single()
    
    if (error) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ blog })

  } catch (error) {
    console.error('Blog fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/blog/[id] — 删除博客（根帖 + 全部翻译）。
 *
 * 契约来源：packages/blog/client.ts deleteBlogPost
 *   DELETE + Bearer → 2xx（客户端仅检查 res.ok），失败 { error } + 4xx/5xx。
 *
 * 翻译行的 tags JSONB 含 { parent_id }，删除时一并清理。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireBlogAuthor(request)
  if (!guard.ok) return guard.response

  try {
    const { id: blogId } = await params
    if (!blogId) {
      return NextResponse.json({ error: 'Blog id is required' }, { status: 400 })
    }

    const row = await fetchBlogRow(guard.author.client, blogId)
    if (!row) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    const authorId = (row.author_id as string) || ''
    if (!guard.author.isAdmin && guard.author.userId !== authorId) {
      return NextResponse.json(
        { error: 'Forbidden: not the post author' },
        { status: 403 }
      )
    }

    // 先删全部翻译行（tags 包含 parent_id 指向本帖），再删根帖。
    const { error: txError } = await guard.author.client
      .from('blogs')
      .delete()
      .contains('tags', { parent_id: blogId })
    if (txError) throw new Error(txError.message)

    const { error } = await guard.author.client.from('blogs').delete().eq('id', blogId)
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Blog delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
