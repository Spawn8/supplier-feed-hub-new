// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Enforce authentication rules:
 * - Unauthenticated users are redirected to /login (except on public routes).
 * - Authenticated users cannot visit /login → redirect to /
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Create Supabase client bound to the request
  const res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: any) =>
          res.cookies.delete({ name, ...options }),
      },
    }
  )

  // Check auth
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user

  // Public paths allowed without auth
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/public/') ||
    pathname === '/favicon.ico'

  // If not authenticated and not on a public path → go to /login
  if (!user && !isPublic) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated and trying to access /login → send to dashboard
  if (user && pathname === '/login') {
    const dashUrl = req.nextUrl.clone()
    dashUrl.pathname = '/'
    dashUrl.search = ''
    return NextResponse.redirect(dashUrl)
  }

  // Otherwise continue
  return res
}

export const config = {
  // Run on all routes except Next static/image and favicon
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
