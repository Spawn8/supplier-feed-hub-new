import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await req.formData()
    const avatar = formData.get('avatar') as File
    const workspaceId = formData.get('workspace_id') as string

    if (!avatar || !workspaceId) {
      return NextResponse.json({ 
        error: 'Avatar file and workspace ID are required' 
      }, { status: 400 })
    }

    // Validate file type
    if (!avatar.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'File must be an image' 
      }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (avatar.size > 5 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size must be less than 5MB' 
      }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'workspaces')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = avatar.name.split('.').pop()
    const filename = workspaceId === 'temp' 
      ? `temp-${timestamp}.${fileExtension}`
      : `${workspaceId}-${timestamp}.${fileExtension}`
    const filepath = join(uploadsDir, filename)

    // Save file
    const bytes = await avatar.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Generate public URL
    const logoUrl = `/uploads/workspaces/${filename}`

    return NextResponse.json({ 
      success: true,
      logo_url: logoUrl 
    })
  } catch (error: any) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
