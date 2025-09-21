import './globals.css'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getMyWorkspaces, getCurrentWorkspaceId } from '@/lib/workspace'

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user

  // If unauthenticated, render a blank shell (middleware already redirects to /login)
  if (!user) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    )
  }

  // Authenticated: show app chrome + sidebar
  const workspaces = await getMyWorkspaces()
  const wsId = await getCurrentWorkspaceId()

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex">
          <Sidebar logo="/logo.svg" workspaces={workspaces} activeWsId={wsId} />
          <main className="flex-1 bg-gray-50 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  )
}
