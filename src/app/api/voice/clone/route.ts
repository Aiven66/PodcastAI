import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import http from 'http'
import { URL } from 'url'
import { isVoiceFeatureSupported, createDesktopRequiredResponse } from '@/lib/server-capabilities'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Python 语音克隆服务地址
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://localhost:8907'

// 声音克隆数据存储路径
const CLONES_DIR = path.join(process.cwd(), 'public', 'voice-clones')
const CLONES_META_FILE = path.join(CLONES_DIR, 'clones-meta.json')
// 预览音频本地缓存目录（与 clone-preview API 共享）
const PREVIEW_CACHE_DIR = path.join(process.cwd(), '.preview-cache')

// 用 Node.js 原生 http 模块请求，绕过 http_proxy 环境变量
function httpGetJson(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const chunks: Buffer[] = []
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          let data: any = null
          try { data = JSON.parse(body) } catch { data = body }
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            data,
          })
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`))
    })
    req.end()
  })
}

// 用 Node.js 原生 http 模块发送 POST 请求（带 body），绕过 http_proxy 环境变量
function httpPostBuffer(
  url: string,
  headers: Record<string, string>,
  body: Buffer,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const chunks: Buffer[] = []
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        timeout: timeoutMs,
        headers,
      },
      (res) => {
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          let data: any = null
          try { data = JSON.parse(body) } catch { data = body }
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            data,
          })
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`))
    })
    req.write(body)
    req.end()
  })
}

// 用 Node.js 原生 http 模块获取二进制数据，绕过 http_proxy 环境变量
function httpGetBuffer(
  url: string,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const chunks: Buffer[] = []
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            buffer: Buffer.concat(chunks),
          })
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`))
    })
    req.end()
  })
}

interface VoiceCloneRecord {
  id: string
  name: string
  description: string
  audioUrl: string
  audioPath: string
  gender: 'Male' | 'Female'
  // Python 语音服务返回的 clone_id
  voiceServiceCloneId: string
  // 声学特征（由 Python 服务分析）
  features?: {
    f0: number
    rms: number
    centroid: number
    duration: number
    gender: string
    sample_rate: number
  }
  createdAt: string
}

// 读取克隆记录
async function getCloneRecords(): Promise<VoiceCloneRecord[]> {
  if (!existsSync(CLONES_META_FILE)) return []
  try {
    const data = await readFile(CLONES_META_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存克隆记录
async function saveCloneRecord(record: VoiceCloneRecord): Promise<void> {
  if (!existsSync(CLONES_DIR)) {
    await mkdir(CLONES_DIR, { recursive: true })
  }
  const records = await getCloneRecords()
  records.push(record)
  await writeFile(CLONES_META_FILE, JSON.stringify(records, null, 2))
}

// 预加载预览音频到本地缓存（克隆成功后调用，确保试听时秒回）
async function preloadPreviewToCache(voiceServiceCloneId: string): Promise<boolean> {
  if (!voiceServiceCloneId) return false
  try {
    const previewUrl = `${VOICE_SERVICE_URL}/preview/${encodeURIComponent(voiceServiceCloneId)}`
    console.log(`[VoiceClone] Preloading preview audio: ${previewUrl}`)
    // 10 秒超时：Python 缓存命中应秒回；未命中则放弃（不影响主流程）
    const result = await httpGetBuffer(previewUrl, 10000)
    if (!result.ok || result.buffer.length < 1000) {
      console.warn(`[VoiceClone] Preview preload failed: status=${result.status}, size=${result.buffer.length}`)
      return false
    }
    if (!existsSync(PREVIEW_CACHE_DIR)) {
      await mkdir(PREVIEW_CACHE_DIR, { recursive: true })
    }
    const cacheFile = path.join(PREVIEW_CACHE_DIR, `${voiceServiceCloneId}.wav`)
    await writeFile(cacheFile, result.buffer)
    console.log(`[VoiceClone] Preview preloaded to cache: ${cacheFile} (${result.buffer.length} bytes)`)
    return true
  } catch (err) {
    console.warn('[VoiceClone] Preview preload error:', (err as Error).message)
    return false
  }
}

// 检查 Python 语音服务是否可用
async function isVoiceServiceAvailable(): Promise<boolean> {
  try {
    const result = await httpGetJson(`${VOICE_SERVICE_URL}/health`, 3000)
    return result.ok
  } catch {
    return false
  }
}

// 自动补全缺失的 voiceServiceCloneId
// 策略：从 Python 服务获取所有克隆，按名称匹配本地记录，补全缺失的 ID
async function autoFixMissingVoiceServiceIds(records: VoiceCloneRecord[]): Promise<VoiceCloneRecord[]> {
  const missing = records.filter((r) => !r.voiceServiceCloneId)
  if (missing.length === 0) return records

  try {
    const result = await httpGetJson(`${VOICE_SERVICE_URL}/clones`, 5000)
    if (!result.ok || !result.data) return records

    const remoteClones: Array<{ id?: string; clone_id?: string; name?: string }> =
      Array.isArray(result.data.clones) ? result.data.clones :
      Array.isArray(result.data) ? result.data : []

    if (remoteClones.length === 0) return records

    // 构建 name -> remoteId 的映射（同名取最新的）
    const nameToRemoteId = new Map<string, string>()
    for (const rc of remoteClones) {
      const rid = rc.id || rc.clone_id
      const rname = rc.name || ''
      if (rid && rname) {
        nameToRemoteId.set(rname, rid)
      }
    }

    let updated = false
    for (const record of records) {
      if (!record.voiceServiceCloneId && nameToRemoteId.has(record.name)) {
        record.voiceServiceCloneId = nameToRemoteId.get(record.name)!
        updated = true
        console.log(`[VoiceClone] Auto-fixed voiceServiceCloneId for ${record.name}: ${record.voiceServiceCloneId}`)
      }
    }

    if (updated) {
      await writeFile(CLONES_META_FILE, JSON.stringify(records, null, 2))
      console.log('[VoiceClone] Updated clones-meta.json with fixed voiceServiceCloneIds')
    }

    return records
  } catch (e) {
    console.warn('[VoiceClone] Auto-fix voiceServiceCloneIds failed:', (e as Error).message)
    return records
  }
}

// 声音克隆 API —— 调用 Python 语音服务实现真正的声音克隆
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('x-session')
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
    }

    // Vercel 环境检测：网页版不支持声音克隆（需要 Python 语音服务 + 本地文件系统）
    // 引导用户下载桌面客户端
    if (!isVoiceFeatureSupported()) {
      return NextResponse.json(
        createDesktopRequiredResponse('clone'),
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const voiceName = (formData.get('name') as string) || 'My Voice Clone'
    const description = (formData.get('description') as string) || ''
    const genderInput = (formData.get('gender') as string) || ''
    const promptTextInput = (formData.get('prompt_text') as string) || ''

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (audioFile.size > maxSize) {
      return NextResponse.json({ error: 'Audio file too large. Max size: 10MB' }, { status: 400 })
    }

    if (!existsSync(CLONES_DIR)) {
      await mkdir(CLONES_DIR, { recursive: true })
    }

    // 保存上传的音频文件
    const cloneId = randomUUID()
    const ext = audioFile.name.split('.').pop()?.toLowerCase() || 'wav'
    const audioFileName = `${cloneId}.${ext}`
    const audioFilePath = path.join(CLONES_DIR, audioFileName)
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    await writeFile(audioFilePath, audioBuffer)

    // 尝试调用 Python 语音服务进行真正的声音克隆
    let voiceServiceCloneId = ''
    let features: VoiceCloneRecord['features'] = undefined
    let engine = 'fallback'
    let previewReadyFromService = false

    const serviceAvailable = await isVoiceServiceAvailable()

    if (serviceAvailable) {
      try {
        // 将音频转发给 Python 语音服务
        // 使用 ArrayBuffer + 手动构建 multipart 请求，避免 Node.js FormData 兼容问题
        const audioArrayBuffer = await audioFile.arrayBuffer()
        const audioBytes = new Uint8Array(audioArrayBuffer)
        const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`
        const parts: Uint8Array[] = []

        // audio 字段
        const audioHeader = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${audioFile.name || 'audio.wav'}"\r\nContent-Type: ${audioFile.type || 'audio/wav'}\r\n\r\n`
        parts.push(new TextEncoder().encode(audioHeader))
        parts.push(audioBytes)
        parts.push(new TextEncoder().encode('\r\n'))

        // name 字段
        const nameHeader = `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${voiceName}\r\n`
        parts.push(new TextEncoder().encode(nameHeader))

        // description 字段
        const descHeader = `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n${description}\r\n`
        parts.push(new TextEncoder().encode(descHeader))

        // gender 字段（用户手动指定的性别）
        if (genderInput) {
          const genderHeader = `--${boundary}\r\nContent-Disposition: form-data; name="gender"\r\n\r\n${genderInput}\r\n`
          parts.push(new TextEncoder().encode(genderHeader))
        }

        // prompt_text 字段（参考音频的文本内容，提升克隆质量）
        if (promptTextInput) {
          const promptTextHeader = `--${boundary}\r\nContent-Disposition: form-data; name="prompt_text"\r\n\r\n${promptTextInput}\r\n`
          parts.push(new TextEncoder().encode(promptTextHeader))
        }

        // 结束标记
        parts.push(new TextEncoder().encode(`--${boundary}--\r\n`))

        // 合并所有部分
        const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
        const bodyBuffer = new Uint8Array(totalLength)
        let offset = 0
        for (const part of parts) {
          bodyBuffer.set(part, offset)
          offset += part.length
        }

        const cloneResult = await httpPostBuffer(
          `${VOICE_SERVICE_URL}/clone`,
          {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(bodyBuffer.length),
          },
          Buffer.from(bodyBuffer),
          600000, // 10 分钟超时（CosyVoice2 克隆 + 预览音频合成）
        )

        if (cloneResult.ok) {
          voiceServiceCloneId = cloneResult.data?.id || cloneResult.data?.clone_id || ''
          features = cloneResult.data?.features
          engine = cloneResult.data?.engine || 'fallback'
          previewReadyFromService = cloneResult.data?.preview_ready || false
          console.log(`[VoiceClone] Python service clone success: id=${voiceServiceCloneId}, engine=${engine}, preview_ready=${previewReadyFromService}`)
        } else {
          console.warn(`[VoiceClone] Python service clone failed: status=${cloneResult.status}, using local fallback`)
        }
      } catch (error) {
        console.warn('[VoiceClone] Python service unavailable, using local fallback:', (error as Error).message)
      }
    } else {
      console.warn('[VoiceClone] Python voice service not available at', VOICE_SERVICE_URL)
    }

    // 确定性别（优先使用 Python 服务分析结果，其次使用用户指定，最后默认）
    const genderFromService = features?.gender
    let gender: 'Male' | 'Female'
    if (genderFromService === 'male' || genderFromService === 'Male') {
      gender = 'Male'
    } else if (genderFromService === 'female' || genderFromService === 'Female') {
      gender = 'Female'
    } else if (genderInput === 'male') {
      gender = 'Male'
    } else if (genderInput === 'female') {
      gender = 'Female'
    } else {
      gender = 'Female'
    }

    // 估算时长
    const bytesPerSecond = ext === 'wav' ? 176000 : ext === 'm4a' ? 18000 : 16000
    const estimatedDuration = Math.round(audioFile.size / bytesPerSecond)

    // 保存克隆元数据
    const cloneRecord: VoiceCloneRecord = {
      id: cloneId,
      name: voiceName,
      description,
      audioUrl: `/voice-clones/${audioFileName}`,
      audioPath: audioFilePath,
      gender,
      voiceServiceCloneId,
      features,
      createdAt: new Date().toISOString(),
    }
    await saveCloneRecord(cloneRecord)

    // 克隆成功后预加载预览音频到本地缓存
    // Python /clone 端点已同步生成预览音频，此处从 Python 下载到 Next.js 缓存
    // 这样用户点击试听时直接命中本地缓存（秒回）
    // 10 秒超时：如果 Python 缓存命中则预加载成功；未命中则放弃（不影响主流程）
    let previewReady = false
    if (voiceServiceCloneId) {
      previewReady = await preloadPreviewToCache(voiceServiceCloneId)
    }

    return NextResponse.json({
      success: true,
      voiceCloneId: cloneId,
      id: cloneId,
      name: voiceName,
      description,
      audioUrl: cloneRecord.audioUrl,
      gender,
      features,
      engine,
      voiceServiceCloneId,
      sampleAudioUrl: cloneRecord.audioUrl,
      estimatedDuration,
      previewReady,
      status: 'completed',
    })
  } catch (error) {
    console.error('Voice clone error:', error)
    return NextResponse.json(
      { error: `Failed to process voice clone: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

// 获取用户克隆声音列表
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('x-session')
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
    }

    let records = await getCloneRecords()

    // 自动补全缺失的 voiceServiceCloneId（按名称匹配 Python 服务中的克隆）
    records = await autoFixMissingVoiceServiceIds(records)

    return NextResponse.json({
      voiceClones: records.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        audioUrl: r.audioUrl,
        gender: r.gender,
        features: r.features,
        voiceServiceCloneId: r.voiceServiceCloneId,
        sampleAudioUrl: r.audioUrl,
        status: 'completed',
      })),
    })
  } catch (error) {
    console.error('Get voice clones error:', error)
    return NextResponse.json({ error: 'Failed to get voice clones' }, { status: 500 })
  }
}
