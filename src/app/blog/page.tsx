'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, ArrowRight, Loader2 } from 'lucide-react'
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

export default function BlogPage() {
  const { supabase } = useSupabase()
  const { locale } = useLocale()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!supabase) return
    setInitialized(true)
    fetchBlogs()
  }, [supabase])

  const fetchBlogs = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setBlogs(data || [])
    } catch (error) {
      console.error('Failed to fetch blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const categories = [
    { id: 'all', name: 'All', nameZh: '全部' },
    { id: 'podcast-tips', name: 'Podcast Tips', nameZh: '播客技巧' },
    { id: 'ai-tools', name: 'AI Tools', nameZh: 'AI工具' },
    { id: 'voice-cloning', name: 'Voice Cloning', nameZh: '声音克隆' },
    { id: 'news', name: 'News', nameZh: '新闻' },
  ]

  const [selectedCategory, setSelectedCategory] = useState('all')

  const filteredBlogs = selectedCategory === 'all' 
    ? blogs 
    : blogs.filter(blog => blog.category === selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            {t('Blog', '博客')}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {t('Latest Articles', '最新文章')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              'Explore tips, tutorials, and news about AI podcast creation',
              '探索AI播客创作的技巧、教程和新闻'
            )}
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {locale === 'en' ? cat.name : cat.nameZh}
            </Button>
          ))}
        </div>

        {/* Blog Grid */}
        {filteredBlogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {t('No articles found', '暂无文章')}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlogs.map((blog) => (
              <Card key={blog.id} className="group hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                  {blog.cover_image ? (
                    <img 
                      src={blog.cover_image} 
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {t('No Image', '暂无图片')}
                    </div>
                  )}
                </div>
                <CardHeader>
                  <Badge variant="secondary" className="mb-2">
                    {blog.category}
                  </Badge>
                  <CardTitle className="line-clamp-2">{blog.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {blog.excerpt || blog.content.slice(0, 100)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(blog.created_at), 'MMM d, yyyy')}
                  </div>
                  <Link href={`/blog/${blog.id}`}>
                    <Button variant="ghost" size="sm">
                      {t('Read', '阅读')} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}