'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  Users,
  Headphones,
  Zap,
  Crown,
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  Search,
  DollarSign,
  BarChart3,
  Mic2,
  Activity,
  LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'
import {
  useCredits,
  ADMIN_DAILY_CREDITS,
  DAILY_FREE_CREDITS,
} from '@/hooks/use-credits'
import { format } from 'date-fns'

// ============= Types =============
interface RegisteredUser {
  id: string
  email: string
  password: string
  name: string
}

interface UserRow {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  credits: number
  joinedAt: string
  isSystemAdmin: boolean
}

interface BlogItem {
  id: string
  title: string
  category: string
  excerpt: string
  content: string
  cover_image: string
  created_at: string
}

interface PodcastHistoryItem {
  podcastId: string
  title: string
  podcastType: 'single' | 'dual'
  engine?: string
  createdAt?: number
  [key: string]: unknown
}

interface VoiceCloneItem {
  id: string
  name: string
  gender?: string
  audioUrl?: string
  status?: string
}

// ============= Constants =============
const DEMO_REGISTERED_USERS_KEY = 'podcastai_registered_users'
const PODCAST_HISTORY_KEY = 'podcastHistory'
const ADMIN_BLOGS_KEY = 'admin_blogs'
const ADMIN_EMAIL = 'admin@126.com'

const BLOG_CATEGORIES: ReadonlyArray<{ id: string; name: string; nameZh: string }> = [
  { id: 'podcast-tips', name: 'Podcast Tips', nameZh: '播客技巧' },
  { id: 'ai-tools', name: 'AI Tools', nameZh: 'AI工具' },
  { id: 'voice-cloning', name: 'Voice Cloning', nameZh: '声音克隆' },
  { id: 'news', name: 'News', nameZh: '新闻' },
  { id: 'tutorials', name: 'Tutorials', nameZh: '教程' },
]

interface SubscriptionPlan {
  id: string
  name: string
  nameZh: string
  price: string
  credits: string
  features: string
  featuresZh: string
}

const SUBSCRIPTION_PLANS: ReadonlyArray<SubscriptionPlan> = [
  {
    id: 'free',
    name: 'Free',
    nameZh: '免费',
    price: '$0',
    credits: '100/day',
    features: '100 daily credits, Basic voices, Single host podcasts',
    featuresZh: '每日100积分, 基础声音, 单人主持播客',
  },
  {
    id: 'basic',
    name: 'Basic',
    nameZh: '基础',
    price: '$9.99/mo',
    credits: '500',
    features: '500 credits/month, All basic voices, Dual host podcasts',
    featuresZh: '每月500积分, 所有基础声音, 双人主持播客',
  },
  {
    id: 'pro',
    name: 'Pro',
    nameZh: '专业',
    price: '$29.99/mo',
    credits: '2000',
    features: '2000 credits/month, Voice cloning, Priority support',
    featuresZh: '每月2000积分, 声音克隆, 优先支持',
  },
]

// ============= Helpers =============
function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function formatIsoDate(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm')
  } catch {
    return '-'
  }
}

function joinDateFromUserId(id: string): string {
  // Demo user IDs are formatted as `demo-{Date.now()}`
  const match = /^demo-(\d+)$/.exec(id)
  if (match) {
    const ts = parseInt(match[1], 10)
    if (!Number.isNaN(ts)) {
      return format(new Date(ts), 'yyyy-MM-dd HH:mm')
    }
  }
  return '-'
}

// ============= Component =============
export default function AdminPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { locale } = useLocale()
  const { balance } = useCredits()
  const t = useCallback((en: string, zh: string) => (locale === 'en' ? en : zh), [locale])

  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [initialized, setInitialized] = useState(false)

  // Data
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([])
  const [podcastHistory, setPodcastHistory] = useState<PodcastHistoryItem[]>([])
  const [voiceClones, setVoiceClones] = useState<VoiceCloneItem[]>([])
  const [blogs, setBlogs] = useState<BlogItem[]>([])

  // Users tab
  const [searchQuery, setSearchQuery] = useState('')

  // Blog form
  const [blogForm, setBlogForm] = useState({
    title: '',
    category: 'podcast-tips',
    excerpt: '',
    content: '',
    cover_image: '',
  })
  const [editingBlog, setEditingBlog] = useState<BlogItem | null>(null)
  const [showBlogForm, setShowBlogForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // ============= Access Control + Initial Load =============
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.email !== ADMIN_EMAIL && user.role !== 'admin') {
      router.push('/console')
      return
    }
    void loadData()
    setInitialized(true)
  }, [user, loading, router])

  const loadData = async () => {
    if (typeof window === 'undefined') return

    // Registered users
    const usersRaw = localStorage.getItem(DEMO_REGISTERED_USERS_KEY)
    setRegisteredUsers(safeParseArray<RegisteredUser>(usersRaw))

    // Podcast history
    const podcastRaw = localStorage.getItem(PODCAST_HISTORY_KEY)
    setPodcastHistory(safeParseArray<PodcastHistoryItem>(podcastRaw))

    // Blogs
    const blogsRaw = localStorage.getItem(ADMIN_BLOGS_KEY)
    setBlogs(safeParseArray<BlogItem>(blogsRaw))

    // Voice clones via API (best-effort, demo mode may return empty)
    try {
      const response = await fetch('/api/voice/clone', {
        headers: { 'x-session': 'demo-token' },
      })
      if (response.ok) {
        const data = (await response.json()) as { voiceClones?: VoiceCloneItem[] }
        setVoiceClones(Array.isArray(data.voiceClones) ? data.voiceClones : [])
      }
    } catch {
      setVoiceClones([])
    }
  }

  // ============= Derived Data =============
  const userRows: UserRow[] = useMemo(() => {
    const adminRow: UserRow = {
      id: 'demo-admin-id',
      email: ADMIN_EMAIL,
      name: 'Admin',
      role: 'admin',
      credits: ADMIN_DAILY_CREDITS,
      joinedAt: '-',
      isSystemAdmin: true,
    }
    const otherRows: UserRow[] = registeredUsers
      .filter(u => u.email.toLowerCase() !== ADMIN_EMAIL)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: 'user',
        credits: DAILY_FREE_CREDITS,
        joinedAt: joinDateFromUserId(u.id),
        isSystemAdmin: false,
      }))
    return [adminRow, ...otherRows]
  }, [registeredUsers])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return userRows
    return userRows.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q),
    )
  }, [userRows, searchQuery])

  const totalUsers = userRows.length
  const totalPodcasts = podcastHistory.length
  const totalCreditsUsed = totalPodcasts * 100 // Simulated: 100 credits per podcast

  // Behavior stats
  const singleCount = useMemo(
    () => podcastHistory.filter(p => p.podcastType === 'single').length,
    [podcastHistory],
  )
  const dualCount = useMemo(
    () => podcastHistory.filter(p => p.podcastType === 'dual').length,
    [podcastHistory],
  )

  const engineStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of podcastHistory) {
      const key = p.engine || 'unknown'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [podcastHistory])

  const voiceCloneGenderStats = useMemo(() => {
    const male = voiceClones.filter(
      v => v.gender === 'Male' || v.gender === 'male',
    ).length
    const female = voiceClones.filter(
      v => v.gender === 'Female' || v.gender === 'female',
    ).length
    const unknown = voiceClones.length - male - female
    return { male, female, unknown, total: voiceClones.length }
  }, [voiceClones])

  const todayCreditsUsed = Math.max(0, ADMIN_DAILY_CREDITS - balance)

  // ============= User Actions =============
  const handleDeleteUser = (row: UserRow) => {
    if (row.isSystemAdmin) return
    if (
      !confirm(
        t(
          `Delete user "${row.email}"? This cannot be undone.`,
          `确定删除用户 "${row.email}"？此操作不可撤销。`,
        ),
      )
    )
      return
    const updated = registeredUsers.filter(u => u.id !== row.id)
    setRegisteredUsers(updated)
    try {
      localStorage.setItem(
        DEMO_REGISTERED_USERS_KEY,
        JSON.stringify(updated),
      )
    } catch {
      // ignore write errors
    }
  }

  // ============= Blog Actions =============
  const resetBlogForm = () => {
    setBlogForm({
      title: '',
      category: 'podcast-tips',
      excerpt: '',
      content: '',
      cover_image: '',
    })
    setEditingBlog(null)
    setShowBlogForm(false)
  }

  const handleSaveBlog = () => {
    if (!blogForm.title.trim() || !blogForm.content.trim()) {
      setMessage({
        type: 'error',
        text: t('Title and content are required', '标题和内容必填'),
      })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const now = new Date().toISOString()
      let updated: BlogItem[]
      if (editingBlog) {
        updated = blogs.map(b =>
          b.id === editingBlog.id
            ? {
                ...b,
                title: blogForm.title,
                category: blogForm.category,
                excerpt: blogForm.excerpt,
                content: blogForm.content,
                cover_image: blogForm.cover_image,
              }
            : b,
        )
        setMessage({
          type: 'success',
          text: t('Blog updated successfully', '博客更新成功'),
        })
      } else {
        const newBlog: BlogItem = {
          id: `blog-${Date.now()}`,
          title: blogForm.title,
          category: blogForm.category,
          excerpt: blogForm.excerpt,
          content: blogForm.content,
          cover_image: blogForm.cover_image,
          created_at: now,
        }
        updated = [newBlog, ...blogs]
        setMessage({
          type: 'success',
          text: t('Blog created successfully', '博客创建成功'),
        })
      }
      setBlogs(updated)
      try {
        localStorage.setItem(ADMIN_BLOGS_KEY, JSON.stringify(updated))
      } catch {
        // ignore write errors
      }
      resetBlogForm()
    } catch {
      setMessage({ type: 'error', text: t('Failed to save blog', '保存失败') })
    } finally {
      setSaving(false)
    }
  }

  const handleEditBlog = (blog: BlogItem) => {
    setEditingBlog(blog)
    setBlogForm({
      title: blog.title,
      category: blog.category,
      excerpt: blog.excerpt || '',
      content: blog.content || '',
      cover_image: blog.cover_image || '',
    })
    setShowBlogForm(true)
    setMessage(null)
  }

  const handleDeleteBlog = (blogId: string) => {
    if (
      !confirm(
        t('Are you sure you want to delete this blog?', '确定要删除这篇博客吗？'),
      )
    )
      return
    const updated = blogs.filter(b => b.id !== blogId)
    setBlogs(updated)
    try {
      localStorage.setItem(ADMIN_BLOGS_KEY, JSON.stringify(updated))
    } catch {
      // ignore write errors
    }
    if (editingBlog?.id === blogId) {
      resetBlogForm()
    }
  }

  // ============= Render =============
  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              {t('Admin Dashboard', '管理后台')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t(
                'Manage your website content, users and settings',
                '管理网站内容、用户和设置',
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/console')}>
            {t('Back to Console', '返回控制台')}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('Dashboard', '仪表板')}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              {t('Users', '用户管理')}
            </TabsTrigger>
            <TabsTrigger value="payments">
              <DollarSign className="h-4 w-4 mr-2" />
              {t('Payments', '付费管理')}
            </TabsTrigger>
            <TabsTrigger value="blogs">
              <FileText className="h-4 w-4 mr-2" />
              {t('Blogs', '博客管理')}
            </TabsTrigger>
            <TabsTrigger value="behavior">
              <Activity className="h-4 w-4 mr-2" />
              {t('Behavior', '行为数据')}
            </TabsTrigger>
          </TabsList>

          {/* ============= Dashboard Tab ============= */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Total Users', '总用户数')}
                  </CardTitle>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Registered accounts', '已注册账号')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Total Podcasts', '总播客数')}
                  </CardTitle>
                  <Headphones className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalPodcasts}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Podcasts generated', '已生成播客')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Total Credits Used', '总积分消耗')}
                  </CardTitle>
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalCreditsUsed}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Estimated usage', '估算使用量')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Active Subscriptions', '活跃订阅')}
                  </CardTitle>
                  <Crown className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Demo mode - no real subscriptions', '演示模式 - 无真实订阅')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('System Overview', '系统概览')}</CardTitle>
                <CardDescription>
                  {t(
                    'Current admin credits balance and demo mode status',
                    '当前管理员积分余额与演示模式状态',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('Admin Daily Quota', '管理员每日额度')}
                  </span>
                  <Badge variant="secondary">{ADMIN_DAILY_CREDITS}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('Current Balance', '当前余额')}
                  </span>
                  <Badge variant="default">{balance}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('Voice Clones', '声音克隆')}
                  </span>
                  <Badge variant="outline">{voiceClones.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('Blogs Published', '已发布博客')}
                  </span>
                  <Badge variant="outline">{blogs.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============= Users Tab ============= */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('User Management', '用户管理')}</CardTitle>
                <CardDescription>
                  {t(
                    'View and manage registered users',
                    '查看和管理已注册用户',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('Search by email or name...', '按邮箱或姓名搜索...')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {t('No users found.', '未找到用户。')}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Name', '姓名')}</TableHead>
                          <TableHead>{t('Email', '邮箱')}</TableHead>
                          <TableHead>{t('Role', '角色')}</TableHead>
                          <TableHead>{t('Credits', '积分')}</TableHead>
                          <TableHead>{t('Joined Date', '注册时间')}</TableHead>
                          <TableHead className="text-right">
                            {t('Actions', '操作')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.email}</TableCell>
                            <TableCell>
                              {row.role === 'admin' ? (
                                <Badge variant="default">
                                  <Crown className="h-3 w-3 mr-1" />
                                  {t('Admin', '管理员')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {t('User', '普通用户')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{row.credits}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {row.joinedAt}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={row.isSystemAdmin}
                                onClick={() => handleDeleteUser(row)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t('Delete', '删除')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============= Payments Tab ============= */}
          <TabsContent value="payments" className="space-y-6">
            {/* Revenue Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Total Revenue', '总收入')}
                  </CardTitle>
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">$0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Demo mode - no real revenue', '演示模式 - 无真实收入')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Active Subscriptions', '活跃订阅')}
                  </CardTitle>
                  <Crown className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('No active subscriptions', '暂无活跃订阅')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    {t('Credits Sold', '已售积分')}
                  </CardTitle>
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('No paid credits yet', '暂无付费积分')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Subscription Plans */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Subscription Plans', '订阅方案')}</CardTitle>
                <CardDescription>
                  {t(
                    'Available subscription tiers',
                    '可用的订阅方案配置',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Plan Name', '方案名称')}</TableHead>
                        <TableHead>{t('Price', '价格')}</TableHead>
                        <TableHead>{t('Credits', '积分')}</TableHead>
                        <TableHead>{t('Features', '功能')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {SUBSCRIPTION_PLANS.map(plan => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {plan.id === 'pro' ? (
                                <Crown className="h-4 w-4 text-amber-500" />
                              ) : plan.id === 'basic' ? (
                                <Zap className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Users className="h-4 w-4 text-muted-foreground" />
                              )}
                              {t(plan.name, plan.nameZh)}
                            </div>
                          </TableCell>
                          <TableCell>{plan.price}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{plan.credits}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md">
                            {t(plan.features, plan.featuresZh)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Payment Records */}
            <Card>
              <CardHeader>
                <CardTitle>{t('Payment Records', '支付记录')}</CardTitle>
                <CardDescription>
                  {t('Recent payment transactions', '最近的支付交易')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {t(
                      'No payment records available in demo mode.',
                      '演示模式下暂无支付记录。',
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============= Blogs Tab ============= */}
          <TabsContent value="blogs" className="space-y-6">
            {message && (
              <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            {/* Blog Form */}
            {showBlogForm && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingBlog
                      ? t('Edit Blog', '编辑博客')
                      : t('Create New Blog', '创建新博客')}
                  </CardTitle>
                  <CardDescription>
                    {t('Fill in the details below', '填写以下详细信息')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="blog-title">{t('Title', '标题')}</Label>
                    <Input
                      id="blog-title"
                      value={blogForm.title}
                      onChange={e =>
                        setBlogForm(prev => ({ ...prev, title: e.target.value }))
                      }
                      placeholder={t('Blog title', '博客标题')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('Category', '分类')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {BLOG_CATEGORIES.map(cat => (
                        <Button
                          key={cat.id}
                          type="button"
                          size="sm"
                          variant={
                            blogForm.category === cat.id ? 'default' : 'outline'
                          }
                          onClick={() =>
                            setBlogForm(prev => ({ ...prev, category: cat.id }))
                          }
                        >
                          {t(cat.name, cat.nameZh)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog-excerpt">{t('Excerpt', '摘要')}</Label>
                    <Input
                      id="blog-excerpt"
                      value={blogForm.excerpt}
                      onChange={e =>
                        setBlogForm(prev => ({ ...prev, excerpt: e.target.value }))
                      }
                      placeholder={t('Short description', '简短描述')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog-cover">{t('Cover Image URL', '封面图片URL')}</Label>
                    <Input
                      id="blog-cover"
                      value={blogForm.cover_image}
                      onChange={e =>
                        setBlogForm(prev => ({
                          ...prev,
                          cover_image: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blog-content">
                      {t('Content (HTML supported)', '内容（支持HTML）')}
                    </Label>
                    <Textarea
                      id="blog-content"
                      value={blogForm.content}
                      onChange={e =>
                        setBlogForm(prev => ({ ...prev, content: e.target.value }))
                      }
                      placeholder={t(
                        'Write your blog content here. HTML tags supported.',
                        '在此编写博客内容。支持 HTML 标签。',
                      )}
                      className="min-h-[240px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSaveBlog} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('Saving...', '保存中...')}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {t('Save Blog', '保存博客')}
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetBlogForm}>
                      {t('Cancel', '取消')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Blog List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{t('Published Blogs', '已发布博客')}</CardTitle>
                  <CardDescription>
                    {t(`${blogs.length} blog(s) total`, `共 ${blogs.length} 篇博客`)}
                  </CardDescription>
                </div>
                {!showBlogForm && (
                  <Button
                    onClick={() => {
                      resetBlogForm()
                      setShowBlogForm(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('New Blog', '新建博客')}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {blogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {t('No blogs published yet.', '暂无已发布博客。')}
                    </p>
                    {!showBlogForm && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetBlogForm()
                          setShowBlogForm(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('Create Your First Blog', '创建第一篇博客')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Title', '标题')}</TableHead>
                          <TableHead>{t('Category', '分类')}</TableHead>
                          <TableHead>{t('Created At', '创建时间')}</TableHead>
                          <TableHead className="text-right">
                            {t('Actions', '操作')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blogs.map(blog => {
                          const cat = BLOG_CATEGORIES.find(
                            c => c.id === blog.category,
                          )
                          return (
                            <TableRow key={blog.id}>
                              <TableCell className="font-medium max-w-xs">
                                <div className="truncate">{blog.title}</div>
                                {blog.excerpt && (
                                  <div className="text-xs text-muted-foreground truncate mt-1">
                                    {blog.excerpt}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {cat ? t(cat.name, cat.nameZh) : blog.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatIsoDate(blog.created_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditBlog(blog)}
                                    title={t('Edit', '编辑')}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteBlog(blog.id)}
                                    className="text-destructive hover:text-destructive"
                                    title={t('Delete', '删除')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============= Behavior Tab ============= */}
          <TabsContent value="behavior" className="space-y-6">
            {/* Podcast Generation Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  {t('Podcast Generation Stats', '播客生成统计')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'Aggregate metrics from local podcast history',
                    '基于本地播客历史的汇总数据',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Total Generations', '总生成次数')}
                    </p>
                    <p className="text-3xl font-bold">{totalPodcasts}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Single Host', '单人主持')}
                    </p>
                    <p className="text-3xl font-bold">{singleCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Dual Host', '双人主持')}
                    </p>
                    <p className="text-3xl font-bold">{dualCount}</p>
                  </div>
                </div>

                {/* Type Distribution Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('Type Distribution', '类型分布')}
                    </span>
                    <span className="text-muted-foreground">
                      {totalPodcasts > 0
                        ? `${Math.round((dualCount / totalPodcasts) * 100)}% ${t('dual', '双主持人')}`
                        : '-'}
                    </span>
                  </div>
                  {totalPodcasts > 0 ? (
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-blue-500"
                        style={{
                          width: `${(singleCount / totalPodcasts) * 100}%`,
                        }}
                        title={t('Single Host', '单人主持')}
                      />
                      <div
                        className="bg-purple-500"
                        style={{
                          width: `${(dualCount / totalPodcasts) * 100}%`,
                        }}
                        title={t('Dual Host', '双人主持')}
                      />
                    </div>
                  ) : (
                    <Progress value={0} />
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                      {t('Single', '单人')}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                      {t('Dual', '双人')}
                    </span>
                  </div>
                </div>

                {/* Engine Distribution */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('Engine Distribution', '引擎分布')}
                  </p>
                  {engineStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      {t('No data available', '暂无数据')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {engineStats.map(stat => {
                        const percent =
                          totalPodcasts > 0
                            ? Math.round((stat.count / totalPodcasts) * 100)
                            : 0
                        return (
                          <div key={stat.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{stat.name}</span>
                              <span className="text-muted-foreground">
                                {stat.count} ({percent}%)
                              </span>
                            </div>
                            <Progress value={percent} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Voice Clone Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="h-5 w-5" />
                  {t('Voice Clone Stats', '声音克隆统计')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'Aggregated data from voice clone service',
                    '声音克隆服务汇总数据',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Total Clones', '总克隆数')}
                    </p>
                    <p className="text-3xl font-bold">
                      {voiceCloneGenderStats.total}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Male', '男声')}
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {voiceCloneGenderStats.male}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Female', '女声')}
                    </p>
                    <p className="text-3xl font-bold text-pink-600">
                      {voiceCloneGenderStats.female}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Unknown', '未知')}
                    </p>
                    <p className="text-3xl font-bold text-muted-foreground">
                      {voiceCloneGenderStats.unknown}
                    </p>
                  </div>
                </div>

                {voiceClones.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Name', '名称')}</TableHead>
                          <TableHead>{t('Gender', '性别')}</TableHead>
                          <TableHead>{t('Status', '状态')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {voiceClones.map(vc => (
                          <TableRow key={vc.id}>
                            <TableCell className="font-medium">{vc.name}</TableCell>
                            <TableCell>
                              {vc.gender ? (
                                <Badge variant="outline">{vc.gender}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {vc.status || 'completed'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {voiceClones.length === 0 && (
                  <div className="text-center py-8">
                    <Mic2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'No voice clones found in demo mode.',
                        '演示模式下暂无声音克隆数据。',
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credits Usage Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {t('Credits Usage Trend', '积分使用趋势')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'Daily credits usage of current admin session',
                    '当前管理员会话的每日积分使用情况',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Today Used', '今日已用')}
                    </p>
                    <p className="text-3xl font-bold">{todayCreditsUsed}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Today Remaining', '今日剩余')}
                    </p>
                    <p className="text-3xl font-bold text-green-600">{balance}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t('Daily Quota', '每日额度')}
                    </p>
                    <p className="text-3xl font-bold">{ADMIN_DAILY_CREDITS}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('Usage Progress', '使用进度')}
                    </span>
                    <span className="text-muted-foreground">
                      {ADMIN_DAILY_CREDITS > 0
                        ? `${Math.round(
                            (todayCreditsUsed / ADMIN_DAILY_CREDITS) * 100,
                          )}%`
                        : '0%'}
                    </span>
                  </div>
                  <Progress
                    value={
                      ADMIN_DAILY_CREDITS > 0
                        ? (todayCreditsUsed / ADMIN_DAILY_CREDITS) * 100
                        : 0
                    }
                  />
                </div>

                <p className="text-xs text-muted-foreground italic">
                  {t(
                    'Note: In demo mode, credits usage is tracked only for the current admin session via localStorage.',
                    '注意：演示模式下，积分使用仅针对当前管理员会话通过 localStorage 跟踪。',
                  )}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
