import { NextRequest, NextResponse } from 'next/server'
import { LLMClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk'
import { randomUUID } from 'crypto'

// 从 HTML 中提取纯文本（保留段落结构，优先提取正文区域）
function extractTextFromHtml(html: string): string {
  // 优先提取微信文章正文区域（js_content / rich_media_content）
  // 避免提取导航栏、侧边栏、底部按钮等 UI 噪声
  let body = html
  const contentMatch =
    html.match(/<div[^>]+id="js_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|<div[^>]+class="rich_media_tool")/i) ||
    html.match(/<div[^>]+class="rich_media_content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|<div[^>]+class="rich_media_tool")/i) ||
    html.match(/<div[^>]+id="js_content"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div[^>]+class="rich_media_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (contentMatch) {
    body = contentMatch[1]
  }

  // 移除 script/style/nav/header/footer
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  body = body.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  body = body.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  body = body.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')

  // 块级元素转换为换行，保留段落结构
  body = body.replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, '\n')
  body = body.replace(/<br\s*\/?>/gi, '\n')
  body = body.replace(/<[^>]+>/g, ' ')

  // 解码 HTML 实体
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&apos;': "'", '—': '—', '…': '…',
  }
  for (const [entity, char] of Object.entries(entities)) {
    body = body.replace(new RegExp(entity, 'gi'), char)
  }
  body = body.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))

  // 按行处理，保留段落结构
  const lines = body
    .split('\n')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 0)

  return lines.join('\n')
}

// 从 URL 抓取内容
async function fetchContentFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    return extractTextFromHtml(html)
  } catch (error) {
    console.error('URL fetch error:', error)
    return ''
  }
}

// 使用 LLM 生成播客脚本
async function generatePodcastScript(
  contentText: string,
  podcastType: 'single' | 'dual',
  llmClient: LLMClient | null
): Promise<string> {
  if (llmClient) {
    try {
      const messages: Message[] = [
        {
          role: 'system',
          content: podcastType === 'dual'
            ? `你是一位顶级播客制作人，擅长创作《创业内幕》《忽左忽右》《随机波动》风格的高质量双人访谈节目。

请根据提供的内容，创作一段自然、有深度、有互动感的双人对话播客脚本。

【核心原则】
1. 对话感第一：绝对不能一个人说一大段（超过120字），必须有来有回，每轮说话控制在 30-100 字
2. 真实互动：主持人要会追问、插话、调侃、表示认同（"没错"、"太对了"、"我特别同意"、"等一下"、"你说到这我想起"）
3. 观点碰撞：两人可以有不同角度，不是简单的问答，而是真正的对话和讨论
4. 节奏变化：有轻松的寒暄，有深度的探讨，有共鸣的时刻，有意外的发现
5. 口语化表达：用"咱们"、"对吧"、"其实呢"、"怎么说呢"、"你知道吗"等口语词，不要书面语
6. 细节和故事：用具体的例子、个人感受、小故事来支撑观点，不要空泛的道理
7. 内容充实：深入挖掘每个要点，展开详细讨论，不要浅尝辄止

【时长要求】
- 目标时长 50-60 分钟（约 10000-15000 字）
- 对话轮数 40-60 轮，确保内容丰富、讨论深入

【结构参考】
- 开场（5-8轮）：轻松寒暄，介绍今天的话题，制造期待感
- 引入（5-8轮）：从一个有趣的切入点开始，慢慢进入主题，铺垫背景
- 主体讨论（30-50轮）：
  - 主持人抛出问题或观点
  - 嘉宾分享看法和经历，举例说明
  - 主持人追问、补充、提出不同角度
  - 两人碰撞、讨论、达成共识或保留分歧
  - 每个要点充分展开，深入讨论后再进入下一个
- 收尾（3-5轮）：总结核心观点，给听众留下思考，友好道别

【格式要求 - 必须严格遵守】
1. 使用 [主持人] 和 [嘉宾] 标记每轮对话，标记独占一行
2. 标记下一行是对话内容，每轮对话内容单独一行
3. 输出纯朗读文案，不要任何标题、说明、注释
4. 不要输出 "标题:"、"开场:"、"收尾:" 等结构标注
5. 正确格式示例：
[主持人]
嘿，欢迎收听本期播客。今天想跟你聊一个事儿。
[嘉宾]
嗯，这个我也注意到了，确实挺有意思的。

直接输出脚本内容，不要任何额外说明。`
            : `你是一位专业的播客脚本撰写人。请根据提供的内容，创建一段单人叙述风格的播客脚本。

【核心原则】
1. 输出纯朗读文案，适合直接用语音合成朗读
2. 不要包含 [主持人]、[嘉宾] 等角色标记
3. 不要包含标题、说明、注释、结构标注
4. 语言生动自然，口语化表达，适合语音播报
5. 结构清晰：开场引入 → 主体讲解 → 总结收尾
6. 保留原文的核心信息和观点，用口语化方式重新表述
7. 去除原文中的广告、引导关注、UI元素等无关内容
8. 内容充实：深入挖掘每个要点，展开详细讲解，举例说明，不要浅尝辄止

【时长要求】
- 目标时长 40-50 分钟（约 8000-12000 字）
- 确保内容丰富、讲解深入，像一档真正的长篇播客

【正确格式示例】
大家好，欢迎收听本期播客。今天想跟大家聊一个事儿，就是最近发生的一件挺有意思的事情。
说到这个，其实有几个点特别值得关注。
好了，今天就聊到这儿，我们下期再见！

直接输出朗读文案内容，不要任何额外说明、标题或标记。`,
        },
        {
          role: 'user',
          content: `请根据以下内容生成播客脚本：\n\n${contentText.slice(0, 20000)}`,
        },
      ]

      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.8,
      })

      return response.content || contentText
    } catch (error) {
      console.error('LLM script generation error:', error)
    }
  }

  // ═══ 降级：算法生成播客脚本（不依赖 LLM）═══
  // 核心思路：段落级噪声过滤 → 句子提取与去重 → 口语化播客风格重组

  // 1) 噪声关键词：整行匹配则丢弃该段落
  const NOISE_LINE_PATTERNS = [
    /^你说的完全正确/,      // 作者名
    /在小说阅读器/,        // 阅读器UI
    /^去阅读$/,
    /沉浸阅读/,
    /读本章/,
    /视频加载失败/,
    /请刷新页面/,
    /^刷新\s*$/,
    /点赞转发/,
    /记得关注/,
    /星标/,
    /轻点两下/,
    /取消赞|取消在看/,
    /^赞$/,
    /^在看$/,
    /^分享$/,
    /^留言$/,
    /^收藏$/,
    /^听过$/,
    /^原创$/,
    /^赞赏$/,
    /长按.*二维码/,
    /扫描.*关注/,
    /点击.*关注/,
    /欢迎.*关注/,
    /更多精彩/,
    /版权归原作者/,
    /本文.*首发/,
    /此文.*转载/,
    /每天都在更新/,
    /觉得文章还不错/,
    /附在文后|文末有|附在文末/,
    /^@[作作]者/,
    /AI寒武纪/,
    /^--end--$/,
    /↑阅读之前记得关注/,
    /如果觉得文章还不错/,
  ]

  // 2) 段落内噪声片段（替换为空）
  const NOISE_FRAGMENT_PATTERNS: Array<[RegExp, string]> = [
    [/你说的完全正确/g, ''],
    [/在小说阅读器[读去读]?[本去沉]?[章阅浸]?[读阅]?/g, ''],
    [/AI寒武纪/g, ''],
    [/[+＋]星标/g, ''],
    [/↑阅读之前记得关注[+＋]星标⭐️？?，?😄?，?每天才能第一时间接收到更新/g, ''],
    [/视频加载失败，?请刷新页面再试/g, ''],
    [/^刷新$/g, ''],
    [/最后记得⭐️我，?每天都在更新：?如果觉得文章还不错的话可以点赞转发推荐评论/g, ''],
    [/@[作作]者：?[^\n]*/g, ''],
    [/轻点两下取消(赞|在看)/g, ''],
    [/[⭐️⭐🌟]/g, ''],
  ]

  // 3) 按段落处理（extractTextFromHtml 保留了段落结构，按 \n 分隔）
  const paragraphs = contentText
    .split('\n')
    .map(p => p.trim())
    .filter(p => {
      if (p.length < 5) return false
      // 过滤含噪声关键词的整行
      for (const pattern of NOISE_LINE_PATTERNS) {
        if (pattern.test(p)) return false
      }
      // 过滤纯符号行
      if (/^[\s\-=*_~`#>|+]+$/.test(p)) return false
      return true
    })
    .map(p => {
      // 清除段落内的噪声片段
      let cleaned = p
      for (const [pattern, replacement] of NOISE_FRAGMENT_PATTERNS) {
        cleaned = cleaned.replace(pattern, replacement)
      }
      // 去除 markdown 标题标记
      cleaned = cleaned.replace(/^#{1,6}\s*/, '')
      // 去除多余空白和标点
      cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/[，,]\s*[，,]/g, '，')
        .replace(/\.\.\.\s*。/g, '。')
        .trim()
      return cleaned
    })
    .filter(p => p.length >= 10) // 过滤后再次检查长度

  // 4) 从段落中提取句子
  // 注意：英文句点 . 只在后跟空格或行尾时才作为分句符，
  // 避免 "CLAUDE.md" 等文件名中的点被误匹配
  const allSentences: string[] = []
  for (const p of paragraphs) {
    const sentences = p
      .split(/[。！？；]|[.!?](?=\s|$)/)
      .map(s => s.trim())
      .filter(s => s.length >= 8)
    allSentences.push(...sentences)
  }

  // 5) 去重：前20字相同则视为重复
  const seen = new Set<string>()
  const cleanSentences: string[] = []
  for (const s of allSentences) {
    const key = s.slice(0, 20)
    if (!seen.has(key)) {
      seen.add(key)
      cleanSentences.push(s)
    }
  }

  const maxScriptChars = podcastType === 'dual' ? 12000 : 8000

  // 6) 提取核心信息点（每句压缩到 55 字以内，符合口语节奏）
  const keyPoints = cleanSentences
    .map(s => {
      if (s.length <= 55) return s
      // 优先在逗号处截断，避免生硬断句
      const cutPos = s.lastIndexOf('，', 50)
      if (cutPos > 20) return s.slice(0, cutPos)
      // 如果句子含冒号且冒号在前30字内，保留到冒号后至少20字
      const colonPos = s.search(/[：:]/)
      if (colonPos >= 0 && colonPos < 30) {
        return s.slice(0, Math.min(colonPos + 25, s.length))
      }
      return s.slice(0, 50)
    })
    .filter(s => s.length >= 10) // 过滤掉太短的信息点

  if (podcastType === 'dual') {
    // === 双人对话播客 ===
    const lines: string[] = []
    const firstPoint = keyPoints[0] || '一个值得关注的话题'
    const secondPoint = keyPoints[1] || '确实挺有意思的'

    // 开场
    lines.push('[主持人]')
    lines.push(`嘿，欢迎收听本期播客。今天想跟你聊一个事儿，${firstPoint}。`)
    lines.push('')
    lines.push('[嘉宾]')
    lines.push(`嗯，这个我也注意到了。${secondPoint}。`)
    lines.push('')

    // 主体对话
    let idx = 2
    let totalChars = firstPoint.length + secondPoint.length + 40
    let turn = 0

    const hostLeadIns = [
      '那具体说说，',
      '我比较好奇的是，',
      '说到这个，',
      '有个细节我想问，',
      '等一下，',
      '而且我听说，',
      '这一点很关键，',
      '你觉得呢，',
    ]
    const guestLeadIns = [
      '对，',
      '没错，',
      '其实吧，',
      '我补充一下，',
      '而且还有一个点，',
      '有意思的是，',
      '具体来说，',
    ]

    while (idx < keyPoints.length && totalChars < maxScriptChars) {
      const content = keyPoints[idx]
      if (!content) { idx++; turn++; continue }

      if (turn % 2 === 0) {
        // 主持人
        const leadIn = hostLeadIns[turn % hostLeadIns.length]
        lines.push('[主持人]')
        lines.push(`${leadIn}${content}。`)
        totalChars += content.length + leadIn.length + 2
        idx++
      } else {
        // 嘉宾
        const leadIn = guestLeadIns[turn % guestLeadIns.length]
        lines.push('[嘉宾]')
        lines.push(`${leadIn}${content}。`)
        totalChars += content.length + leadIn.length + 2
        idx++
      }
      lines.push('')
      turn++
    }

    // 收尾：确保交替正确（如果最后一段是主持人，先让嘉宾说一句再收尾）
    // turn 在循环中递增，turn-1 是最后说话的轮次
    // turn-1 为偶数 → 最后说话的是主持人 → 需要加嘉宾过渡
    const lastTurnWasHost = (turn - 1) % 2 === 0
    if (lastTurnWasHost) {
      lines.push('[嘉宾]')
      lines.push('嗯，确实，这个话题还有很多值得深入聊的地方。')
      lines.push('')
    }
    lines.push('[主持人]')
    lines.push('聊了这么多，你觉得这个事儿最值得关注的是什么？')
    lines.push('')
    lines.push('[嘉宾]')
    lines.push('我觉得吧，核心还是看后续怎么发展。今天就聊到这儿吧。')
    lines.push('')
    lines.push('[主持人]')
    lines.push('好的，感谢收听，我们下期再见！')
    lines.push('')

    return lines.join('\n')
  }

  // === 单人播客：纯朗读文案（无 [主持人] 标记）===
  const lines: string[] = []
  const firstPoint = keyPoints[0] || '一个值得关注的话题'

  // 开场：用核心内容引入话题
  lines.push('大家好，欢迎收听本期播客。')
  lines.push(`今天想跟大家聊一个事儿，${firstPoint}。`)
  lines.push('')

  // 主体：用口语化过渡词串联核心信息，偶尔加入主持人评论
  const transitions = [
    '说到这个，',
    '你知道吗，',
    '有意思的是，',
    '这里有个细节，',
    '我个人觉得，',
    '另外提一句，',
    '其实啊，',
    '回到刚才说的，',
  ]
  const comments = [
    '这点挺值得琢磨的。',
    '',
    '',
    '',
    '你说是不是？',
    '',
    '',
    '',
  ]

  let idx = 1
  let totalChars = firstPoint.length + 40
  let transIdx = 0

  while (idx < keyPoints.length && totalChars < maxScriptChars) {
    const point = keyPoints[idx]
    if (!point) { idx++; continue }

    const trans = transitions[transIdx % transitions.length]
    transIdx++

    lines.push(`${trans}${point}。`)

    // 偶尔加主持人评论
    const comment = comments[idx % comments.length]
    if (comment) {
      lines.push(comment)
    }
    lines.push('')

    totalChars += point.length + trans.length + comment.length + 3
    idx++
  }

  // 收尾
  lines.push('好了，今天就聊到这儿。')
  lines.push('如果你对这个话题有自己的看法，欢迎留言讨论。')
  lines.push('我们下期再见！')

  // 单人播客：输出纯朗读文案，不包含任何角色标记
  return lines.join('\n')
}

// 将播客脚本按最大字符数分段（不在句子中间断开）
// 用于克隆声音的分段合成：每段在超时限制内完成，前端逐段调用 TTS
function splitScriptIntoSegments(script: string, maxChars: number): string[] {
  // 按行分割，保留 [主持人]/[嘉宾] 角色标记
  const lines = script.split('\n')
  const segments: string[] = []
  let currentSegment = ''
  let currentLen = 0

  for (const line of lines) {
    const lineLen = line.length + 1 // +1 for newline

    // 如果当前行本身超过 maxChars，需要按句子分割
    if (lineLen > maxChars) {
      // 先把当前段落存起来
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim())
        currentSegment = ''
        currentLen = 0
      }

      // 按句子分割长行
      const sentences = line.split(/(?<=[。！？.!?；;])/)
      let chunk = ''
      let chunkLen = 0
      for (const s of sentences) {
        if (!s.trim()) continue
        if (chunkLen + s.length > maxChars && chunk) {
          segments.push(chunk.trim())
          chunk = s
          chunkLen = s.length
        } else {
          chunk += s
          chunkLen += s.length
        }
      }
      if (chunk.trim()) {
        currentSegment = chunk
        currentLen = chunkLen
      }
      continue
    }

    // 正常行：检查是否超出当前段限制
    if (currentLen + lineLen > maxChars && currentSegment) {
      // 当前段已满，保存并开始新段
      segments.push(currentSegment.trim())
      currentSegment = line + '\n'
      currentLen = lineLen
    } else {
      currentSegment += line + '\n'
      currentLen += lineLen
    }
  }

  // 保存最后一段
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim())
  }

  return segments.length > 0 ? segments : [script]
}

// 使用 LLM 提取亮点
async function extractHighlights(
  scriptText: string,
  llmClient: LLMClient | null
): Promise<string[]> {
  if (llmClient) {
    try {
      const messages: Message[] = [
        {
          role: 'system',
          content: '你是一个内容分析专家。从播客脚本中提取3-5个关键亮点。直接返回JSON数组格式，如：["亮点1","亮点2","亮点3"]',
        },
        {
          role: 'user',
          content: `请从以下播客脚本中提取关键亮点：\n\n${scriptText.slice(0, 4000)}`,
        },
      ]

      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.5,
      })

      const content = response.content.trim()
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('Highlights extraction error:', error)
    }
  }

  return scriptText
    .split(/\n+/)
    .filter((line) => line.trim().length > 20 && !line.startsWith('['))
    .slice(0, 5)
    .map((line) => line.trim())
}

// 播客生成 API —— 只生成脚本和亮点，语音合成由前端浏览器完成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, podcastType, voice1, voice2, url, text, fileName } = body

    const sessionToken = request.headers.get('x-session')
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
    }

    // 初始化 LLM 客户端
    let llmClient: LLMClient | null = null
    try {
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
      const config = new Config()
      llmClient = new LLMClient(config, customHeaders)
    } catch {
      console.log('LLM client not available, using fallback')
    }

    // Step 1: 获取内容文本
    let contentText = ''
    let title = 'Generated Podcast'

    if (type === 'text') {
      if (!text || text.trim().length < 10) {
        return NextResponse.json({ error: 'Text content too short' }, { status: 400 })
      }
      contentText = text
      title = 'Text-based Podcast'
    } else if (type === 'link') {
      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 })
      }
      contentText = await fetchContentFromUrl(url)
      if (!contentText || contentText.length < 50) {
        if (llmClient) {
          try {
            const messages: Message[] = [
              { role: 'user', content: `请分析这个链接的主题和核心内容，提供详细摘要：${url}` },
            ]
            const response = await llmClient.invoke(messages, {
              model: 'doubao-seed-2-0-lite-260215',
              temperature: 0.7,
            })
            contentText = response.content
          } catch {
            /* ignore */
          }
        }
        if (!contentText || contentText.length < 50) {
          return NextResponse.json({ error: 'Failed to extract content from URL' }, { status: 400 })
        }
      }
      try {
        const urlObj = new URL(url)
        title = urlObj.hostname + ' - Podcast'
      } catch {
        /* ignore */
      }
    } else if (type === 'file') {
      if (!text) {
        return NextResponse.json({ error: 'File content is required' }, { status: 400 })
      }
      contentText = text
      title = (fileName || 'File').replace(/\.\w+$/, '').replace(/[-_]/g, ' ')
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    if (!contentText || contentText.length < 10) {
      return NextResponse.json({ error: 'Insufficient content for podcast generation' }, { status: 400 })
    }

    // Step 2: 生成播客脚本
    // - 文本输入(type=text)：完全按原文朗读，不做任何改写
    //   - 单人模式：直接用原文
    //   - 双人模式：如果原文无角色标记，按段落自动交替添加 [主持人][嘉宾] 标记（不改文本内容）
    // - URL/文件输入(type=link/file)：先 AI 生成纯朗读文案，再做 TTS
    // - 克隆声音合成较慢：不截断，而是分段合成（前端逐段调用 TTS）
    const isCloneVoice = (voice1 && voice1.startsWith('clone-')) || (voice2 && voice2.startsWith('clone-'))

    let podcastScript: string
    if (type === 'text') {
      // 文本输入：直接用原文作为朗读脚本，确保完全按文本朗读
      // 仅做最小化清理：去除首尾空白、合并多余空行
      let originalLines = contentText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      if (podcastType === 'dual') {
        // 双人模式：检查原文是否已有角色标记
        const hasSpeakerMark = originalLines.some(l => /^\[(主持人|嘉宾|Host|Guest)\]/i.test(l))
        if (!hasSpeakerMark) {
          // 无角色标记：按段落自动交替添加 [主持人][嘉宾] 标记（不改文本内容）
          const markedLines: string[] = []
          let speakerIdx = 0
          for (const line of originalLines) {
            const speaker = speakerIdx % 2 === 0 ? '[主持人]' : '[嘉宾]'
            markedLines.push(speaker)
            markedLines.push(line)
            markedLines.push('')
            speakerIdx++
          }
          podcastScript = markedLines.join('\n')
          console.log(`[Generate] Text input + dual mode: auto-added speaker marks to ${originalLines.length} paragraphs`)
        } else {
          // 已有角色标记：直接使用原文
          podcastScript = originalLines.join('\n')
          console.log(`[Generate] Text input + dual mode: original text has speaker marks`)
        }
      } else {
        // 单人模式：直接用原文
        podcastScript = originalLines.join('\n')
        console.log(`[Generate] Text input + single mode: using original text (${podcastScript.length} chars)`)
      }
    } else {
      // URL/文件输入：通过 AI 生成纯朗读文案
      podcastScript = await generatePodcastScript(contentText, podcastType || 'single', llmClient)
      console.log(`[Generate] ${type} input mode: AI-generated script (${podcastScript.length} chars)`)
    }

    // Step 3: 提取亮点
    const highlights = await extractHighlights(podcastScript, llmClient)

    // Step 4: 估算时长（按中文约 4 字/秒 估算）
    const estimatedDuration = Math.max(30, Math.floor(podcastScript.length / 4))

    const podcastId = randomUUID()

    return NextResponse.json({
      success: true,
      podcastId,
      title,
      highlights,
      duration: estimatedDuration,
      script: podcastScript,
      // 单次合成完整音频：Python 后端内部分段+合并为单个 wav，避免前端拼接产生噪音
      segments: [podcastScript],
      segmentCount: 1,
      // 返回声音选择信息，供前端做语音合成
      voice1: voice1 || 'female-professional',
      voice2: voice2 || 'male-narrator',
      podcastType: podcastType || 'single',
      // 明确告诉前端：语音由浏览器 Web Speech API 合成
      audioMode: 'web-speech',
    })
  } catch (error) {
    console.error('Podcast generation error:', error)
    return NextResponse.json(
      { error: `Failed to generate podcast: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
