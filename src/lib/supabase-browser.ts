import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
let configPromise: Promise<{ url: string; anonKey: string }> | undefined

// 获取 Supabase 配置
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  if (configPromise) {
    return configPromise
  }
  
  configPromise = fetch('/api/config/supabase')
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error)
      }
      return data
    })
  
  return configPromise
}

// 创建 Supabase 浏览器客户端
export async function createSupabaseBrowserClient(): Promise<SupabaseClient> {
  const config = await getSupabaseConfig()
  return createClient(config.url, config.anonKey)
}

// 获取 Supabase 浏览器客户端（同步版本，使用缓存）
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) {
    return client
  }
  
  // 如果还没有初始化，抛出错误提示使用异步版本
  throw new Error('Supabase client not initialized. Use createSupabaseBrowserClient() first.')
}

// 初始化客户端（用于 useEffect 中）
export async function initSupabaseClient(): Promise<SupabaseClient> {
  if (client) {
    return client
  }
  client = await createSupabaseBrowserClient()
  return client
}