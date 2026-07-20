import { NextRequest, NextResponse } from 'next/server'
import { S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 文件上传API - 支持文本提取
export async function POST(request: NextRequest) {
  try {
    // 从header获取session token
    const sessionToken = request.headers.get('x-session')
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session token' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseClient(sessionToken)
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // 解析multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // 检查文件大小 (最大 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Max size: 10MB' },
        { status: 400 }
      )
    }

    // 检查文件扩展名
    const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx']
    
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: TXT, PDF, DOC, DOCX' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 根据文件类型提取文本内容
    let textContent = ''
    
    if (fileExt === '.txt') {
      // 纯文本文件直接读取
      textContent = buffer.toString('utf-8')
    } else if (fileExt === '.pdf') {
      // PDF文件提取 - 使用简单的方法
      textContent = await extractTextFromPdf(buffer)
    } else if (fileExt === '.doc' || fileExt === '.docx') {
      // Word文件提取 - 使用简单的方法  
      textContent = await extractTextFromDoc(buffer, fileExt)
    }

    // 如果提取失败，使用占位符
    if (!textContent || textContent.trim().length < 10) {
      textContent = `Content from file: ${file.name}. The file was uploaded but text extraction is limited for this file type.`
    }

    // 上传文件到对象存储
    const storage = new S3Storage()
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName: `uploads/${user.id}/${Date.now()}_${file.name}`,
      contentType: file.type || 'application/octet-stream',
    })

    // 生成预签名URL
    const fileUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效期
    })

    return NextResponse.json({
      success: true,
      fileKey,
      fileUrl,
      fileName: file.name,
      textContent,
      textLength: textContent.length,
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    )
  }
}

// 从PDF提取文本（简化实现）
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // 尝试将PDF转换为文本
    // 这里使用简单的字符串匹配来提取可见文本
    // 实际生产环境应该使用专业的PDF解析库如 pdf-parse
    const content = buffer.toString('binary')
    
    // 简单的文本提取 - 查找括号中的文本和BT...ET之间的文本
    const textMatches: string[] = []
    
    // 匹配 (text) 格式
    const parenRegex = /\(([^)]+)\)/g
    let match
    while ((match = parenRegex.exec(content)) !== null) {
      const text = match[1]
      // 过滤掉二进制数据
      if (/[\x20-\x7E]/.test(text) && text.length > 2) {
        textMatches.push(text)
      }
    }
    
    // 匹配 Tj 和 TJ 操作符前的文本
    const tjRegex = /\(([^)]+)\)\s*Tj/g
    while ((match = tjRegex.exec(content)) !== null) {
      const text = match[1]
      if (/[\x20-\x7E]/.test(text) && text.length > 2) {
        textMatches.push(text)
      }
    }
    
    if (textMatches.length > 0) {
      return textMatches.join(' ').replace(/\\+/g, ' ').trim()
    }
    
    return ''
  } catch {
    return ''
  }
}

// 从Word文档提取文本（简化实现）
async function extractTextFromDoc(buffer: Buffer, fileExt: string): Promise<string> {
  try {
    if (fileExt === '.docx') {
      // DOCX是ZIP格式，需要解析XML
      // 简单的文本提取
      const content = buffer.toString('binary')
      
      // DOCX中的文本存储在 word/document.xml 中
      // 简单匹配<w:t>标签中的内容
      const textMatches: string[] = []
      const tagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
      let match
      while ((match = tagRegex.exec(content)) !== null) {
        if (match[1] && match[1].trim()) {
          textMatches.push(match[1].trim())
        }
      }
      
      if (textMatches.length > 0) {
        return textMatches.join(' ')
      }
    } else {
      // DOC格式更复杂，这里做简单处理
      const content = buffer.toString('binary')
      // 简单提取可见ASCII字符序列
      const textMatch = content.match(/[\x20-\x7E]{10,}/g)
      if (textMatch) {
        return textMatch.join(' ').substring(0, 50000)
      }
    }
    
    return ''
  } catch {
    return ''
  }
}
