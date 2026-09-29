'use client'

import { useState, Suspense, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Headphones,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Monitor,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  MailCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'
// 复用 packages/auth 桌面端桥接能力
import {
  syncDesktopAuthAndOpen,
  normalizeDesktopCallbackUrl,
  type DesktopAuthPayload,
} from '../../../packages/auth/desktop-bridge'

const APP_NAME = 'PodcastAI'
const APP_ICON_URL =
  'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-06-07/7648490176158875686_1780806296.png?sign=4902870512-3079976b29-0-42ee12dce0d22bac106b67ff5047a40e957e7b5516dd3f75087939b60612f14a'

// Deep-link scheme：与桌面端 electron/src/main.ts DESKTOP_SCHEME 保持一致
const DESKTOP_SCHEME = 'podcastai'

type TabValue = 'login' | 'signup' | 'desktop'

interface CheckEmailResponse {
  exists?: boolean
  mode?: string
  error?: string
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'login'

  const { t } = useLocale()

  const { user, accessToken, loading: authLoading, signIn, signUp, verifySignUpCode, resendConfirmation, signInWithGoogle, signInWithDesktop, clearError } = useAuth()

  // v1.0.31: 桌面端发起的登录流程
  // 桌面端通过 shell.openExternal 打开: /login?mode=desktop&callbackUrl=http://127.0.0.1:port&scheme=podcastai
  // 登录成功后需通过 packages/auth/desktop-bridge 把 token 推送回桌面端
  const desktopCallbackUrl = searchParams.get('callbackUrl') || ''
  const desktopScheme = searchParams.get('scheme') || DESKTOP_SCHEME
  const isDesktopFlow = mode === 'desktop' && !!normalizeDesktopCallbackUrl(desktopCallbackUrl)
  const safeCallbackUrl = isDesktopFlow ? normalizeDesktopCallbackUrl(desktopCallbackUrl)! : ''

  // v1.0.78: 桌面端流程（mode=desktop）默认展示"登录"表单，而非"桌面端"tab
  // 之前 mode=desktop → initialTab='desktop' 会展示"桌面客户端验证"（反向流程 UI），
  // 从桌面端过来的用户被卡在循环验证界面，永远到不了登录表单
  const initialTab: TabValue =
    mode === 'signup' ? 'signup' : 'login'

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // 注册流程：info（填写信息）→ verify（输入邮件里的 6 位数字验证码）
  const [signupStep, setSignupStep] = useState<'info' | 'verify'>('info')
  const [code, setCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Desktop state
  const [desktopLoading, setDesktopLoading] = useState(false)
  // v1.0.31: 桌面端登录推送状态
  const [desktopRedirecting, setDesktopRedirecting] = useState(false)
  // v1.0.34: 保存 deep-link 和推送结果，供手动回跳按钮使用
  const [desktopDeepLink, setDesktopDeepLink] = useState<string>('')
  const [desktopSyncResult, setDesktopSyncResult] = useState<{ ok: boolean; error?: string } | null>(null)

  /**
   * v1.0.31: 把 token 推送回桌面端
   * 复用 packages/auth/desktop-bridge.syncDesktopAuthAndOpen:
   *   1. POST payload 到桌面端本地回调服务器（http://127.0.0.1:port）
   *   2. 通过 deep-link podcastai://login-success?token=... 回跳桌面端
   */
  const pushTokenToDesktop = useCallback(
    async (payload: DesktopAuthPayload): Promise<boolean> => {
      if (!isDesktopFlow) return false
      setDesktopRedirecting(true)
      try {
        const result = await syncDesktopAuthAndOpen(payload, desktopScheme, safeCallbackUrl)
        // v1.0.34: 保存 deep-link 和同步结果，供手动回跳按钮使用
        // 浏览器可能阻止无用户交互的自动 deep-link 跳转，需要提供手动按钮
        setDesktopDeepLink(result.deepLink)
        setDesktopSyncResult({ ok: result.localSync.ok, error: result.localSync.error })
        // localSync.ok 为 true 表示 POST 成功，桌面端已收到 token
        if (result.localSync.ok) {
          setSuccess(
            t(
              'Authentication sent to desktop app. You can close this tab.',
              '认证信息已发送到桌面客户端，可关闭此页面。'
            )
          )
        } else {
          setInfo(
            t(
              `Click the button below to return to the desktop app. (sync: ${result.localSync.error || 'use deep link'})`,
              `点击下方按钮返回桌面客户端。（${result.localSync.error || '使用 deep-link 回跳'}）`
            )
          )
        }
        return true
      } catch (err) {
        setError(
          t(
            `Failed to return to desktop app: ${err instanceof Error ? err.message : String(err)}`,
            `返回桌面客户端失败：${err instanceof Error ? err.message : String(err)}`
          )
        )
        setDesktopRedirecting(false)
        return false
      }
    },
    [isDesktopFlow, desktopScheme, safeCallbackUrl, t]
  )

  /**
   * v1.0.34: 手动触发 deep-link 回跳桌面客户端
   * 用户点击按钮触发（有用户交互），浏览器不会阻止 scheme 跳转
   */
  const handleManualReturnToDesktop = useCallback(() => {
    if (!desktopDeepLink) return
    try {
      window.location.href = desktopDeepLink
    } catch (err) {
      setError(
        t(
          `Failed to open desktop app: ${err instanceof Error ? err.message : String(err)}`,
          `打开桌面客户端失败：${err instanceof Error ? err.message : String(err)}`
        )
      )
    }
  }, [desktopDeepLink, t])

  // Auto-redirect already-logged-in users to home
  // v1.0.31: 桌面端流程下，已登录用户直接把 token 推送回桌面端，不跳转首页
  useEffect(() => {
    if (!user || authLoading) return
    if (isDesktopFlow && user) {
      // 桌面端流程：直接推送 token
      // 优先使用 auth context 中的 accessToken，回退到 localStorage（demo 模式）
      const token =
        accessToken ||
        (typeof window !== 'undefined' && localStorage.getItem('podcastai_access_token')) ||
        ''
      if (token) {
        const payload: DesktopAuthPayload = {
          token,
          email: user.email,
          userId: user.id,
          name: user.name,
        }
        pushTokenToDesktop(payload)
      }
      return
    }
    router.replace('/')
  }, [user, accessToken, authLoading, router, isDesktopFlow, pushTokenToDesktop])

  // 卸载时清理重发倒计时
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    }
  }, [])

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
    setInfo(null)
    clearError()
  }

  // 重发确认邮件的 60 秒倒计时
  const startResendCountdown = useCallback(() => {
    setResendCountdown(60)
    if (resendTimerRef.current) clearInterval(resendTimerRef.current)
    resendTimerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (!email || !password) {
      setError(t('Please fill in all fields', '请填写所有字段'))
      return
    }
    setIsLoading(true)
    try {
      const result = await signIn(email, password)
      if (result.error) {
        setError(result.error)
        return
      }
      // v1.0.31: 桌面端流程，把 token 推送回桌面客户端
      if (isDesktopFlow && result.token) {
        const payload: DesktopAuthPayload = {
          token: result.token,
          refreshToken: result.refreshToken || null,
          email: result.email || email,
          userId: null,
          name: null,
        }
        const pushed = await pushTokenToDesktop(payload)
        if (pushed) return
      }
      setSuccess(t('Login successful!', '登录成功！'))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Login failed', '登录失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (!name.trim()) {
      setError(t('Name is required', '请填写姓名'))
      return
    }
    if (!email.trim()) {
      setError(t('Email is required', '请填写邮箱'))
      return
    }
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters', '密码至少需要 6 个字符'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match', '两次密码不一致'))
      return
    }

    setIsLoading(true)
    try {
      // 先检查邮箱是否已注册（失败时不阻塞，最终以 signUp 结果为准）
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = (await checkRes.json().catch(() => ({}))) as CheckEmailResponse
      if (checkData.exists) {
        setError(
          t('This email is already registered. Please sign in.', '该邮箱已注册，请直接登录')
        )
        return
      }

      const result = await signUp(email, password, name.trim())
      if (result.error) {
        setError(result.error)
        return
      }

      // 已开启邮箱确认：需要用户输入邮件里的 6 位数字验证码才算注册完成
      if (result.requiresEmailConfirmation) {
        setCode('')
        setSignupStep('verify')
        startResendCountdown()
        setInfo(
          t(
            `A 6-digit verification code has been sent to ${email}. Enter it below to finish signing up.`,
            `6 位数字验证码已发送至 ${email}，请输入验证码完成注册。`
          )
        )
        return
      }

      // Demo 模式（未配置 Supabase）：注册即完成
      // v1.0.31: 桌面端流程，把 token 推送回桌面客户端
      if (isDesktopFlow && result.token) {
        const payload: DesktopAuthPayload = {
          token: result.token,
          refreshToken: result.refreshToken || null,
          email: result.email || email,
          userId: null,
          name: name.trim() || null,
        }
        const pushed = await pushTokenToDesktop(payload)
        if (pushed) return
      }
      setSuccess(t('Account created successfully!', '账号创建成功！'))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Signup failed', '注册失败'))
    } finally {
      setIsLoading(false)
    }
  }

  // 校验 6 位数字验证码，验证通过即完成注册
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (!/^\d{6}$/.test(code)) {
      setError(t('Please enter the 6-digit code', '请输入 6 位数字验证码'))
      return
    }
    setVerifyLoading(true)
    try {
      const result = await verifySignUpCode(email, code)
      if (result.error) {
        setError(result.error)
        return
      }

      // v1.0.31: 桌面端流程，把 token 推送回桌面客户端
      if (isDesktopFlow && result.token) {
        const payload: DesktopAuthPayload = {
          token: result.token,
          refreshToken: result.refreshToken || null,
          email: result.email || email,
          userId: null,
          name: name.trim() || null,
        }
        const pushed = await pushTokenToDesktop(payload)
        if (pushed) return
      }

      setSuccess(t('Email verified! Account created.', '邮箱验证成功，注册已完成！'))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Verification failed', '验证失败'))
    } finally {
      setVerifyLoading(false)
    }
  }

  // 重发 6 位数字验证码
  const handleResendConfirmation = async () => {
    clearMessages()
    setResendLoading(true)
    try {
      const result = await resendConfirmation(email)
      if (result.error) {
        setError(result.error)
        return
      }
      startResendCountdown()
      setInfo(t(`A new 6-digit code has been sent to ${email}.`, `新的 6 位验证码已发送至 ${email}。`))
    } finally {
      setResendLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    clearMessages()
    setIsLoading(true)
    try {
      // v1.0.31: 桌面端流程下，先把回调参数存入 sessionStorage，
      // /auth/callback 完成 Google 登录后会读取并推送 token 到桌面端
      if (isDesktopFlow && typeof window !== 'undefined') {
        sessionStorage.setItem(
          'podcastai_desktop_flow',
          JSON.stringify({
            callbackUrl: safeCallbackUrl,
            scheme: desktopScheme,
          })
        )
      }
      const result = await signInWithGoogle()
      if (result.error) {
        setError(result.error)
        setInfo(
          t(
            'Google login requires Supabase configuration',
            'Google 登录需要 Supabase 配置'
          )
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Google login failed', 'Google 登录失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDesktopLogin = async () => {
    clearMessages()
    setDesktopLoading(true)
    try {
      const result = await signInWithDesktop()
      if (result.error) {
        setError(result.error)
        setDesktopLoading(false)
        return
      }
      if (result.user) {
        setSuccess(t('Desktop authentication successful!', '桌面客户端认证成功！'))
        router.push('/')
      } else {
        setDesktopLoading(false)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Desktop authentication failed', '桌面客户端认证失败')
      )
      setDesktopLoading(false)
    }
  }

  const handleCancelDesktop = () => {
    setDesktopLoading(false)
    setError(t('Desktop authentication cancelled', '桌面客户端认证已取消'))
  }

  // Show loader during initial auth state check
  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // v1.0.31: 桌面端流程中，正在把 token 推送回桌面端，显示全屏 loader
  // v1.0.34: 添加手动"返回桌面客户端"按钮，浏览器可能阻止自动 deep-link 跳转
  if (desktopRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md w-full">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {t('Login Successful!', '登录成功！')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                'Authentication successful. Click the button below to return to the desktop app.',
                '认证成功，点击下方按钮返回桌面客户端。'
              )}
            </p>
            {desktopSyncResult && !desktopSyncResult.ok && desktopSyncResult.error && (
              <p className="text-xs text-muted-foreground">
                {t(
                  `Local sync: ${desktopSyncResult.error}`,
                  `本地同步：${desktopSyncResult.error}`
                )}
              </p>
            )}
          </div>
          {/* v1.0.34: 手动返回桌面客户端按钮 */}
          {desktopDeepLink && (
            <Button
              type="button"
              size="lg"
              className="w-full h-12 text-base"
              onClick={handleManualReturnToDesktop}
            >
              <Monitor className="h-5 w-5 mr-2" />
              {t('Return to Desktop App', '返回桌面客户端')}
            </Button>
          )}
          {/* 未收到 deepLink 时显示 loading */}
          {!desktopDeepLink && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('Preparing...', '准备中...')}
            </div>
          )}
          {/* 备用链接 */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              {t(
                "If the button doesn't work, make sure the PodcastAI desktop app is running.",
                '如果按钮无效，请确保 PodcastAI 桌面客户端正在运行。'
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const busy = isLoading || authLoading

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {/* v1.0.31: 桌面端流程提示横幅 */}
          {isDesktopFlow && (
            <Alert className="border-primary bg-primary/5 text-left">
              <Monitor className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                {t(
                  'Login here to authenticate the PodcastAI desktop app. You will be redirected back automatically.',
                  '在此登录以认证 PodcastAI 桌面客户端，登录后将自动返回桌面端。'
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={APP_ICON_URL}
              alt={APP_NAME}
              className="h-16 w-16 rounded-xl"
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">{APP_NAME}</span>
          </div>
          <CardDescription>
            {t('Sign in to create amazing podcasts', '登录以创建精彩的播客')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardTitle className="sr-only">{APP_NAME} {t('Login', '登录')}</CardTitle>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-primary bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">{success}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as TabValue)
              clearMessages()
            }}
            className="w-full"
          >
            {/* v1.0.78: 桌面端流程隐藏"桌面端"tab（循环流程无意义），只保留登录/注册 */}
            <TabsList className={`grid w-full ${isDesktopFlow ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <TabsTrigger value="login">{t('Login', '登录')}</TabsTrigger>
              <TabsTrigger value="signup">{t('Sign Up', '注册')}</TabsTrigger>
              {!isDesktopFlow && (
                <TabsTrigger value="desktop">{t('Desktop', '桌面端')}</TabsTrigger>
              )}
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('Email', '邮箱')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('your@email.com', '你的邮箱')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      disabled={busy}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('Password', '密码')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      disabled={busy}
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={t('Toggle password visibility', '切换密码可见性')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('Logging in...', '正在登录...')}
                    </>
                  ) : (
                    t('Sign In', '登录')
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">
                    {t('Or continue with', '或使用以下方式')}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-base border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                onClick={handleGoogleLogin}
                disabled={busy}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin text-gray-500" />
                ) : (
                  <GoogleIcon className="h-5 w-5 mr-2" />
                )}
                {t('Continue with Google', '使用 Google 登录')}
              </Button>

              {/* v1.0.78: 桌面端流程隐藏"使用桌面客户端"入口（循环流程） */}
              {!isDesktopFlow && (
                <div className="text-center pt-1">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-medium"
                    onClick={() => setActiveTab('desktop')}
                  >
                    <Monitor className="h-4 w-4 mr-1" />
                    {t('Use Desktop App', '使用桌面客户端')}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4">
              {signupStep === 'verify' ? (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="flex flex-col items-center text-center py-2 space-y-3">
                    <div className="rounded-full bg-primary/10 p-4">
                      <MailCheck className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold">
                        {t('Enter verification code', '请输入验证码')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('We sent a 6-digit code to', '我们已向以下邮箱发送 6 位数字验证码')}
                      </p>
                      <p className="text-sm font-medium break-all">{email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-code">{t('Verification Code', '验证码')}</Label>
                    <Input
                      id="signup-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                      disabled={verifyLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('The code is valid for 10 minutes.', '验证码 10 分钟内有效。')}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-base"
                    disabled={verifyLoading || code.length !== 6}
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('Verifying...', '验证中...')}
                      </>
                    ) : (
                      t('Verify and Create Account', '验证并完成注册')
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading || resendCountdown > 0}
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('Sending...', '发送中...')}
                      </>
                    ) : resendCountdown > 0 ? (
                      t(`Resend in ${resendCountdown}s`, `${resendCountdown} 秒后可重新发送`)
                    ) : (
                      t('Resend code', '重新发送验证码')
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setSignupStep('info')
                      setCode('')
                      clearMessages()
                    }}
                  >
                    {t('Use a different email', '更换邮箱')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t(
                      "Can't find the email? Please check your spam folder.",
                      '没收到邮件？请检查垃圾邮件文件夹。'
                    )}
                  </p>
                </form>
              ) : (
              <>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('Name', '姓名')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t('Your name', '你的姓名')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-11"
                      disabled={busy}
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('Email', '邮箱')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      disabled={busy}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('Password', '密码')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      disabled={busy}
                      autoComplete="new-password"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={t('Toggle password visibility', '切换密码可见性')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">{t('Confirm Password', '确认密码')}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      disabled={busy}
                      autoComplete="new-password"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={t('Toggle password visibility', '切换密码可见性')}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 text-base"
                  disabled={busy}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('Creating account...', '正在创建账号...')}
                    </>
                  ) : (
                    t('Create Account', '创建账号')
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">
                    {t('Or continue with', '或使用以下方式')}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-base border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                onClick={handleGoogleLogin}
                disabled={busy}
              >
                <GoogleIcon className="h-5 w-5 mr-2" />
                {t('Continue with Google', '使用 Google 登录')}
              </Button>
              </>
              )}
            </TabsContent>

            {/* Desktop Tab */}
            <TabsContent value="desktop" className="space-y-4">
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="rounded-full bg-primary/10 p-4">
                  <Monitor className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold">
                    {t('Desktop App Verification', '桌面客户端验证')}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t(
                      'Authenticate via the desktop client for a more secure and convenient experience.',
                      '通过桌面客户端完成身份验证，更安全便捷。'
                    )}
                  </p>
                </div>

                {desktopLoading ? (
                  <div className="w-full space-y-3 py-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {t('Waiting for desktop app...', '等待桌面客户端响应...')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleCancelDesktop}
                    >
                      {t('Cancel', '取消')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="w-full h-11 text-base"
                    onClick={handleDesktopLogin}
                    disabled={busy}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('Launch Desktop App', '启动桌面客户端')}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
