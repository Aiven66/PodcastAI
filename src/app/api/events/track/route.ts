import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/events/track — 浏览器行为埋点上报。
 *
 * 契约来源：packages/analytics/sdk.ts trackEvent / trackCustomEvent
 *   payload：{ event_name, funnel_id, step_index, event_data, session_id,
 *             user_id, user_email, page_url, referrer }
 *   经 navigator.sendBeacon（Blob application/json）或 fetch keepalive 发送。
 *   SDK 永不抛错、不检查响应；本路由仍返回 JSON + 恰当状态码。
 *
 * 写入 behavior_events 表（supabase/migrations/0002_behavior_events.sql，
 * DDL 来自 packages/analytics/sql.ts，字段一致无适配）。
 *
 * 注意：不走 packages/analytics/server.ts trackServerEvent —— 其
 * session_id+event_name 幂等去重面向 webhook 重试，会丢弃同一会话内
 * 重复触发的埋点（漏斗 count 依赖事件总数）。
 */

interface TrackPayload {
  event_name?: unknown;
  funnel_id?: unknown;
  step_index?: unknown;
  event_data?: unknown;
  session_id?: unknown;
  user_id?: unknown;
  user_email?: unknown;
  page_url?: unknown;
  referrer?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackPayload;

    const eventName = typeof body.event_name === 'string' ? body.event_name : '';
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    if (!eventName) {
      return NextResponse.json({ error: 'event_name is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const eventData =
      body.event_data && typeof body.event_data === 'object' && !Array.isArray(body.event_data)
        ? (body.event_data as Record<string, unknown>)
        : {};

    const client = getSupabaseClient();
    const forwarded = request.headers.get('x-forwarded-for') || '';

    const { error } = await client.from('behavior_events').insert({
      event_name: eventName.slice(0, 100),
      funnel_id: typeof body.funnel_id === 'string' ? body.funnel_id.slice(0, 50) : null,
      step_index: typeof body.step_index === 'number' ? body.step_index : null,
      event_data: eventData,
      session_id: sessionId.slice(0, 200),
      user_id: typeof body.user_id === 'string' ? body.user_id.slice(0, 100) : null,
      user_email: typeof body.user_email === 'string' ? body.user_email.slice(0, 200) : null,
      page_url: typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : null,
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      user_agent: (request.headers.get('user-agent') || 'unknown').slice(0, 500),
      ip: forwarded.split(',')[0].trim().slice(0, 50) || null,
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true }, { status: 202 });
  } catch (err) {
    // 埋点失败只记录，不影响客户端（SDK 本身静默忽略响应）。
    console.error('[events/track] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to track event' },
      { status: 500 },
    );
  }
}
