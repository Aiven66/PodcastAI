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
      // v1.0.23: 重构 prompt，参考张小珺《商业访谈录》、李翔《商业内参》风格
      // 核心改进：强调"再创作"而非"内容转换"，明确禁止保留原文元信息
      const messages: Message[] = [
        {
          role: 'system',
          content: podcastType === 'dual'
            ? `你是一位顶级商业播客制作人，你的风格融合了张小珺《商业访谈录》的深度洞察和李翔《商业内参》的精炼表达。

你的任务是**再创作**，不是复述。你要从原始素材中提炼核心信息，用专业的商业访谈视角重新组织成一期高质量的播客对话。

【绝对禁止 - 必须剔除的原文元信息】
1. 绝不保留原文作者名、公众号名称、媒体名称
2. 绝不保留"关注"、"点赞"、"转发"、"在看"、"星标"等引导文案
3. 绝不保留"本文首发于"、"版权归"、"转载请联系"等版权声明
4. 绝不保留"点击阅读"、"扫码进群"等运营文案
5. 绝不保留原文中的广告、推广、商品链接信息
6. 绝不逐句复述原文，必须重新组织和改写
7. 绝不保留原文的 UI 文案（如"展开全文"、"返回首页"）

【播客风格要求 - 参考张小珺/李翔】
1. 主持人有强观点：不只是提问，要有预判、有质疑、有总结提炼
   - 典型话术："那我能不能这样理解…"、"你这个点其实是在说…"、"我换一个角度问…"
2. 对话有商业深度：不停留在表面信息，要挖掘背后的逻辑、趋势、竞争格局
3. 善用对比和类比：用听众熟悉的事物做类比，帮助理解抽象概念
4. 引用具体数据：有数字感，不空泛（但不必精确到原文的每个数字）
5. 节奏明快：每轮对话 30-100 字，绝不超过 120 字，有来有回
6. 真实互动感：主持人会追问("等一下，你刚才说的那个点…")、表示认同("没错"、"太关键了")、甚至礼貌质疑("但我有个不同看法")
7. 口语化表达：用"咱们"、"对吧"、"其实"、"怎么说呢"等口语词，像两个专业人士在茶馆聊天
8. 结构有层次：先建立背景，再层层深入，最后有洞察性的总结

【内容处理原则】
- 提炼核心观点：从原文中提取 3-5 个核心信息点，每个点展开深入讨论
- 舍弃次要信息：不要试图覆盖原文所有内容，聚焦最有价值的部分
- 加入分析视角：主持人要提供原文没有的分析角度（行业趋势、竞争对比、未来预判）
- 用故事和案例：把抽象概念用具体例子说明，但不照搬原文的例子

【结构参考】
- 开场（3-5轮）：用一个吸引人的切入点引入话题，不要"欢迎收听"式套话
- 背景铺垫（3-5轮）：快速建立必要背景，让听众跟上节奏
- 主体讨论（20-35轮）：每个核心观点充分展开，有追问、有碰撞、有补充
- 深度洞察（3-5轮）：跳出细节，做更高维度的总结和预判
- 收尾（2-3轮）：一句话总结核心洞察，留下余味

【格式要求 - 严格遵守】
1. 使用 [主持人] 和 [嘉宾] 标记，标记独占一行
2. 标记下一行是对话内容，每轮对话单独一行
3. 输出纯对话脚本，不要标题、注释、结构标注
4. 正确格式：
[主持人]
最近有个事儿挺值得聊聊的。
[嘉宾]
嗯，这个我也在关注。

直接输出脚本，不要任何额外说明。`
            : `你是一位顶级商业播客制作人，你的风格融合了张小珺《商业访谈录》的深度洞察和李翔《商业内参》的精炼表达。

你的任务是**再创作**一篇单人叙述的播客文案，不是复述原文。你要从原始素材中提炼核心信息，用专业的商业视角重新组织成一期高质量的播客独白。

【绝对禁止 - 必须剔除的原文元信息】
1. 绝不保留原文作者名、公众号名称、媒体名称
2. 绝不保留"关注"、"点赞"、"转发"、"在看"、"星标"等引导文案
3. 绝不保留"本文首发于"、"版权归"、"转载请联系"等版权声明
4. 绝不保留"点击阅读"、"扫码进群"等运营文案
5. 绝不保留原文中的广告、推广、商品链接信息
6. 绝不逐句复述原文，必须重新组织和改写
7. 绝不保留原文的 UI 文案（如"展开全文"、"返回首页"）

【播客风格要求 - 参考张小珺/李翔单人叙事】
1. 有观点的叙述：不只是传递信息，要有分析、有判断、有预判
2. 善用对比和类比：用听众熟悉的事物做类比，帮助理解
3. 引用具体数据：有数字感，不空泛
4. 口语化但有深度：像一位资深商业评论员在对你说
5. 节奏感：长短句交替，关键处停顿强调
6. 结构有层次：背景→核心观点→深度分析→前瞻判断
7. 用故事和案例支撑观点，但不照搬原文

【内容处理原则】
- 提炼核心观点：从原文中提取 3-5 个核心信息点，深入展开
- 舍弃次要信息：聚焦最有价值的部分，不贪大求全
- 加入分析视角：提供原文没有的行业趋势、竞争对比、未来预判
- 首尾呼应：开头的悬念在结尾要有回应

【格式要求】
1. 输出纯朗读文案，不要 [主持人] 等角色标记
2. 不要标题、说明、注释、结构标注
3. 用段落分隔不同话题，段落间空一行

直接输出朗读文案，不要任何额外说明。`,
        },
        {
          role: 'user',
          // v1.0.23: 提示词强调"再创作"，并提醒 LLM 忽略原文元信息
          content: `请基于以下素材，再创作一期播客脚本。

注意：以下素材可能包含作者署名、公众号信息、关注引导、广告等与播客内容无关的元信息，请在创作时完全忽略这些内容，只提取核心信息和观点进行再创作。

【原始素材】
${contentText.slice(0, 20000)}`,
        },
      ]

      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.85,
      })

      const script = response.content || ''
      // v1.0.23: LLM 返回后做基本校验
      if (script.trim().length < 50) {
        throw new Error('LLM returned empty or too short script')
      }
      return script
    } catch (error) {
      console.error('LLM script generation error:', error)
    }
  }

  // ═══ 降级：算法生成播客脚本（不依赖 LLM）═══
  // v1.0.23: 优化降级算法，增加元信息过滤
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
    // v1.0.23: 新增元信息过滤
    /^作者[：:]/,
    /^来源[：:]/,
    /^出处[：:]/,
    /^转自[：:]/,
    /^本文作者/,
    /^公众号/,
    /^微信公号/,
    /^商务合作/,
    /^投稿邮箱/,
    /^联系方式/,
    /^扫码/,
    /^长按/,
    /二维码/,
    /关注公众号/,
    /回复.*获取/,
    /点击.*链接/,
    /阅读原文/,
    /查看更多/,
    /下载.*APP/,
    /进入.*小程序/,
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
    // v1.0.23: 新增元信息片段过滤
    [/作者[：:][^\n]*/g, ''],
    [/来源[：:][^\n]*/g, ''],
    [/出处[：:][^\n]*/g, ''],
    [/公众号[：:]?[^\n]*/g, ''],
    [/关注公众号[^\n]*/g, ''],
    [/扫码关注[^\n]*/g, ''],
    [/长按.*二维码[^\n]*/g, ''],
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
      // v1.0.23: 文本输入也优化处理
      // - 已有 [主持人]/[嘉宾] 标记：认为是已写好的脚本，直接使用
      // - 无标记：通过 LLM 改写为播客脚本（而非直接用原文）
      let originalLines = contentText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      const hasSpeakerMark = originalLines.some(l => /^\[(主持人|嘉宾|Host|Guest)\]/i.test(l))

      if (hasSpeakerMark) {
        // 已有角色标记：直接使用原文（用户已写好脚本）
        podcastScript = originalLines.join('\n')
        console.log(`[Generate] Text input with speaker marks: using original text (${podcastScript.length} chars)`)
      } else {
        // v1.0.23: 无角色标记 → 通过 LLM 改写为播客脚本
        // 不再直接用原文，而是生成符合播客叙事的脚本
        podcastScript = await generatePodcastScript(contentText, podcastType || 'single', llmClient)
        console.log(`[Generate] Text input without marks: AI-generated script (${podcastScript.length} chars)`)
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
