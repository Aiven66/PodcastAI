'use client'

import Link from 'next/link'
import { Headphones, Twitter, Youtube, Github, Mail } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

export function Footer() {
  const { locale, t } = useLocale()
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <Headphones className="h-5 w-5" />
              <span>PodcastAI</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t(
                'Transform your content into engaging podcasts with AI-powered voice synthesis.',
                '利用AI语音合成技术，将您的内容转化为引人入胜的播客。'
              )}
            </p>
          </div>
          
          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('Product', '产品')}</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                {t('Pricing', '价格')}
              </Link>
              <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">
                {t('FAQ', '常见问题')}
              </Link>
              <Link href="/feedback" className="text-sm text-muted-foreground hover:text-foreground">
                {t('Feedback', '用户反馈')}
              </Link>
            </nav>
          </div>
          
          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('Company', '公司')}</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                {t('About Us', '关于我们')}
              </Link>
              <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
                {t('Blog', '博客')}
              </Link>
            </nav>
          </div>
          
          {/* Social */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('Connect', '联系我们')}</h3>
            <nav className="flex gap-4">
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Youtube className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Mail className="h-5 w-5" />
              </Link>
            </nav>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} PodcastAI. {t('All rights reserved.', '保留所有权利。')}
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">{t('Privacy Policy', '隐私政策')}</Link>
            <Link href="#" className="hover:text-foreground">{t('Terms of Service', '服务条款')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}