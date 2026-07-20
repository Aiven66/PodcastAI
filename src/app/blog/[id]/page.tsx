'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Calendar } from 'lucide-react'
import { useSupabase } from '@/components/supabase-provider'
import { useLocale } from '@/components/locale-provider'
import { format } from 'date-fns'

interface Blog {
  id: string
  title: string
  category: string
  content: string
  excerpt: string
  cover_image: string
  created_at: string
}

function BlogDetailContent() {
  const params = useParams()
  const router = useRouter()
  const { supabase } = useSupabase()
  const { locale } = useLocale()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!supabase) return
    setInitialized(true)
    fetchBlog()
  }, [params.id, supabase])

  const fetchBlog = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (error) throw error
      setBlog(data)
    } catch (error) {
      console.error('Failed to fetch blog:', error)
    } finally {
      setLoading(false)
    }
  }

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{t('Blog not found', '博客不存在')}</p>
          <Button onClick={() => router.push('/blog')}>
            {t('Back to Blog', '返回博客列表')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <article className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link href="/blog" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          {t('Back to Blog', '返回博客列表')}
        </Link>

        {/* Cover Image */}
        {blog.cover_image && (
          <div className="aspect-video rounded-lg overflow-hidden mb-8">
            <img 
              src={blog.cover_image}
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="space-y-4 mb-8">
          <Badge variant="secondary">{blog.category}</Badge>
          <h1 className="text-4xl font-bold leading-tight">{blog.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(blog.created_at), 'PPP')}
            </div>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-6">
            <div 
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-12 flex justify-center">
          <Button variant="outline" onClick={() => router.push('/blog')}>
            {t('View All Posts', '查看所有文章')}
          </Button>
        </div>
      </article>
    </div>
  )
}

export default function BlogDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <BlogDetailContent />
    </Suspense>
  )
}