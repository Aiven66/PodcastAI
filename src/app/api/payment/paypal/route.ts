import { NextRequest, NextResponse } from 'next/server';

/**
 * PayPal 支付 API
 *
 * GET: 返回 PayPal 配置（客户端 SDK 使用）
 * POST: 处理订单创建和扣款
 *
 * Demo 模式：返回模拟响应
 * 生产模式：调用 PayPal REST API
 */

// 支付方案配置
const PLAN_CONFIG: Record<string, { price: number; credits: number; name: string }> = {
  basic: { price: 9.99, credits: 500, name: 'Basic' },
  pro: { price: 29.99, credits: 2000, name: 'Pro' },
};

// PayPal 环境基础 URL
function getPayPalBaseApiUrl(): string {
  const env = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
  return env === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// Demo 模式判断：缺少 CLIENT_ID 或 CLIENT_SECRET 即为 demo 模式
function isPayPalDemoMode(): boolean {
  return !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;
}

// 获取 PayPal access token（生产模式）
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const baseUrl = getPayPalBaseApiUrl();

  const token = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PayPal auth failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('PayPal auth returned no access_token');
  }
  return data.access_token;
}

// GET: 返回 PayPal 配置
export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
  const currency = process.env.PAYPAL_CURRENCY || 'USD';

  if (!clientId) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    clientId,
    currency,
    environment,
  });
}

// POST: 处理订单创建和扣款
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action?: 'create' | 'capture';
      planId?: string;
      userId?: string;
      orderId?: string;
    };

    const { action } = body;

    if (action === 'create') {
      return await handleCreateOrder(body);
    } else if (action === 'capture') {
      return await handleCaptureOrder(body);
    }

    return NextResponse.json(
      { error: 'Invalid action, must be "create" or "capture"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PayPal] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 创建订单
async function handleCreateOrder(body: { planId?: string; userId?: string }) {
  const { planId, userId } = body;

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

  // Demo 模式：返回模拟订单 ID
  if (isPayPalDemoMode()) {
    const orderId = `demo_order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[PayPal Demo] Created order ${orderId} for plan ${planId} (user ${userId})`);
    return NextResponse.json({
      orderId,
      demo: true,
    });
  }

  // 生产模式：调用 PayPal API 创建订单
  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseApiUrl();
    const currency = process.env.PAYPAL_CURRENCY || 'USD';

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: plan.price.toFixed(2),
            },
            description: `${plan.name} subscription - ${plan.credits} credits`,
            custom_id: `${planId}:${userId}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[PayPal] Create order failed:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to create PayPal order' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      console.error('[PayPal] No order ID in response:', data);
      return NextResponse.json(
        { error: 'Invalid PayPal response' },
        { status: 502 }
      );
    }

    return NextResponse.json({ orderId: data.id });
  } catch (error) {
    console.error('[PayPal] Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create PayPal order' },
      { status: 502 }
    );
  }
}

// 扣款
async function handleCaptureOrder(body: { planId?: string; userId?: string; orderId?: string }) {
  const { planId, userId, orderId } = body;

  if (!orderId) {
    return NextResponse.json(
      { error: 'Missing orderId' },
      { status: 400 }
    );
  }

  // Demo 模式：模拟扣款成功
  if (isPayPalDemoMode()) {
    console.log(`[PayPal Demo] Captured order ${orderId} for plan ${planId} (user ${userId})`);
    return NextResponse.json({
      paid: true,
      demo: true,
    });
  }

  // 生产模式：调用 PayPal API 扣款
  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseApiUrl();

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[PayPal] Capture failed:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to capture PayPal payment' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      status?: string;
      id?: string;
    };

    // PayPal capture 成功时 status 为 'COMPLETED'
    const paid = data.status === 'COMPLETED';

    return NextResponse.json({ paid });
  } catch (error) {
    console.error('[PayPal] Capture error:', error);
    return NextResponse.json(
      { error: 'Failed to capture PayPal payment' },
      { status: 502 }
    );
  }
}
