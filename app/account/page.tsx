import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import TimezoneSelect from '@/components/TimezoneSelect'

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Please <Link href="/login" className="text-blue-600">log in</Link>.</p>
      </main>
    )
  }

  const { data: pref } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle()

  const tz = pref?.timezone || 'UTC'

  return (
    <main className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <div className="space-y-4">
          <TimezoneSelect initialTz={tz} />
        </div>
      </div>
    </main>
  )
}
