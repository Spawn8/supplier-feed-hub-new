import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getSupplier, getStoreSize } from '@/lib/memoryStore'

// Field extraction functions (same as extract-fields API)
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🚀 Sample-keys API called')
  console.log('🔗 Request URL:', req.url)
  
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    console.log('👤 User authenticated:', !!user)
    if (!user) {
      console.log('❌ User not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspace_id')
    
    console.log('🏢 Workspace ID from params:', workspaceId)
    if (!workspaceId) {
      console.log('❌ No workspace ID provided')
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const { id: supplierId } = await params

    console.log('🔍 Looking for supplier in sample-keys:', supplierId)
    console.log('📊 Centralized memory store has', getStoreSize(), 'suppliers')
    
    // Debug: Check if we can access the global store directly
    console.log('🌐 Global store exists:', !!globalThis.__suppliersStore)
    console.log('🌐 Global store size:', globalThis.__suppliersStore?.size || 0)

    // First check centralized in-memory store
    let supplier = getSupplier(supplierId)
    
    if (!supplier) {
      // Fallback to database lookup
      const { data: dbSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .eq('workspace_id', workspaceId)
        .single()

      if (supplierError || !dbSupplier) {
        console.error('❌ Supplier not found in memory or database:', supplierError)
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      
      supplier = dbSupplier
      console.log('✅ Found supplier in database for sample-keys')
    }

    console.log('🔍 Supplier details:', { 
      id: supplier.id, 
      source_type: supplier.source_type, 
      endpoint_url: supplier.endpoint_url 
    })
    
    let content: string
    let contentType: string

    if (supplier.source_type === 'upload') {
      console.log('📁 Processing uploaded file for field extraction')
      
      if (!supplier.source_path) {
        console.log('❌ No source path for upload supplier')
        return NextResponse.json({ error: 'No uploaded file found for this supplier' }, { status: 400 })
      }

      try {
        // Download the file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('feeds')
          .download(supplier.source_path)

        if (downloadError) {
          console.error('❌ Error downloading file:', downloadError)
          return NextResponse.json({ error: 'Failed to download uploaded file' }, { status: 400 })
        }

        // Convert blob to text
        content = await fileData.text()
        
        // Determine content type from file extension
        const fileExtension = supplier.source_path.split('.').pop()?.toLowerCase()
        if (fileExtension === 'xml') {
          contentType = 'application/xml'
        } else if (fileExtension === 'json') {
          contentType = 'application/json'
        } else if (fileExtension === 'csv') {
          contentType = 'text/csv'
        } else {
          contentType = 'application/octet-stream'
        }

        console.log('✅ Downloaded file content, size:', content.length, 'bytes')
      } catch (error: any) {
        console.error('❌ Error processing uploaded file:', error)
        return NextResponse.json({ error: 'Failed to process uploaded file' }, { status: 400 })
      }
    } else if (supplier.source_type === 'url') {
      if (!supplier.endpoint_url) {
        console.log('❌ No endpoint URL provided for URL supplier')
        // Return mock data for testing
        const mockFields = ['id', 'title', 'description', 'price', 'category', 'brand', 'image_url']
        return NextResponse.json({ 
          keys: mockFields,
          total_records: 100,
          sample_size: mockFields.length,
          note: 'Mock data - no URL provided'
        })
      }

      try {
        // Fetch data from supplier URL
        const fetchOptions: RequestInit = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SupplierFeedHub/1.0)'
          }
        }

        // Add basic auth if provided
        if (supplier.auth_username && supplier.auth_password) {
          const credentials = btoa(`${supplier.auth_username}:${supplier.auth_password}`)
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Authorization': `Basic ${credentials}`
          }
        }

        const response = await fetch(supplier.endpoint_url, fetchOptions)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        content = await response.text()
        contentType = response.headers.get('content-type') || ''
        
        console.log('✅ Fetched URL content, size:', content.length, 'bytes')
      } catch (fetchError: any) {
        console.error('❌ Error fetching supplier data:', fetchError)
        console.error('❌ Fetch error stack:', fetchError.stack)
        return NextResponse.json({ 
          error: `Failed to fetch data from supplier URL: ${fetchError.message}` 
        }, { status: 400 })
      }
    } else {
      console.log('❌ Unknown source type:', supplier.source_type)
      return NextResponse.json({ error: 'Unknown source type' }, { status: 400 })
    }

    try {
      let fields: string[] = []

      // Determine format and extract fields
      if (contentType.includes('xml') || (supplier.source_type === 'upload' && supplier.source_path?.includes('.xml'))) {
        fields = extractFieldsFromXML(content)
      } else if (contentType.includes('json') || (supplier.source_type === 'upload' && supplier.source_path?.includes('.json'))) {
        fields = extractFieldsFromJSON(content)
      } else if (contentType.includes('csv') || (supplier.source_type === 'upload' && supplier.source_path?.includes('.csv'))) {
        fields = extractFieldsFromCSV(content)
      } else {
        // Try to auto-detect format
        const trimmedContent = content.trim()
        if (trimmedContent.startsWith('<')) {
          fields = extractFieldsFromXML(content)
        } else if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
          fields = extractFieldsFromJSON(content)
        } else {
          fields = extractFieldsFromCSV(content)
        }
      }

      const result = { 
        keys: fields,
        total_records: content.split('\n').length, // Rough estimate
        sample_size: Math.min(fields.length, 50)
      }
      
      console.log('✅ Returning sample keys result:', result)
      return NextResponse.json(result)
    } catch (extractError: any) {
      console.error('❌ Error extracting fields:', extractError)
      return NextResponse.json({ 
        error: `Failed to extract fields: ${extractError.message}` 
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('❌ Error in sample-keys API:', error)
    console.error('❌ Error stack:', error.stack)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}