import { NextRequest, NextResponse } from 'next/server'
import { LLMClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk'
import { mapBlogRow, requireBlogAuthor } from '@/lib/blog-server'

/**
 * POST /api/blog/auto-category — 按文章内容自动提炼分类。
 *
 * 契约来源：packages/blog/client.ts autoCategorizeBlogPost / autoCategorizeBlogPosts
 *   body: { mode: 'single', title?, content }  → { category: string }
 *   body: { mode: 'all' }                       → { updated: number, total: number }
 *   + Bearer → 以上；失败 { error }。
 *
 * 策略（混合）：优先调用 coze LLM（语义理解、质量高），调用失败或未配置时
 * 回退到关键词规则。两者共用同一套预设分类词表，保证分类一致性。
 * 'all' 模式为管理员专属，仅为「空分类或分类为默认值」的文章补全分类，
 * 不覆盖人工填写的分类。
 */

// ── 预设分类词表（中英双语，LLM 与关键词规则共用） ──────────────
interface CategoryDef {
  zh: string
  en: string
  keywords: string[]
}

const CATEGORY_SET: CategoryDef[] = [
  {
    zh: '产品更新',
    en: 'Product Update',
    keywords: ['release', 'update', 'feature', 'version', 'changelog', 'roadmap', '发布', '更新', '新功能', '版本', '上线'],
  },
  {
    zh: '教程指南',
    en: 'Tutorial',
    keywords: ['how to', 'guide', 'tutorial', 'setup', 'install', 'step', 'walkthrough', '教程', '指南', '如何', '安装', '配置', '上手'],
  },
  {
    zh: 'AI 技术',
    en: 'AI Technology',
    keywords: ['ai', 'model', 'llm', 'voice', 'clone', 'speech', 'tts', 'neural', 'algorithm', '算法', '模型', '语音', '克隆', '合成', '技术', '数字人'],
  },
  {
    zh: '行业洞察',
    en: 'Industry Insight',
    keywords: ['market', 'industry', 'trend', 'analysis', 'future', 'insight', 'report', '市场', '行业', '趋势', '分析', '洞察', '报告'],
  },
  {
    zh: '用户案例',
    en: 'Case Study',
    keywords: ['case study', 'customer', 'user story', 'success', 'workflow', '案例', '客户', '用户故事', '实践', '经验'],
  },
  {
    zh: '新闻动态',
    en: 'News',
    keywords: ['news', 'announce', 'event', 'launch', 'company', '新闻', '动态', '公告', '活动', '发布会'],
  },
]

const DEFAULT_ZH = '新闻动态'
const DEFAULT_EN = 'News'

/** 内容是否以中文为主（CJK 字符占比判定）。 */
function detectZh(text: string): boolean {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return cjk >= 10 || cjk > text.length * 0.05
}

/** 关键词打分：标题命中权重更高，返回得分最高的分类。 */
function categorizeByKeywords(title: string, content: string, isZh: boolean): string {
  const haystackTitle = (title || '').toLowerCase()
  const haystackBody = (content || '').toLowerCase()
  let best: CategoryDef | null = null
  let bestScore = 0

  for (const def of CATEGORY_SET) {
    let score = 0
    for (const kw of def.keywords) {
      const k = kw.toLowerCase()
      if (haystackTitle.includes(k)) score += 3
      const matches = haystackBody.split(k).length - 1
      if (matches > 0) score += Math.min(matches, 3)
    }
    if (score > bestScore) {
      bestScore = score
      best = def
    }
  }

  if (!best || bestScore === 0) return isZh ? DEFAULT_ZH : DEFAULT_EN
  return isZh ? best.zh : best.en
}

/** 把 LLM 返回的自由文本匹配到预设分类；无法匹配返回 null。 */
function matchCategory(raw: string, isZh: boolean): string | null {
  const text = (raw || '').trim().toLowerCase()
  if (!text) return null
  for (const def of CATEGORY_SET) {
    if (text.includes(def.en.toLowerCase()) || text.includes(def.zh)) {
      return isZh ? def.zh : def.en
    }
  }
  return null
}

/** 尝试 LLM 分类；不可用或失败时返回 null（由调用方回退关键词）。 */
async function categorizeByLLM(
  request: NextRequest,
  title: string,
  content: string,
  isZh: boolean,
): Promise<string | null> {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
    const llmClient = new LLMClient(new Config(), customHeaders)

    const allowed = CATEGORY_SET.map((c) => (isZh ? c.zh : c.en)).join(' / ')
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是内容分类助手。请从下列分类中为文章选择唯一最贴切的一个，只输出分类名称本身，不要任何解释或标点：${allowed}。若都不合适，输出「${isZh ? DEFAULT_ZH : DEFAULT_EN}」。`,
      },
      {
        role: 'user',
        content: `标题：${title || '(无)'}\n正文摘要：\n${content.slice(0, 4000)}`,
      },
    ]

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.2,
    })
    return matchCategory(response.content || '', isZh)
  } catch {
    return null
  }
}

/** 单篇分类：LLM 优先，失败回退关键词。 */
async function categorizeOne(
  request: NextRequest,
  title: string,
  content: string,
): Promise<string> {
  const isZh = detectZh(`${title} ${content}`)
  const viaLlm = await categorizeByLLM(request, title, content, isZh)
  if (viaLlm) return viaLlm
  return categorizeByKeywords(title, content, isZh)
}

export async function POST(request: NextRequest) {
  const guard = await requireBlogAuthor(request)
  if (!guard.ok) return guard.response

  try {
    const body = (await request.json()) as {
      mode?: unknown
      title?: unknown
      content?: unknown
    }
    const mode = body.mode === 'all' ? 'all' : 'single'

    // ── 单篇：返回建议分类，不落库（编辑器内使用） ──
    if (mode === 'single') {
      const title = typeof body.title === 'string' ? body.title : ''
      const content = typeof body.content === 'string' ? body.content : ''
      if (!content.trim()) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 })
      }
      const category = await categorizeOne(request, title, content)
      return NextResponse.json({ category })
    }

    // ── 全部：管理员专属，为缺少分类的文章批量补全 ──
    if (!guard.author.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const { data, error } = await guard.author.client
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message)

    const rows = (data || []) as Record<string, unknown>[]
    // 仅根帖（非翻译行）：翻译行 tags 含 parent_id。
    const roots = rows
      .map((row) => mapBlogRow(row))
      .filter((post) => !post.parentId)

    // 仅补全「空分类」或「默认占位分类」的文章，不覆盖人工分类。
    const pending = roots.filter((post) => {
      const c = (post.category || '').trim()
      return !c || c === 'General'
    })

    let updated = 0
    for (const post of pending) {
      const category = await categorizeOne(request, post.title, post.content)
      const { error: updateError } = await guard.author.client
        .from('blogs')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('id', post.id)
      if (!updateError) updated += 1
    }

    return NextResponse.json({ updated, total: roots.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to auto-categorize' },
      { status: 500 },
    )
  }
}