import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

// Import the same suppliers store used in creation
import { suppliersStore } from '../../route'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const workspaceId = formData.get('workspace_id') as string
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const { id: supplierId } = await params

    // Read the file content
    const fileContent = await file.text()
    const fileName = file.name.toLowerCase()
    
    let fields: string[] = []

    try {
      if (fileName.endsWith('.xml')) {
        fields = extractFieldsFromXML(fileContent)
      } else if (fileName.endsWith('.csv')) {
        fields = extractFieldsFromCSV(fileContent)
      } else if (fileName.endsWith('.json')) {
        fields = extractFieldsFromJSON(fileContent)
      } else {
        return NextResponse.json({ 
          error: 'Unsupported file format. Please upload XML, CSV, or JSON files.' 
        }, { status: 400 })
      }
    } catch (parseError) {
      console.error('Error parsing file:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse file. Please check the file format.' 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      fields: fields,
      total_records: 1, // We only analyze the structure, not count records
      file_type: fileName.split('.').pop()?.toUpperCase()
    })
  } catch (error: any) {
    console.error('Error extracting fields:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

function extractFieldsFromXML(content: string): string[] {
  const fields = new Set<string>()
  
  try {
    // Look for product/item nodes first
    const productRegex = /<(product|item|entry)[^>]*>([\s\S]*?)<\/\1>/gi
    const productMatches = content.match(productRegex)
    
    if (productMatches && productMatches.length > 0) {
      // Extract fields from the first product/item
      const firstProduct = productMatches[0]
      const fieldRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g
      let match
      
      while ((match = fieldRegex.exec(firstProduct)) !== null) {
        const fieldName = match[1]
        // Skip common XML wrapper tags
        if (!['product', 'item', 'entry', 'products', 'items', 'entries'].includes(fieldName.toLowerCase())) {
          fields.add(fieldName)
        }
      }
    } else {
      // Fallback: extract all unique XML tags
      const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g
      let match
      
      while ((match = tagRegex.exec(content)) !== null) {
        const fieldName = match[1]
        // Skip common XML wrapper tags and document structure
        if (!['xml', 'root', 'data', 'products', 'items', 'entries', 'catalog'].includes(fieldName.toLowerCase())) {
          fields.add(fieldName)
        }
      }
    }
  } catch (error) {
    console.error('Error parsing XML:', error)
    // Fallback to simple extraction
    const simpleRegex = /<(\w+)[^>]*>/g
    let match
    while ((match = simpleRegex.exec(content)) !== null) {
      fields.add(match[1])
    }
  }
  
  return Array.from(fields).sort()
}

function extractFieldsFromCSV(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []
  
  // First line should contain headers
  const headers = lines[0]
    .split(',')
    .map(header => header.trim().replace(/['"]/g, ''))
    .filter(header => header.length > 0)
  
  return headers
}

function extractFieldsFromJSON(content: string): string[] {
  try {
    const data = JSON.parse(content)
    
    if (Array.isArray(data) && data.length > 0) {
      // If it's an array of objects, get keys from first object
      const firstItem = data[0]
      if (typeof firstItem === 'object' && firstItem !== null) {
        return Object.keys(firstItem).sort()
      }
    } else if (typeof data === 'object' && data !== null) {
      // Check if it's a wrapper object with products/items array
      for (const key of ['products', 'items', 'data', 'entries']) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const firstItem = data[key][0]
          if (typeof firstItem === 'object' && firstItem !== null) {
            return Object.keys(firstItem).sort()
          }
        }
      }
      // If it's a single object, return its keys
      return Object.keys(data).sort()
    }
    
    return []
  } catch (error) {
    throw new Error('Invalid JSON format')
  }
}
