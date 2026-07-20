/**
 * Auth Context Adapter
 *
 * 适配 base 组件库的认证接口，支持真实 Supabase 和 demo 模式
 * 同时整合了 base AuthProvider 的 JWT Token 管理、桌面客户端唤起、邮箱验证码等能力
 */

'use client';

import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/components/supabase-provider';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
}

export interface DesktopAuthResult {
  user: User | null;
  token: string | null;
  error: string | null;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null; token?: string | null; refreshToken?: string | null; email?: string }>;
  signUp: (email: string, password: string, name: string, verificationCode?: string) => Promise<{ error: string | null; token?: string | null; refreshToken?: string | null; email?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithDesktop: () => Promise<DesktopAuthResult>;
  verifyDesktopToken: (token: string) => Promise<DesktopAuthResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo 模式相关常量
const DEMO_USER_KEY = 'podcastai_demo_user';
const DEMO_REGISTERED_USERS_KEY = 'podcastai_registered_users';
const DEMO_ACCESS_TOKEN_KEY = 'podcastai_access_token';
const DESKTOP_VERIFIER_KEY = 'podcastai_desktop_verifier';
const DESKTOP_AUTH_EVENT = 'podcastai:desktop-auth';

const DEMO_ADMINS: Record<string, { password: string; name: string; email: string }> = {
  'admin@126.com': { password: 'admin123', name: 'Admin', email: 'admin@126.com' },
};

interface RegisteredUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

function getRegisteredUsers(): RegisteredUser[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_REGISTERED_USERS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as RegisteredUser[];
  } catch {
    localStorage.removeItem(DEMO_REGISTERED_USERS_KEY);
    return [];
  }
}

function saveRegisteredUser(user: RegisteredUser) {
  if (typeof window === 'undefined') return;
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(DEMO_REGISTERED_USERS_KEY, JSON.stringify(users));
}

function findRegisteredUser(email: string, password: string): RegisteredUser | null {
  const users = getRegisteredUsers();
  return users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) || null;
}

function getDemoUser(): User | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(DEMO_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(DEMO_USER_KEY);
    return null;
  }
}

function saveDemoUser(user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
}

function clearDemoUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_USER_KEY);
}

function isDemoAdmin(email: string, password: string): boolean {
  const admin = DEMO_ADMINS[email.toLowerCase()];
  return !!admin && admin.password === password;
}

function getDemoAdminUser(email: string): User {
  const admin = DEMO_ADMINS[email.toLowerCase()];
  return {
    id: 'demo-admin-id',
    email: admin?.email || email,
    name: admin?.name || 'Admin',
    role: 'admin',
    avatarUrl: null,
  };
}

// ============= JWT 工具 (Demo 模式) =============

/**
 * 将字符串进行 URL-safe base64 编码
 */
function base64UrlEncode(input: string): string {
  if (typeof window === 'undefined') {
    return Buffer.from(input, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  // 浏览器环境：先 btoa（latin1），再转换为 URL-safe
  const b64 = btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 解码 URL-safe base64 字符串
 */
function base64UrlDecode(input: string): string {
  if (typeof window === 'undefined') {
    const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * 生成 JWT 格式的 demo token（仅用于 Demo 模式，不做真实签名验证）
 */
function generateDemoToken(user: User): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', demo: true }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: user.avatarUrl,
      iss: 'podcastai-demo',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    })
  );
  const signature = 'demo-signature';
  return `${header}.${payload}.${signature}`;
}

/**
 * 解析 JWT payload
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = base64UrlDecode(parts[1]);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 判断是否为 demo token
 */
function isDemoToken(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    return payload?.demo === true;
  } catch {
    return false;
  }
}

/**
 * 从 JWT token 中提取用户信息
 */
function createUserFromJwt(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const email = typeof payload.email === 'string' ? payload.email : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) return null;
  const name = typeof payload.name === 'string' ? payload.name : null;
  const role = typeof payload.role === 'string' ? payload.role : 'user';
  const avatarUrl = typeof payload.avatar_url === 'string' ? payload.avatar_url : null;
  return {
    id: sub,
    email,
    name: name || email.split('@')[0] || null,
    role,
    avatarUrl,
  };
}

// ============= PKCE 工具 (桌面客户端) =============

/**
 * 生成 PKCE verifier（随机字符串）
 */
function generatePkceVerifier(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < arr.length; i++) {
    result += chars[arr[i] % chars.length];
  }
  return result;
}

/**
 * 由 verifier 生成 PKCE challenge（S256）
 */
async function generatePkceChallenge(verifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // 服务端 / 不支持 SubtleCrypto：回退为明文（仅用于兼容，不推荐生产）
    return verifier;
  }
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ============= AuthProvider =============

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user: supabaseUser } = useSupabase();
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 用于桌面客户端认证的 Promise resolve/ref
  const desktopAuthResolverRef = useRef<((result: DesktopAuthResult) => void) | null>(null);

  // 初始化时检查 demo 用户与本地 token
  useEffect(() => {
    const checkDemoUser = () => {
      const user = getDemoUser();
      setDemoUser(user);
      // 恢复本地存储的 access token（demo 模式）
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(DEMO_ACCESS_TOKEN_KEY);
        if (token) {
          setAccessToken(token);
        }
      }
      setLoading(false);
    };

    if (typeof window !== 'undefined') {
      checkDemoUser();
    }
  }, []);

  // 监听桌面客户端回传事件
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDesktopAuth = async (event: Event) => {
      const customEvent = event as CustomEvent<{ token?: string; error?: string }>;
      const detail = customEvent.detail || {};
      const resolver = desktopAuthResolverRef.current;
      if (!resolver) return;

      if (detail.error) {
        resolver({ user: null, token: null, error: detail.error });
        desktopAuthResolverRef.current = null;
        return;
      }

      const token = detail.token || '';
      if (!token) {
        resolver({ user: null, token: null, error: 'No token received from desktop client' });
        desktopAuthResolverRef.current = null;
        return;
      }

      // 通过 API 校验 token
      try {
        const resp = await fetch('/api/auth/desktop-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await resp.json() as { user?: User; token?: string; error?: string };
        if (!resp.ok || data.error) {
          resolver({ user: null, token: null, error: data.error || 'Invalid desktop token' });
        } else {
          const verifiedUser = data.user || null;
          const verifiedToken = data.token || token;
          if (verifiedUser) {
            setDemoUser(verifiedUser);
            saveDemoUser(verifiedUser);
            setAccessToken(verifiedToken);
            if (typeof window !== 'undefined') {
              localStorage.setItem(DEMO_ACCESS_TOKEN_KEY, verifiedToken);
            }
          }
          resolver({ user: verifiedUser, token: verifiedToken, error: null });
        }
      } catch (err) {
        resolver({
          user: null,
          token: null,
          error: err instanceof Error ? err.message : 'Failed to verify desktop token',
        });
      } finally {
        desktopAuthResolverRef.current = null;
      }
    };

    window.addEventListener(DESKTOP_AUTH_EVENT, handleDesktopAuth as EventListener);
    return () => {
      window.removeEventListener(DESKTOP_AUTH_EVENT, handleDesktopAuth as EventListener);
    };
  }, []);

  // 当 supabase 用户变化时，清除 demo 用户
  useEffect(() => {
    if (supabaseUser && demoUser) {
      clearDemoUser();
      setDemoUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_ACCESS_TOKEN_KEY);
      }
    }
  }, [supabaseUser, demoUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);

    // Demo 模式登录
    if (!supabase) {
      if (isDemoAdmin(email, password)) {
        const adminUser = getDemoAdminUser(email);
        const demoToken = generateDemoToken(adminUser);
        saveDemoUser(adminUser);
        setDemoUser(adminUser);
        setAccessToken(demoToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem(DEMO_ACCESS_TOKEN_KEY, demoToken);
        }
        return { error: null, token: demoToken, email: adminUser.email };
      }

      const registered = findRegisteredUser(email, password);
      if (registered) {
        const user: User = {
          id: registered.id,
          email: registered.email,
          name: registered.name,
          role: 'user',
          avatarUrl: null,
        };
        const demoToken = generateDemoToken(user);
        saveDemoUser(user);
        setDemoUser(user);
        setAccessToken(demoToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem(DEMO_ACCESS_TOKEN_KEY, demoToken);
        }
        return { error: null, token: demoToken, email: user.email };
      }

      return { error: 'Invalid email or password / 邮箱或密码错误', token: null };
    }

    // Supabase 登录
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      return { error: authError.message, token: null };
    }

    const token = data.session?.access_token || null;
    if (token) {
      setAccessToken(token);
    }
    return {
      error: null,
      token,
      refreshToken: data.session?.refresh_token || null,
      email: data.user?.email,
    };
  }, [supabase]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string,
    verificationCode?: string,
  ) => {
    setError(null);

    // 邮箱验证码校验（如果传入了验证码）
    if (verificationCode) {
      try {
        const verifyResp = await fetch('/api/auth/send-verification-code', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: verificationCode }),
        });
        const verifyData = await verifyResp.json() as { verified?: boolean; error?: string };
        if (!verifyResp.ok || !verifyData.verified) {
          const errMsg = verifyData.error || 'Invalid verification code / 验证码错误';
          return { error: errMsg, token: null };
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Failed to verify code / 验证码校验失败',
          token: null,
        };
      }
    }

    // Demo 模式注册
    if (!supabase) {
      const existingUsers = getRegisteredUsers();
      const existing = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return { error: 'This email is already registered / 邮箱已被注册', token: null };
      }

      const userId = `demo-${Date.now()}`;
      saveRegisteredUser({ id: userId, email, password, name });

      const user: User = {
        id: userId,
        email,
        name,
        role: 'user',
        avatarUrl: null,
      };
      const demoToken = generateDemoToken(user);
      saveDemoUser(user);
      setDemoUser(user);
      setAccessToken(demoToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DEMO_ACCESS_TOKEN_KEY, demoToken);
      }
      return { error: null, token: demoToken, email };
    }

    // Supabase 注册
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError) {
      return { error: authError.message, token: null };
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        email,
        name,
        role: 'user',
      }, { onConflict: 'user_id' });

      const { data: existingCredits } = await supabase
        .from('credits')
        .select('id')
        .eq('user_id', data.user.id)
        .single();

      if (!existingCredits) {
        await supabase.from('credits').insert({
          user_id: data.user.id,
          balance: 100,
        });
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    if (token) {
      setAccessToken(token);
    }
    return {
      error: null,
      token,
      refreshToken: session?.refresh_token || null,
      email,
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);

    // Demo 模式：明确返回错误
    if (!supabase) {
      const msg = 'Google login requires Supabase configuration / Google 登录需要 Supabase 配置';
      setError(msg);
      return { error: msg };
    }

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
          scopes: 'email profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        const msg = `Google login failed: ${oauthError.message}`;
        setError(msg);
        return { error: msg };
      }

      // skipBrowserRedirect: true 时需要手动跳转到返回的 URL
      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google login failed / Google 登录失败';
      setError(msg);
      return { error: msg };
    }
  }, [supabase]);

  const signInWithDesktop = useCallback(async (): Promise<DesktopAuthResult> => {
    setError(null);

    if (typeof window === 'undefined') {
      return { user: null, token: null, error: 'Desktop auth is only available in browser / 桌面端登录仅可在浏览器中使用' };
    }

    // 生成 PKCE verifier 和 challenge
    const verifier = generatePkceVerifier();
    const challenge = await generatePkceChallenge(verifier);
    sessionStorage.setItem(DESKTOP_VERIFIER_KEY, verifier);

    // 构造桌面客户端唤起 URL
    const redirectUrl = `${window.location.origin}/auth/desktop-callback`;
    const desktopUrl = `podcastai://auth?verifier=${encodeURIComponent(verifier)}&challenge=${encodeURIComponent(challenge)}&redirect=${encodeURIComponent(redirectUrl)}`;

    return new Promise<DesktopAuthResult>((resolve) => {
      // 设置 resolver，由 DESKTOP_AUTH_EVENT 事件触发
      desktopAuthResolverRef.current = resolve;

      try {
        window.location.href = desktopUrl;
      } catch (err) {
        resolve({
          user: null,
          token: null,
          error: err instanceof Error ? err.message : 'Failed to launch desktop client / 唤起桌面客户端失败',
        });
        desktopAuthResolverRef.current = null;
      }

      // 超时处理：5 分钟未收到回传视为失败
      setTimeout(() => {
        if (desktopAuthResolverRef.current) {
          desktopAuthResolverRef.current({
            user: null,
            token: null,
            error: 'Desktop authentication timed out / 桌面端认证超时',
          });
          desktopAuthResolverRef.current = null;
        }
      }, 5 * 60 * 1000);
    });
  }, []);

  const verifyDesktopToken = useCallback(async (token: string): Promise<DesktopAuthResult> => {
    setError(null);

    if (!token) {
      return { user: null, token: null, error: 'Token is required / 缺少 token' };
    }

    try {
      const resp = await fetch('/api/auth/desktop-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json() as { user?: User; token?: string; error?: string };
      if (!resp.ok || data.error) {
        return { user: null, token: null, error: data.error || 'Invalid token / token 无效' };
      }

      const verifiedUser = data.user || null;
      const verifiedToken = data.token || token;
      if (verifiedUser) {
        setDemoUser(verifiedUser);
        saveDemoUser(verifiedUser);
        setAccessToken(verifiedToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem(DEMO_ACCESS_TOKEN_KEY, verifiedToken);
        }
      }
      return { user: verifiedUser, token: verifiedToken, error: null };
    } catch (err) {
      return {
        user: null,
        token: null,
        error: err instanceof Error ? err.message : 'Failed to verify token / token 校验失败',
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearDemoUser();
    setDemoUser(null);
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(DESKTOP_VERIFIER_KEY);
    }

    if (supabase) {
      await supabase.auth.signOut();
    }
  }, [supabase]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 优先使用 Supabase 用户，如果没有则使用 Demo 用户
  // admin@126.com 在 Supabase 与 Demo 模式下都识别为 admin 角色
  const user: User | null = supabaseUser ? {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
    role: (supabaseUser.email === 'admin@126.com' || supabaseUser.user_metadata?.role === 'admin')
      ? 'admin'
      : 'user',
    avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
  } : demoUser;

  // 同步当前用户到 localStorage（兼容 use-credits 等模块的 admin 检测）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      // 复用 DEMO_USER_KEY 让 isAdminUser() 在 Supabase 模式下也能识别
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    } else {
      // 仅在没有 supabase 用户且没有 demo 用户时清除
      if (!supabaseUser && !demoUser) {
        localStorage.removeItem(DEMO_USER_KEY);
      }
    }
  }, [user, supabaseUser, demoUser]);

  const value: AuthContextType = {
    user,
    accessToken,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithDesktop,
    verifyDesktopToken,
    signOut,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 导出 JWT 工具供外部使用
export { generateDemoToken, decodeJwtPayload, isDemoToken, createUserFromJwt };
