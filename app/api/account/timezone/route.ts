import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's timezone preference
    const { data: userData } = await supabase
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', user.id)
      .single()

    const timezone = userData?.raw_user_meta_data?.timezone || 'UTC'

    return NextResponse.json({ timezone })
  } catch (error: any) {
    console.error('Error fetching timezone:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { timezone } = body

    if (!timezone) {
      return NextResponse.json({ 
        error: 'Timezone is required' 
      }, { status: 400 })
    }

    // Update user's timezone preference
    const { error } = await supabase.auth.updateUser({
      data: { timezone }
    })

    if (error) {
      console.error('Error updating timezone:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, timezone })
  } catch (error: any) {
    console.error('Error updating timezone:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}