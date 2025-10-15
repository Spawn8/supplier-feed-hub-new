import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { reorderCustomFields } from '@/lib/fields'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
    }

    const body = await req.json()
    const { fieldOrders } = body

    if (!Array.isArray(fieldOrders)) {
      return NextResponse.json({ 
        error: 'fieldOrders must be an array' 
      }, { status: 400 })
    }

    // Validate field orders
    for (const order of fieldOrders) {
      if (!order.id || typeof order.sort_order !== 'number') {
        return NextResponse.json({ 
          error: 'Each field order must have id and sort_order' 
        }, { status: 400 })
      }
    }

    // Reorder fields
    const result = await reorderCustomFields(workspaceId, fieldOrders)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error reordering fields:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}