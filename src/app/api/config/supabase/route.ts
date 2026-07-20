import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// 获取 Supabase 配置 API（用于前端初始化）
export async function GET() {
  try {
    // 尝试从环境变量获取
    let url = process.env.COZE_SUPABASE_URL
    let anonKey = process.env.COZE_SUPABASE_ANON_KEY
    
    // 如果环境变量不存在，尝试通过 CLI 获取
    if (!url || !anonKey) {
      const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`
      
      try {
        const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        
        const lines = output.trim().split('\n')
        for (const line of lines) {
          if (line.startsWith('#')) continue
          const eqIndex = line.indexOf('=')
          if (eqIndex > 0) {
            const key = line.substring(0, eqIndex)
            let value = line.substring(eqIndex + 1)
            if ((value.startsWith("'") && value.endsWith("'")) ||
                (value.startsWith('"') && value.endsWith('"'))) {
              value = value.slice(1, -1)
            }
            if (key === 'COZE_SUPABASE_URL' && !url) {
              url = value
            }
            if (key === 'COZE_SUPABASE_ANON_KEY' && !anonKey) {
              anonKey = value
            }
          }
        }
      } catch {
        // 忽略错误
      }
    }
    
    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration not found' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      url,
      anonKey
    })
  } catch (error) {
    console.error('Failed to get Supabase config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}