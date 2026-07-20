'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'
import { Menu, Globe, User as UserIcon, LogOut, Settings, LayoutDashboard, Mic, Headphones, Shield, Download } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', labelZh: '首页' },
  { href: '/pricing', label: 'Pricing', labelZh: '价格' },
  { href: '/download', label: 'Download', labelZh: '下载' },
  { href: '/blog', label: 'Blog', labelZh: '博客' },
  { href: '/faq', label: 'FAQ', labelZh: '常见问题' },
  { href: '/feedback', label: 'Feedback', labelZh: '用户反馈' },
  { href: '/about', label: 'About', labelZh: '关于我们' },
]

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className="gap-1 text-muted-foreground hover:text-foreground"
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm">{locale === 'en' ? 'EN' : '中'}</span>
    </Button>
  )
}

function UserMenu({ 
  email, 
  name, 
  isAdmin, 
  onLogout 
}: { 
  email: string; 
  name: string; 
  isAdmin: boolean; 
  onLogout: () => void 
}) {
  const { locale, t } = useLocale()
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{name[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex flex-col space-y-1 p-2">
          <p className="text-sm font-medium leading-none">{name}</p>
          <p className="text-xs leading-none text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/console" className="cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>{t('Console', '控制台')}</span>
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              <span>{t('Admin Panel', '管理后台')}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('Sign Out', '退出登录')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const { user, loading, signOut } = useAuth()
  const { locale, t } = useLocale()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // 同时支持 email 与 role 两种判断方式，保证 Supabase 与 Demo 模式下都生效
    const isAdminUser = user?.email === 'admin@126.com' || user?.role === 'admin'
    setIsAdmin(isAdminUser)
  }, [user])

  const handleLogout = useCallback(async () => {
    await signOut()
  }, [signOut])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <Headphones className="h-6 w-6" />
          <span>PodcastAI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.href
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {locale === 'en' ? item.label : item.labelZh}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* 突出的下载客户端 CTA 按钮（桌面端） */}
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/download">
              <Download className="h-4 w-4 mr-1.5" />
              {t('Download', '下载客户端')}
            </Link>
          </Button>

          <LanguageSwitcher />

          {loading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <UserMenu
              email={user.email}
              name={user.name || user.email.split('@')[0]}
              isAdmin={isAdmin}
              onLogout={handleLogout}
            />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/login">{t('Sign In', '登录')}</Link>
            </Button>
          )}
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col gap-4 mt-8">
                {/* 突出的下载客户端 CTA 按钮（移动端） */}
                <Button asChild className="w-full" size="lg">
                  <Link href="/download" onClick={() => setMobileMenuOpen(false)}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('Download Desktop Client', '下载桌面客户端')}
                  </Link>
                </Button>

                <div className="border-t pt-4" />

                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-lg font-medium transition-colors hover:text-primary ${
                      pathname === item.href
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {locale === 'en' ? item.label : item.labelZh}
                  </Link>
                ))}
                {user && (
                  <>
                    <Link
                      href="/console"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg font-medium transition-colors hover:text-primary text-muted-foreground"
                    >
                      {t('Console', '控制台')}
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg font-medium transition-colors hover:text-primary text-muted-foreground"
                      >
                        {t('Admin Panel', '管理后台')}
                      </Link>
                    )}
                  </>
                )}
                <div className="border-t pt-4 mt-4">
                  {user ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('Sign Out', '退出登录')}
                    </Button>
                  ) : (
                    <Button asChild className="w-full" variant="outline">
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        {t('Sign In', '登录')}
                      </Link>
                    </Button>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
