// app/api/exports/feed/[profileId]/route.ts
// Public GET endpoint for live feed URLs - serves export data directly
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a service role client for public access (bypasses RLS)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId: profileIdWithExtension } = await params
    
    if (!profileIdWithExtension) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }
    
    // Parse profileId and extension (e.g., "abc123.xml" -> "abc123" + "xml")
    const extensionMatch = profileIdWithExtension.match(/^(.+)\.(xml|csv|json)$/i)
    const profileId = extensionMatch ? extensionMatch[1] : profileIdWithExtension
    const requestedExtension = extensionMatch ? extensionMatch[2].toLowerCase() : null
    
    const supabase = createServiceClient()
    
    // Get the export profile
    const { data: profile, error: profileError } = await supabase
      .from('export_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('is_active', true)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Export profile not found or inactive' }, { status: 404 })
    }
    
    // Check if this profile is configured for feed delivery
    if (profile.delivery_method !== 'feed') {
      return NextResponse.json({ error: 'This export profile is not configured as a live feed' }, { status: 403 })
    }
    
    // Validate extension matches profile's output format (if extension provided)
    if (requestedExtension && requestedExtension !== profile.output_format) {
      return NextResponse.json({ 
        error: `Extension mismatch: this feed is configured for .${profile.output_format}` 
      }, { status: 400 })
    }
    
    // Get all products with filters applied
    let query = supabase
      .from('products_mapped')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
    
    // Apply filters
    if (profile.filters?.in_stock_only) {
      query = query.eq('in_stock', true)
    }
    
    if (profile.filters?.min_price) {
      query = query.gte('price', profile.filters.min_price)
    }
    
    if (profile.filters?.max_price) {
      query = query.lte('price', profile.filters.max_price)
    }
    
    if (profile.filters?.categories && profile.filters.categories.length > 0) {
      query = query.in('category_id', profile.filters.categories)
    }
    
    const { data: products, error: productsError } = await query
    
    if (productsError) {
      console.error('Error fetching products for feed:', productsError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
    
    // Generate export data based on format
    let exportData: string
    let contentType: string
    let fileExtension: string
    
    switch (profile.output_format) {
      case 'csv':
        exportData = generateCSV(products || [], profile)
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
        break
      case 'json':
        exportData = generateJSON(products || [], profile)
        contentType = 'application/json; charset=utf-8'
        fileExtension = 'json'
        break
      case 'xml':
        exportData = generateXML(products || [], profile)
        contentType = 'application/xml; charset=utf-8'
        fileExtension = 'xml'
        break
      default:
        return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 })
    }
    
    // Return the data with appropriate headers
    const filename = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`
    
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*', // Allow cross-origin access for feed readers
      },
    })
    
  } catch (error) {
    console.error('Feed generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate CSV export
 */
function generateCSV(products: any[], profile: any): string {
  const fieldsToInclude = profile.field_ordering?.length > 0 
    ? profile.field_ordering 
    : profile.field_selection || []
  
  if (fieldsToInclude.length === 0) {
    return ''
  }
  
  // CSV header
  const headers = fieldsToInclude.join(',')
  
  // CSV rows - product data is in the 'fields' JSONB column
  const rows = products.map(product => {
    const productFields = product.fields || {}
    const values = fieldsToInclude.map((fieldKey: string) => {
      const value = productFields[fieldKey] || ''
      // Escape CSV values
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    })
    return values.join(',')
  })
  
  return [headers, ...rows].join('\n')
}

/**
 * Generate JSON export
 */
function generateJSON(products: any[], profile: any): string {
  const fieldsToInclude = profile.field_ordering?.length > 0 
    ? profile.field_ordering 
    : profile.field_selection || []
  
  // Product data is in the 'fields' JSONB column
  const transformedProducts = products.map(product => {
    const productFields = product.fields || {}
    const result: Record<string, any> = {}
    
    for (const fieldKey of fieldsToInclude) {
      if (profile.field_selection?.includes(fieldKey)) {
        result[fieldKey] = productFields[fieldKey] || null
      }
    }
    
    return result
  })
  
  return JSON.stringify(transformedProducts, null, 2)
}

/**
 * Generate XML export
 */
function generateXML(products: any[], profile: any): string {
  const fieldsToInclude = profile.field_ordering?.length > 0
    ? profile.field_ordering 
    : profile.field_selection || []
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<products>\n'
  
  // Product data is in the 'fields' JSONB column
  for (const product of products) {
    const productFields = product.fields || {}
    xml += '  <product>\n'
    
    for (const fieldKey of fieldsToInclude) {
      if (profile.field_selection?.includes(fieldKey)) {
        const value = productFields[fieldKey] || ''
        const escapedValue = String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
        
        xml += `    <${fieldKey}>${escapedValue}</${fieldKey}>\n`
      }
    }
    
    xml += '  </product>\n'
  }
  
  xml += '</products>'
  return xml
}

