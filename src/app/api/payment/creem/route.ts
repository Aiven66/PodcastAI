import { NextRequest, NextResponse } from 'next/server';

/**
 * Creem 支付 API
 *
 * Demo 模式：使用内存 Map 存储 session 状态，模拟支付流程
 * 生产模式：调用 Creem API 创建/查询 checkout session
 */

// 支付方案配置
const PLAN_CONFIG: Record<string, { price: number; credits: number; name: string }> = {
  basic: { price: 9.99, credits: 500, name: 'Basic' },
  pro: { price: 29.99, credits: 2000, name: 'Pro' },
};

// Demo 模式 session 存储
interface DemoSession {
  sessionId: string;
  planId: string;
  userId: string;
  userEmail: string;
  paid: boolean;
  createdAt: number;
  expiresAt: number;
}

const demoSessions = new Map<string, DemoSession>();

// 清理过期 demo session
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of demoSessions.entries()) {
    if (session.expiresAt < now) {
      demoSessions.delete(id);
    }
  }
}

// Demo 模式判断：未配置 CREEM_API_KEY 即为 demo 模式
function isDemoMode(): boolean {
  return !process.env.CREEM_API_KEY;
}

// GET: 查询支付状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      cleanupExpiredSessions();
      const session = demoSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { paid: false, error: 'Session not found or expired' },
          { status: 404 }
        );
      }
      return NextResponse.json({ paid: session.paid });
    }

    // 生产模式：调用 Creem API 查询 session 状态
    const apiKey = process.env.CREEM_API_KEY!;
    const response = await fetch(`https://api.creem.io/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[Creem] Status check failed:', response.status, text);
      return NextResponse.json(
        { paid: false, error: 'Failed to verify payment' },
        { status: 502 }
      );
    }

    const data: unknown = await response.json();
    // Creem 返回的 session 状态字段：paid / completed
    const paid = Boolean(
      (data as Record<string, unknown>)?.paid ||
      (data as Record<string, unknown>)?.status === 'paid' ||
      (data as Record<string, unknown>)?.status === 'completed'
    );

    return NextResponse.json({ paid });
  } catch (error) {
    console.error('[Creem] GET error:', error);
    return NextResponse.json(
      { paid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 创建 checkout session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      planId?: string;
      userId?: string;
      userEmail?: string;
    };
    const { planId, userId, userEmail } = body;

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'Missing planId or userId' },
        { status: 400 }
      );
    }

    const plan = PLAN_CONFIG[planId];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid planId' },
        { status: 400 }
      );
    }

    // Demo 模式：生成模拟 session
    if (isDemoMode()) {
      cleanupExpiredSessions();
      const sessionId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000; // 5 分钟过期

      // Demo 模式直接标记为已支付，模拟支付成功
      demoSessions.set(sessionId, {
        sessionId,
        planId,
        userId,
        userEmail: userEmail || '',
        paid: true,
        createdAt: now,
        expiresAt,
      });

      console.log(`[Creem Demo] Created session ${sessionId} for plan ${planId} (user ${userId})`);

      return NextResponse.json({
        checkoutUrl: '/pricing?demo_checkout=success',
        sessionId,
        demo: true,
      });
    }

    // 生产模式：调用 Creem API 创建 checkout session
    const apiKey = process.env.CREEM_API_KEY!;
    const productId = process.env.CREEM_PRODUCT_ID;

    if (!productId) {
      console.error('[Creem] CREEM_PRODUCT_ID is not configured');
      return NextResponse.json(
        { error: 'Payment product is not configured' },
        { status: 500 }
      );
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/pricing?checkout=success`;
    const customerEmail = userEmail || '';

    const requestBody: Record<string, unknown> = {
      product_id: productId,
      success_url: successUrl,
      metadata: {
        planId,
        userId,
        credits: plan.credits,
      },
    };

    if (customerEmail) {
      requestBody.customer_email = customerEmail;
    }

    const response = await fetch('https://api.creem.io/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[Creem] Create checkout failed:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const checkoutUrl = (data.checkout_url as string) || (data.url as string) || '';
    const sessionId = (data.id as string) || (data.session_id as string) || '';

    if (!checkoutUrl) {
      console.error('[Creem] No checkout URL in response:', data);
      return NextResponse.json(
        { error: 'Invalid checkout response' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      checkoutUrl,
      sessionId,
    });
  } catch (error) {
    console.error('[Creem] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
