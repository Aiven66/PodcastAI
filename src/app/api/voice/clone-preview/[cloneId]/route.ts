import { NextRequest, NextResponse } from 'next/server'
import http from 'http'
import path from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PREVIEW_CACHE_DIR = path.join(process.cwd(), '.preview-cache')

function httpGetBuffer(
  url: string,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const chunks: Buffer[] = []
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 500,
            buffer: Buffer.concat(chunks),
            contentType: (res.headers['content-type'] as string) || 'audio/wav',
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

async function getCachedPreview(cloneId: string): Promise<Buffer | null> {
  const cacheFile = path.join(PREVIEW_CACHE_DIR, `${cloneId}.wav`)
  if (existsSync(cacheFile)) {
    try {
      return await readFile(cacheFile)
    } catch {
      return null
    }
  }
  return null
}

async function savePreviewToCache(cloneId: string, buffer: Buffer): Promise<void> {
  try {
    if (!existsSync(PREVIEW_CACHE_DIR)) {
      await mkdir(PREVIEW_CACHE_DIR, { recursive: true })
    }
    const cacheFile = path.join(PREVIEW_CACHE_DIR, `${cloneId}.wav`)
    await writeFile(cacheFile, buffer)
  } catch (err) {
    console.warn('[ClonePreview] Failed to save cache:', (err as Error).message)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cloneId: string }> }
) {
  try {
    const { cloneId } = await params
    const voiceServiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:8907'
    const previewUrl = `${voiceServiceUrl}/preview/${encodeURIComponent(cloneId)}`

    console.log(`[ClonePreview] Request for cloneId=${cloneId}`)

    // 先尝试从缓存读取
    const cached = await getCachedPreview(cloneId)
    if (cached) {
      console.log(`[ClonePreview] Cache hit: cloneId=${cloneId}, size=${cached.length} bytes`)
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': String(cached.length),
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Accept-Ranges': 'bytes',
          'X-Preview-Cache': 'HIT',
        },
      })
    }

    console.log(`[ClonePreview] Cache miss, fetching from service: ${previewUrl}`)

    // 检查 Python 服务是否可用
    try {
      const healthCheck = await httpGetBuffer(`${voiceServiceUrl}/health`, 5000)
      if (!healthCheck.ok) {
        console.warn('[ClonePreview] Voice service health check failed')
        return NextResponse.json(
          { error: 'Voice service unavailable' },
          { status: 503 }
        )
      }
    } catch (healthErr) {
      console.warn('[ClonePreview] Voice service health check error:', (healthErr as Error).message)
      return NextResponse.json(
        { error: 'Voice service unavailable', detail: (healthErr as Error).message },
        { status: 503 }
      )
    }

    // 从 Python 服务获取预览音频
    // Python /preview 端点现在为异步模式：
    //   - 缓存命中 → 返回 200 + 音频
    //   - 缓存未命中 → 返回 202 + JSON（正在后台生成）
    // 超时设为 10 秒（Python 要么秒回音频，要么秒回 202）
    const result = await httpGetBuffer(previewUrl, 10000)

    // 202 = 后台生成中，前端需要轮询
    if (result.status === 202) {
      console.log(`[ClonePreview] Preview generating in background: cloneId=${cloneId}`)
      return NextResponse.json(
        { status: 'generating', cloneId, message: 'Preview audio is being generated.' },
        { status: 202 }
      )
    }

    if (!result.ok) {
      const errorText = result.buffer.toString('utf-8').slice(0, 200)
      console.error(`[ClonePreview] Failed: status=${result.status}, cloneId=${cloneId}, body=${errorText}`)
      return NextResponse.json(
        { error: `Failed to fetch clone voice preview: ${result.status}`, detail: errorText },
        { status: result.status }
      )
    }

    // 检查返回的是否是 JSON（非音频内容）
    const ct = result.contentType || ''
    if (ct.includes('application/json') || result.buffer.length < 1000) {
      console.error(`[ClonePreview] Unexpected JSON response: cloneId=${cloneId}, size=${result.buffer.length}`)
      return NextResponse.json(
        { error: 'Unexpected response from voice service' },
        { status: 500 }
      )
    }

    console.log(`[ClonePreview] Success: cloneId=${cloneId}, size=${result.buffer.length} bytes, type=${result.contentType}`)

    // 保存到缓存
    await savePreviewToCache(cloneId, result.buffer)

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType || 'audio/wav',
        'Content-Length': String(result.buffer.length),
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
        'X-Preview-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error(`[ClonePreview] Proxy error:`, error)
    return NextResponse.json(
      { error: 'Internal server error', detail: (error as Error).message },
      { status: 500 }
    )
  }
}
