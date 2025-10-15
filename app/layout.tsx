import './globals.css'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import { WorkspaceProvider } from '@/lib/workspaceContext'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user

  // If unauthenticated, render a blank shell (middleware already redirects to /login)
  if (!user) {
    return (
      <html lang="en">
        <body className={inter.className} suppressHydrationWarning={true}>
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    )
  }

  // Authenticated: show app chrome + sidebar with workspace context
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <WorkspaceProvider>
          <div className="flex h-screen overflow-hidden" suppressHydrationWarning={true}>
            <Sidebar logo="/logo.svg" />
            <main className="flex-1 bg-gray-50 overflow-y-auto ml-64" suppressHydrationWarning={true}>{children}</main>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  )
}