import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { sync_status, workspace_id } = await req.json()

    if (!sync_status || !workspace_id) {
      return NextResponse.json({ 
        error: 'sync_status and workspace_id are required' 
      }, { status: 400 })
    }

    // Update supplier sync status
    const { data, error } = await supabase
      .from('suppliers')
      .update({ 
        sync_status: sync_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierId)
      .eq('workspace_id', workspace_id)
      .select()

    if (error) {
      console.error('Error updating supplier sync status:', error)
      return NextResponse.json({ 
        error: `Failed to update sync status: ${error.message}` 
      }, { status: 500 })
    }

    console.log('✅ Updated supplier sync status to:', sync_status)
    return NextResponse.json({ 
      success: true,
      supplier: data[0]
    })
  } catch (error: any) {
    console.error('Error in update-sync-status API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
