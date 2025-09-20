import './globals.css'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import { getMyWorkspaces, getCurrentWorkspaceId } from '@/lib/workspace'

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
