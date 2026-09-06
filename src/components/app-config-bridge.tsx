'use client';

/**
 * AppConfigProvider 桥接层
 *
 * 复用项目自有的动态配置管道（/api/config/supabase）拉取 Supabase
 * 连接参数，注入 @clipop/core 的 AppConfigProvider。
 *
 * 两阶段初始化：
 * 1. 立即用静态配置（appName / appUrl / plans / admin）渲染 —— Supabase
 *    未就绪时 packages 组件按设计降级为 placeholder，页面不空白。
 * 2. 配置拉取成功后合并 Supabase 连接参数重新渲染。
 */

import { useEffect, useState, ReactNode } from 'react';
import { AppConfigProvider } from '@packages/core/config';
import { buildClientConfig } from '@/lib/app-config';

interface SupabaseConfigResponse {
  url: string;
  anonKey: string;
}

export function AppConfigBridge({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<{ url: string; anonKey: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSupabaseConfig() {
      try {
        const res = await fetch('/api/config/supabase');
        if (!res.ok) return;
        const data = (await res.json()) as SupabaseConfigResponse;
        if (mounted && data.url && data.anonKey) {
          setSupabase({ url: data.url, anonKey: data.anonKey });
        }
      } catch {
        // Supabase 未配置（本地开发 / demo 模式），保持降级配置
      }
    }

    loadSupabaseConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const config = buildClientConfig({
    supabaseUrl: supabase?.url,
    supabaseAnonKey: supabase?.anonKey,
  });

  return <AppConfigProvider value={config}>{children}</AppConfigProvider>;
}
