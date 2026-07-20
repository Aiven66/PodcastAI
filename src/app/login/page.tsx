'use client'

import { useState, Suspense, useEffect } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'

const APP_NAME = 'PodcastAI'
const APP_ICON_URL =
  'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-06-07/7648490176158875686_1780806296.png?sign=4902870512-3079976b29-0-42ee12dce0d22bac106b67ff5047a40e957e7b5516dd3f75087939b60612f14a'

type TabValue = 'login' | 'signup' | 'desktop'
type SignupStep = 'info' | 'verify'

interface CheckEmailResponse {
  exists?: boolean
  mode?: string
  error?: string
}

interface SendCodeResponse {
  success?: boolean
  demo?: boolean
  code?: string
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

  const { locale } = useLocale()
  const t = (en: string, zh: string) => (locale === 'en' ? en : zh)

  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, signInWithDesktop, clearError } = useAuth()

  const initialTab: TabValue =
    mode === 'signup' ? 'signup' : mode === 'desktop' ? 'desktop' : 'login'

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Signup state
  const [signupStep, setSignupStep] = useState<SignupStep>('info')
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Desktop state
  const [desktopLoading, setDesktopLoading] = useState(false)

  // Auto-redirect already-logged-in users to home
  useEffect(() => {
    if (user && !authLoading) {
      router.replace('/')
    }
  }, [user, authLoading, router])

  // Countdown timer using setTimeout pattern (re-creates on each tick)
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => {
      setCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
    setInfo(null)
    clearError()
  }

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
      setSuccess(t('Login successful!', '登录成功！'))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Login failed', '登录失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
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

    setSendingCode(true)
    try {
      // Check if email is already registered
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = (await checkRes.json().catch(() => ({}))) as CheckEmailResponse
      if (!checkRes.ok) {
        setError(checkData.error || t('Failed to check email', '检查邮箱失败'))
        return
      }
      if (checkData.exists) {
        setError(
          t('This email is already registered. Please sign in.', '该邮箱已注册，请直接登录')
        )
        return
      }

      // Send verification code
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json().catch(() => ({}))) as SendCodeResponse
      if (!res.ok || !data.success) {
        setError(data.error || t('Failed to send verification code', '验证码发送失败'))
        return
      }

      setSignupStep('verify')
      setCountdown(60)
      if (data.demo && typeof data.code === 'string') {
        setInfo(t(`Demo code: ${data.code}`, `演示验证码：${data.code}`))
      } else {
        setSuccess(t('Verification code sent. Check your inbox.', '验证码已发送，请查收邮件'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Network error', '网络错误'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (code.length !== 6) {
      setError(t('Please enter the 6-digit code', '请输入 6 位验证码'))
      return
    }
    setIsLoading(true)
    try {
      const result = await signUp(email, password, name.trim(), code)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(t('Account created successfully!', '账号创建成功！'))
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Signup failed', '注册失败'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0 || sendingCode) return
    clearMessages()
    setSendingCode(true)
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json().catch(() => ({}))) as SendCodeResponse
      if (!res.ok || !data.success) {
        setError(data.error || t('Failed to resend code', '重新发送失败'))
        return
      }
      setCountdown(60)
      if (data.demo && typeof data.code === 'string') {
        setInfo(t(`Demo code: ${data.code}`, `演示验证码：${data.code}`))
      } else {
        setSuccess(t('Verification code resent. Check your inbox.', '验证码已重新发送，请查收'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Network error', '网络错误'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleGoogleLogin = async () => {
    clearMessages()
    setIsLoading(true)
    try {
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

  const handleBackToInfo = () => {
    setSignupStep('info')
    setCode('')
    setCountdown(0)
    clearMessages()
  }

  // Show loader during initial auth state check
  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const busy = isLoading || authLoading

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">{t('Login', '登录')}</TabsTrigger>
              <TabsTrigger value="signup">{t('Sign Up', '注册')}</TabsTrigger>
              <TabsTrigger value="desktop">{t('Desktop', '桌面端')}</TabsTrigger>
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
                      placeholder="admin@126.com"
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

              <div className="text-xs text-muted-foreground text-center">
                {t('Demo Admin: admin@126.com / admin123', '演示管理员：admin@126.com / admin123')}
              </div>

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
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4">
              {signupStep === 'info' ? (
                <form onSubmit={handleSendCode} className="space-y-4">
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
                        disabled={sendingCode || busy}
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
                        disabled={sendingCode || busy}
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
                        disabled={sendingCode || busy}
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
                        disabled={sendingCode || busy}
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
                    disabled={sendingCode || busy}
                  >
                    {sendingCode ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('Sending code...', '正在发送验证码...')}
                      </>
                    ) : (
                      t('Send Verification Code', '发送验证码')
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-code">{t('Verification Code', '验证码')}</Label>
                    <Input
                      id="signup-code"
                      type="text"
                      inputMode="numeric"
                      placeholder={t('Enter 6-digit code', '请输入 6 位验证码')}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6}
                      className="h-12 text-center text-xl tracking-widest"
                      disabled={busy}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {t(
                        `We sent a verification code to ${email}`,
                        `验证码已发送至 ${email}`
                      )}
                    </p>
                  </div>
                  <Button type="submit" className="w-full h-11 text-base" disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('Creating account...', '正在创建账号...')}
                      </>
                    ) : (
                      t('Create Account', '创建账号')
                    )}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    {t("Didn't receive the code? ", '没有收到验证码？')}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                      disabled={countdown > 0 || sendingCode}
                      onClick={handleResendCode}
                    >
                      {countdown > 0
                        ? t(`Resend in ${countdown}s`, `${countdown}s 后可重发`)
                        : sendingCode
                          ? t('Sending...', '发送中...')
                          : t('Resend code', '重新发送')}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="block mx-auto text-xs text-muted-foreground hover:underline"
                    onClick={handleBackToInfo}
                  >
                    {t('← Back to edit info', '← 返回修改信息')}
                  </button>
                </form>
              )}

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
                disabled={busy || sendingCode}
              >
                <GoogleIcon className="h-5 w-5 mr-2" />
                {t('Continue with Google', '使用 Google 登录')}
              </Button>
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
