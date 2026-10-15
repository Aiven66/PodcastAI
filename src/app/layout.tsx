import Script from 'next/script'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SupabaseProvider } from '@/components/supabase-provider'
import { LocaleProvider } from '@/components/locale-provider'
import { AuthProvider } from '@/lib/auth-context'
import { GlobalFeedbackButton } from '@/components/global-feedback-button'
import { AppConfigBridge } from '@/components/app-config-bridge'
import '@/app/globals.css'

/** Google Analytics 4 衡量 ID（账号级代码，全站唯一） */
const GA_MEASUREMENT_ID = 'G-DEF61061ZD'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <AppConfigBridge>
          <LocaleProvider>
            <SupabaseProvider>
              <AuthProvider>
                <div className="relative flex min-h-screen flex-col">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                  <GlobalFeedbackButton />
                </div>
              </AuthProvider>
            </SupabaseProvider>
          </LocaleProvider>
        </AppConfigBridge>
      </body>
    </html>
  )
}