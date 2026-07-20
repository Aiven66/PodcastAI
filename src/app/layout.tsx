import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SupabaseProvider } from '@/components/supabase-provider'
import { LocaleProvider } from '@/components/locale-provider'
import { AuthProvider } from '@/lib/auth-context'
import { GlobalFeedbackButton } from '@/components/global-feedback-button'
import '@/app/globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
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
      </body>
    </html>
  )
}