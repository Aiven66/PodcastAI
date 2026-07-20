import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  try {
    const { voiceId } = await params
    const voiceServiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:8907'
    const audioUrl = `${voiceServiceUrl}/system-voice-preview/${voiceId}`

    const response = await fetch(audioUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'max-age=3600',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch system voice preview' },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'audio/wav'

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (error) {
    console.error('System voice preview proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
