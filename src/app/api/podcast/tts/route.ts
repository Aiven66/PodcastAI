import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import http from 'http'
import { URL } from 'url'
import { isVoiceFeatureSupported, createDesktopRequiredResponse } from '@/lib/server-capabilities'

// Vercel Hobby 计划限制 maxDuration 为 60 秒，长音频合成需依赖外部 Python 服务
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Node.js 内置 fetch (undici) 默认 headersTimeout=5分钟、bodyTimeout=5分钟
// Python 服务处理播客需要 10-20 分钟，5 分钟内未完成就会触发 "fetch failed"
// undici Agent 在 Next.js Turbopack 中无法加载（Cannot find module 'undici'）
// 解决方案：用 Node.js 原生 http 模块发送请求，它没有 headersTimeout/bodyTimeout 限制
function httpPostBuffer(url: string, body: Buffer, contentType: string, timeoutMs: number): Promise<{ ok: boolean; status: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const chunks: Buffer[] = []
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': body.length,
        },
        timeout: timeoutMs,
      },
      (res) => {
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            data: Buffer.concat(chunks),
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

// 构建 multipart/form-data body（不依赖 FormData，避免环境差异）
function buildMultipartFormData(fields: Record<string, string>): { body: Buffer; contentType: string } {
  const boundary = '----NextBoundary' + randomUUID().replace(/-/g, '')
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\n`))
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`))
    parts.push(Buffer.from(`${value}\r\n`))
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

// Python 语音克隆服务地址
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://localhost:8907'

// 克隆声音数据
const CLONES_DIR = path.join(process.cwd(), 'public', 'voice-clones')
const CLONES_META_FILE = path.join(CLONES_DIR, 'clones-meta.json')

interface CloneRecord {
  id: string
  name: string
  voiceServiceCloneId: string
  gender: string
  audioPath?: string
  features?: Record<string, number | string>
}

async function getCloneRecord(cloneId: string): Promise<CloneRecord | null> {
  try {
    if (!existsSync(CLONES_META_FILE)) return null
    const data = await readFile(CLONES_META_FILE, 'utf-8')
    const records: CloneRecord[] = JSON.parse(data)
    return records.find((r) => r.id === cloneId || `clone-${r.id}` === cloneId) || null
  } catch {
    return null
  }
}

// 检查 Python 语音服务是否可用
// 超时设为 15 秒：Python 服务在合成期间健康检查仍能秒回，但如果推理锁被占用或刚重启，可能需要更长时间
async function isVoiceServiceAvailable(): Promise<boolean> {
  // 必须用 Node.js 原生 http 模块，绕过 http_proxy 环境变量
  // fetch 会自动使用 http_proxy=http://127.0.0.1:7890，但代理没运行导致所有请求失败
  return new Promise((resolve) => {
    const parsed = new URL(`${VOICE_SERVICE_URL}/health`)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'GET',
        timeout: 15000,
      },
      (res) => {
        res.resume()
        resolve(res.statusCode! >= 200 && res.statusCode! < 300)
      }
    )
    req.on('error', (err) => {
      console.warn('[TTS] Health check error:', err.message || JSON.stringify(err))
      resolve(false)
    })
    req.on('timeout', () => {
      req.destroy()
      console.warn('[TTS] Health check timeout (15s)')
      resolve(false)
    })
    req.end()
  })
}

// TTS 合成 API —— 调用 Python 语音服务生成真实音频
// 支持系统声音（Edge TTS）和克隆声音（CosyVoice2）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { script, cloneIds, podcastType, voice1, voice2 } = body as {
      script: string
      cloneIds: string[]
      podcastType: 'single' | 'dual'
      voice1?: string
      voice2?: string
    }

    if (!script || !script.trim()) {
      return NextResponse.json({ error: 'Script text is required' }, { status: 400 })
    }

    // Vercel 环境检测：网页版不支持播客 TTS 合成（需要 Python 语音服务 + 本地文件系统）
    // 引导用户下载桌面客户端
    if (!isVoiceFeatureSupported()) {
      return NextResponse.json(
        createDesktopRequiredResponse('tts'),
        { status: 503 }
      )
    }

    if (!cloneIds || !Array.isArray(cloneIds)) {
      cloneIds = []
    }

    const sessionToken = request.headers.get('x-session')
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
    }

    // 检查 Python 语音服务是否可用（带重试，避免热重载后短暂不可用导致误判）
    let serviceAvailable = false
    for (let h = 0; h < 3 && !serviceAvailable; h++) {
      if (h > 0) {
        console.log(`[TTS] Health check retry ${h + 1}/3...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      serviceAvailable = await isVoiceServiceAvailable()
    }
    if (!serviceAvailable) {
      console.warn('[TTS] Python voice service not available after 3 retries')
      // 克隆声音请求必须显式失败，不能降级到 Web Speech API（音色完全不对）
      const hasCloneVoice = (cloneIds && cloneIds.length > 0) ||
        (voice1 && voice1.startsWith('clone-')) ||
        (voice2 && voice2.startsWith('clone-'))
      if (hasCloneVoice) {
        return NextResponse.json({
          success: false,
          error: '语音服务暂时不可用，请稍后重试或检查语音服务是否正常运行',
        }, { status: 503 })
      }
      return NextResponse.json({
        success: true,
        audioUrl: '',
        duration: Math.max(30, Math.floor((script || '').length / 4)),
        engine: 'web-speech',
        podcastId: randomUUID(),
        message: 'Voice service not available. Using browser speech synthesis.',
      })
    }

    // 检查 CosyVoice2 是否正在合成（锁忙检测）
    // 分段合成场景：前一段完成后锁可能还未释放，等待最多 60 秒而不是立即拒绝
    const hasCloneVoice = (cloneIds && cloneIds.length > 0) ||
      (voice1 && voice1.startsWith('clone-')) ||
      (voice2 && voice2.startsWith('clone-'))
    if (hasCloneVoice) {
      let busyRetries = 0
      const maxBusyRetries = 20 // 最多等待 60 秒（20 * 3秒）
      let isBusy = false
      while (busyRetries < maxBusyRetries) {
        try {
          const busyCheck = await new Promise<{busy: boolean}>((resolve) => {
            const parsed = new URL(`${VOICE_SERVICE_URL}/health`)
            const req = http.request(
              { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'GET', timeout: 5000 },
              (res) => {
                const chunks: Buffer[] = []
                res.on('data', (c: Buffer) => chunks.push(c))
                res.on('end', () => {
                  try {
                    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                    resolve({ busy: !!data.cosyvoice_busy })
                  } catch { resolve({ busy: false }) }
                })
              }
            )
            req.on('error', () => resolve({ busy: false }))
            req.on('timeout', () => { req.destroy(); resolve({ busy: false }) })
            req.end()
          })
          isBusy = busyCheck.busy
          if (!isBusy) break
          busyRetries++
          if (busyRetries === 1) {
            console.log('[TTS] CosyVoice2 is busy, waiting for lock release...')
          }
          if (busyRetries < maxBusyRetries) {
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        } catch {
          // 锁忙检测失败，继续尝试合成
          isBusy = false
          break
        }
      }
      if (isBusy) {
        console.warn('[TTS] CosyVoice2 still busy after 60s wait, rejecting request')
        return NextResponse.json({
          success: false,
          error: '语音合成服务正忙，请等待当前任务完成后重试（约 2-3 分钟）',
        }, { status: 503 })
      }
    }

    // 先尝试从 Python 服务按名称补全缺失的 voiceServiceCloneId
    try {
      const parsed = new URL(`${VOICE_SERVICE_URL}/clones`)
      const chunks: Buffer[] = []
      await new Promise<void>((resolve) => {
        const req = http.request(
          { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'GET', timeout: 5000 },
          (res) => {
            res.on('data', (c: Buffer) => chunks.push(c))
            res.on('end', () => resolve())
          }
        )
        req.on('error', () => resolve())
        req.on('timeout', () => { req.destroy(); resolve() })
        req.end()
      })
      try {
        const body = Buffer.concat(chunks).toString('utf8')
        const data = JSON.parse(body)
        const remoteClones: Array<{ id?: string; clone_id?: string; name?: string }> =
          Array.isArray(data.clones) ? data.clones : Array.isArray(data) ? data : []
        const nameToId = new Map<string, string>()
        for (const rc of remoteClones) {
          const rid = rc.id || rc.clone_id
          const rname = rc.name || ''
          if (rid && rname) nameToId.set(rname, rid)
        }
        // 更新本地记录
        if (existsSync(CLONES_META_FILE)) {
          const allRecords: CloneRecord[] = JSON.parse(await readFile(CLONES_META_FILE, 'utf-8'))
          let updated = false
          for (const r of allRecords) {
            if (!r.voiceServiceCloneId && nameToId.has(r.name)) {
              r.voiceServiceCloneId = nameToId.get(r.name)!
              updated = true
              console.log(`[TTS] Auto-fixed voiceServiceCloneId for ${r.name}: ${r.voiceServiceCloneId}`)
            }
          }
          if (updated) {
            await writeFile(CLONES_META_FILE, JSON.stringify(allRecords, null, 2))
          }
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    // 解析 clone IDs → Python 服务的 clone IDs
    const resolvedCloneIds: string[] = []
    console.log(`[TTS] Input cloneIds: ${JSON.stringify(cloneIds)}`)
    for (const cid of cloneIds) {
      const record = await getCloneRecord(cid)
      if (!record) {
        console.warn(`[TTS] No record found for cloneId: ${cid}`)
        continue
      }

      if (record.voiceServiceCloneId) {
        resolvedCloneIds.push(record.voiceServiceCloneId)
        console.log(`[TTS] Resolved ${cid} -> ${record.voiceServiceCloneId} (name=${record.name})`)
        continue
      }

      // 旧记录没有 Python clone ID，尝试注册
      if (record.audioPath && existsSync(record.audioPath)) {
        try {
          const audioBuffer = await readFile(record.audioPath)
          const ext = path.extname(record.audioPath).slice(1) || 'wav'
          const fileName = `audio.${ext}`
          const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'application/octet-stream'
          
          // 手动构建 multipart/form-data（使用 http 模块，绕过代理）
          const boundary = `----RegBoundary${randomUUID().replace(/-/g, '')}`
          const regParts: Buffer[] = []
          
          // audio 字段
          regParts.push(Buffer.from(`--${boundary}\r\n`))
          regParts.push(Buffer.from(`Content-Disposition: form-data; name="audio"; filename="${fileName}"\r\n`))
          regParts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`))
          regParts.push(audioBuffer)
          regParts.push(Buffer.from('\r\n'))
          
          // name 字段
          regParts.push(Buffer.from(`--${boundary}\r\n`))
          regParts.push(Buffer.from(`Content-Disposition: form-data; name="name"\r\n\r\n${record.name || 'Voice'}\r\n`))
          
          // gender 字段
          regParts.push(Buffer.from(`--${boundary}\r\n`))
          regParts.push(Buffer.from(`Content-Disposition: form-data; name="gender"\r\n\r\n${record.gender || 'Male'}\r\n`))
          
          // 结束
          regParts.push(Buffer.from(`--${boundary}--\r\n`))
          
          const regBody = Buffer.concat(regParts)
          
          const regResult = await httpPostBuffer(
            `${VOICE_SERVICE_URL}/clone`,
            regBody,
            `multipart/form-data; boundary=${boundary}`,
            180000 // 3分钟超时
          )

          if (regResult.ok) {
            try {
              const regResultData = JSON.parse(regResult.data.toString('utf8'))
              const newCloneId = regResultData.id || regResultData.clone_id || ''
              if (newCloneId) {
                resolvedCloneIds.push(newCloneId)
                console.log(`[TTS] Registered clone ${record.name} -> ${newCloneId}`)
                // 更新本地记录
                record.voiceServiceCloneId = newCloneId
                try {
                  const allRecords = existsSync(CLONES_META_FILE)
                    ? JSON.parse(await readFile(CLONES_META_FILE, 'utf-8'))
                    : []
                  const idx = allRecords.findIndex((r: CloneRecord) => r.id === record.id)
                  if (idx >= 0) {
                    allRecords[idx].voiceServiceCloneId = newCloneId
                    await writeFile(CLONES_META_FILE, JSON.stringify(allRecords, null, 2))
                  }
                } catch {
                  /* ignore */
                }
              }
            } catch {
              console.warn('[TTS] Failed to parse register response')
            }
          } else {
            console.warn(`[TTS] Register clone failed (${record.name}): status=${regResult.status}`)
          }
        } catch (e) {
          console.warn('[TTS] Failed to register clone to Python service:', (e as Error).message)
        }
      }
    }

    console.log(`[TTS] Resolved cloneIds for Python service: ${JSON.stringify(resolvedCloneIds)}`)

    // 构建 cloneId → serviceId 的映射（本地ID → Python服务ID）
    const cloneIdToServiceId = new Map<string, string>()
    for (const cid of cloneIds) {
      const record = await getCloneRecord(cid)
      if (record?.voiceServiceCloneId) {
        cloneIdToServiceId.set(record.id, record.voiceServiceCloneId)
      }
    }

    // 转换 voice1 和 voice2 中的克隆声音ID（本地ID → Python服务ID）
    function resolveVoiceParam(voice: string | undefined): string {
      if (!voice) return ''
      if (!voice.startsWith('clone-')) return voice
      const localId = voice.replace('clone-', '')
      const serviceId = cloneIdToServiceId.get(localId)
      if (serviceId) {
        return `clone-${serviceId}`
      }
      return voice
    }

    const resolvedVoice1 = resolveVoiceParam(voice1)
    const resolvedVoice2 = resolveVoiceParam(voice2)
    console.log(`[TTS] Resolved voices: voice1=${voice1} -> ${resolvedVoice1}, voice2=${voice2} -> ${resolvedVoice2}`)

    // 确保输出目录存在
    const outputDir = path.join(process.cwd(), 'public', 'podcasts')
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    // 使用流式响应：逐行转发 Python 服务的进度事件，让前端实时显示进度
    // 重试 3 次，间隔 5 秒：dev 模式热重载可能导致请求中断，需要足够的重试机会
    const maxRetries = 3
    const timeout = 10800000 // 3小时（支持1小时以上长音频合成）
    const { body: formBody, contentType: formContentType } = buildMultipartFormData({
      script,
      clone_ids: JSON.stringify(resolvedCloneIds),
      podcast_type: podcastType || 'single',
      voice1: resolvedVoice1 || '',
      voice2: resolvedVoice2 || '',
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const parsedUrl = new URL(`${VOICE_SERVICE_URL}/synthesize-podcast`)

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[TTS] Attempt ${attempt}/${maxRetries}...`)

            const success = await new Promise<boolean>((resolve, reject) => {
              const req = http.request(
                {
                  hostname: parsedUrl.hostname,
                  port: parsedUrl.port,
                  path: parsedUrl.pathname + parsedUrl.search,
                  method: 'POST',
                  headers: {
                    'Content-Type': formContentType,
                    'Content-Length': formBody.length,
                  },
                  timeout,
                },
                (res) => {
                  if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    const errChunks: Buffer[] = []
                    res.on('data', (c: Buffer) => errChunks.push(c))
                    res.on('end', () => {
                      const errText = Buffer.concat(errChunks).toString('utf8')
                      console.error(`[TTS] Python service error: status=${res.statusCode}, body=${errText.slice(0, 500)}`)
                      reject(new Error(errText.slice(0, 200) || `HTTP ${res.statusCode}`))
                    })
                    return
                  }

                  let buffer = Buffer.alloc(0)
                  let audioPhase = false
                  let audioChunks: Buffer[] = []
                  let hasDoneEvent = false
                  let doneAudioUrl = ''
                  let doneDuration = 0
                  let doneEngine = ''

                  res.on('data', (chunk: Buffer) => {
                    if (audioPhase) {
                      audioChunks.push(chunk)
                      return
                    }

                    buffer = Buffer.concat([buffer, chunk])

                    // 逐行解析 NDJSON 事件
                    let newlineIdx: number
                    while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
                      const line = buffer.subarray(0, newlineIdx).toString('utf8')
                      buffer = buffer.subarray(newlineIdx + 1)

                      // 检查是否是音频分隔标记
                      if (line.trim() === '---AUDIO_DATA_START---') {
                        audioPhase = true
                        if (buffer.length > 0) {
                          audioChunks.push(buffer)
                          buffer = Buffer.alloc(0)
                        }
                        break
                      }

                      // 转发进度事件给前端
                      if (line.trim()) {
                        try {
                          const event = JSON.parse(line)
                          // 检查是否是最终完成事件
                          if (event.type === 'done') {
                            hasDoneEvent = true
                            // 保存 done 事件中的 audio_url 用于后续下载
                            if (event.audio_url) {
                              doneAudioUrl = event.audio_url
                              doneDuration = event.duration || 0
                              doneEngine = event.engine || ''
                            }
                          }
                          // 检查是否是错误事件
                          if (event.type === 'error') {
                            reject(new Error(event.error || event.message || 'Synthesis error'))
                            return
                          }
                          // 如果 done 事件包含 audio_url，不转发给前端（该 URL 指向 Python 服务，浏览器无法访问）
                          // TTS route 会在下载音频后发送带有正确 /podcasts/ URL 的 done 事件
                          if (event.type === 'done' && event.audio_url) {
                            // 跳过转发，由 res.on('end') 的下载逻辑发送正确的 done 事件
                          } else if (!controller.desiredSize || controller.desiredSize > 0) {
                            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
                          }
                        } catch {
                          // 忽略非 JSON 行
                        }
                      }
                    }
                  })

                  res.on('end', async () => {
                    if (audioChunks.length > 0) {
                      const audioBuffer = Buffer.concat(audioChunks)
                      const riffIdx = audioBuffer.indexOf('RIFF')
                      const finalAudio = riffIdx >= 0 ? audioBuffer.subarray(riffIdx) : audioBuffer

                      const podcastId = randomUUID()
                      const audioPath = path.join(outputDir, `${podcastId}.wav`)
                      await writeFile(audioPath, finalAudio)

                      const audioUrl = `/podcasts/${podcastId}.wav`
                      const duration = Math.max(30, Math.floor(script.length / 4))
                      const engine = resolvedCloneIds.length > 0 ? 'cosyvoice' : 'edge-tts'

                      // 发送最终完成事件（如果还没发过）
                      if (!hasDoneEvent) {
                        controller.enqueue(encoder.encode(JSON.stringify({
                          type: 'done',
                          success: true,
                          audioUrl,
                          duration,
                          engine,
                          podcastId,
                        }) + '\n'))
                      }
                      resolve(true)
                    } else if (hasDoneEvent && doneAudioUrl) {
                      // Python 端返回了 done 事件和 audio_url，但没有内嵌音频数据
                      // 需要从 Python 服务下载音频文件并保存到本地
                      try {
                        const audioFullUrl = `${VOICE_SERVICE_URL}${doneAudioUrl}`
                        console.log(`[TTS] Downloading audio from Python service: ${audioFullUrl}`)
                        
                        const audioChunksFromDownload: Buffer[] = []
                        await new Promise<void>((downloadResolve, downloadReject) => {
                          const parsed = new URL(audioFullUrl)
                          const downloadReq = http.request(
                            {
                              hostname: parsed.hostname,
                              port: parsed.port,
                              path: parsed.pathname,
                              method: 'GET',
                              timeout: 120000, // 2 分钟下载超时
                            },
                            (downloadRes) => {
                              if (downloadRes.statusCode && (downloadRes.statusCode < 200 || downloadRes.statusCode >= 300)) {
                                downloadReject(new Error(`Failed to download audio: HTTP ${downloadRes.statusCode}`))
                                return
                              }
                              downloadRes.on('data', (c: Buffer) => audioChunksFromDownload.push(c))
                              downloadRes.on('end', () => downloadResolve())
                              downloadRes.on('error', downloadReject)
                            }
                          )
                          downloadReq.on('error', downloadReject)
                          downloadReq.on('timeout', () => {
                            downloadReq.destroy(new Error('Download timeout'))
                          })
                          downloadReq.end()
                        })

                        if (audioChunksFromDownload.length > 0) {
                          const audioBuffer = Buffer.concat(audioChunksFromDownload)
                          const podcastId = randomUUID()
                          const audioPath = path.join(outputDir, `${podcastId}.wav`)
                          await writeFile(audioPath, audioBuffer)
                          const audioUrl = `/podcasts/${podcastId}.wav`
                          
                          console.log(`[TTS] Audio saved: ${audioUrl}, size=${audioBuffer.length} bytes`)
                          
                          // 给前端发送一个带正确 audioUrl 的 done 事件
                          const finalEngine = doneEngine || (resolvedCloneIds.length > 0 ? 'cosyvoice' : 'edge-tts')
                          controller.enqueue(encoder.encode(JSON.stringify({
                            type: 'done',
                            success: true,
                            audioUrl,
                            duration: doneDuration || Math.max(30, Math.floor(script.length / 4)),
                            engine: finalEngine,
                            podcastId,
                          }) + '\n'))
                          
                          resolve(true)
                        } else {
                          reject(new Error('Downloaded audio is empty'))
                        }
                      } catch (downloadErr) {
                        console.error('[TTS] Failed to download audio from Python service:', downloadErr)
                        reject(downloadErr as Error)
                      }
                    } else if (hasDoneEvent) {
                      // Python 端返回了 done 事件但没有 audio_url，也没有音频数据
                      reject(new Error('Done event received but no audio data or audio_url'))
                    } else {
                      reject(new Error('No audio data received'))
                    }
                  })

                  res.on('error', (err) => {
                    console.error('[TTS] Response stream error:', err.message)
                    reject(err)
                  })
                }
              )

              req.on('error', (err) => {
                const nodeErr = err as NodeJS.ErrnoException
                console.error(`[TTS] Request error (attempt ${attempt}):`, err.message || nodeErr.code || JSON.stringify({ code: nodeErr.code, errno: nodeErr.errno, syscall: nodeErr.syscall }))
                reject(err)
              })

              req.on('timeout', () => {
                req.destroy(new Error(`Request timeout after ${timeout}ms`))
              })

              req.write(formBody)
              req.end()
            })

            if (success) {
              console.log(`[TTS] Attempt ${attempt} succeeded`)
              controller.close()
              return
            }
          } catch (err) {
            lastError = err as Error
            console.error(`[TTS] Attempt ${attempt} failed:`, (err as Error).message)
            if (attempt < maxRetries) {
              // 发送重试通知给前端
              try {
                controller.enqueue(encoder.encode(JSON.stringify({
                  type: 'retry',
                  attempt: attempt + 1,
                  maxRetries,
                  error: (err as Error).message,
                }) + '\n'))
              } catch {
                // controller 可能已经关闭，忽略
              }
              await new Promise(resolve => setTimeout(resolve, 5000))
            }
          }
        }

        // 所有重试都失败了
        console.error('[TTS] All attempts failed')
        const errMsg = lastError?.message || 'Unknown error'
        try {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            error: `语音合成失败（重试${maxRetries}次）：${errMsg}`,
          }) + '\n'))
        } catch {
          // ignore
        }
        try {
          controller.close()
        } catch {
          // ignore
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('TTS synthesis error:', error)
    return NextResponse.json(
      { error: `语音合成失败: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
