import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getSupplier } from '@/lib/memoryStore'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const { id: supplierId } = await params

    console.log('🔍 Raw-data API called for supplier:', supplierId)

    // Get supplier from memory first, then database
    let supplier = getSupplier(supplierId)
    
    if (!supplier) {
      // Fallback to database
      const { data: dbSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .eq('created_by', user.id)
        .single()

      if (supplierError || !dbSupplier) {
        console.log('❌ Supplier not found in memory or database')
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      
      supplier = dbSupplier
      console.log('✅ Found supplier in database for raw-data')
    } else {
      console.log('✅ Found supplier in memory for raw-data')
    }

    // Verify user has access to this workspace
    if (supplier.workspace_id) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', supplier.workspace_id)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        console.log('❌ Access denied to workspace:', supplier.workspace_id)
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Fetch raw data live from source
    console.log('📡 Fetching live data from supplier source...')
    
    const fetchAttemptTime = new Date().toISOString()
    let rawData: string = ''
    let contentType: string = ''
    let fetchError: string | null = null
    
    try {
      if (supplier.source_type === 'url' && supplier.endpoint_url) {
        console.log('📡 Fetching data from URL:', supplier.endpoint_url)
        
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
          fetchError = `HTTP ${response.status}: ${response.statusText}`
          throw new Error(fetchError)
        }

        rawData = await response.text()
        contentType = response.headers.get('content-type') || ''
        console.log('✅ Successfully fetched data from URL')
      } else if (supplier.source_type === 'upload') {
        // Download last uploaded file from feeds bucket using supplier.source_path
        if (!supplier.source_path) {
          fetchError = 'No uploaded file is linked to this supplier.'
          throw new Error(fetchError)
        }

        console.log('📦 Downloading uploaded file from feeds:', supplier.source_path)
        const { data: blob, error: downloadErr } = await supabase
          .storage
          .from('feeds')
          .download(supplier.source_path as string)

        if (downloadErr || !blob) {
          fetchError = downloadErr?.message || 'Failed to download uploaded file.'
          throw new Error(fetchError)
        }

        rawData = await blob.text()
        // Infer content type by extension
        const lower = (supplier.source_path as string).toLowerCase()
        if (lower.endsWith('.xml')) contentType = 'application/xml'
        else if (lower.endsWith('.json')) contentType = 'application/json'
        else if (lower.endsWith('.csv')) contentType = 'text/csv'
        else contentType = blob.type || 'application/octet-stream'
        console.log('✅ Loaded uploaded file, inferred content type:', contentType)
      } else {
        fetchError = 'Invalid supplier configuration'
        throw new Error(fetchError)
      }
    } catch (error: any) {
      console.error('❌ Error fetching supplier data:', error.message)
      fetchError = error.message
      
      return NextResponse.json({ 
        error: `Failed to fetch data from supplier source: ${fetchError}`,
        supplier: {
          id: supplier.id,
          name: supplier.name || 'Unknown Supplier',
          workspace_id: supplier.workspace_id,
          source_type: supplier.source_type,
          endpoint_url: supplier.endpoint_url,
          products: [],
          total_products: 0,
          fetch_error: fetchError,
          fetched_at: fetchAttemptTime
        }
      }, { status: 200 })
    }

    // Parse the fetched data
    console.log('📋 Parsing fetched data...')
    let parsedProducts: any[] = []
    
    try {
      if (contentType.includes('xml') || supplier.endpoint_url?.includes('.xml') || rawData.trim().startsWith('<')) {
        parsedProducts = parseXMLProducts(rawData)
      } else if (contentType.includes('json') || supplier.endpoint_url?.includes('.json') || rawData.trim().startsWith('{') || rawData.trim().startsWith('[')) {
        parsedProducts = parseJSONProducts(rawData)
      } else {
        parsedProducts = parseCSVProducts(rawData)
      }
    } catch (parseError: any) {
      console.error('❌ Error parsing data:', parseError.message)
      return NextResponse.json({ 
        error: `Failed to parse supplier data: ${parseError.message}`,
        supplier: {
          id: supplier.id,
          name: supplier.name || 'Unknown Supplier',
          workspace_id: supplier.workspace_id,
          source_type: supplier.source_type,
          endpoint_url: supplier.endpoint_url,
          products: [],
          total_products: 0,
          fetch_error: `Parse error: ${parseError.message}`,
          fetched_at: fetchAttemptTime
        }
      }, { status: 200 })
    }

    // Add sequential UIDs to products
    const productsWithUids = parsedProducts.map((product, index) => ({
      ...product,
      uid: (index + 1).toString(),
      id: `live_${index}`,
      raw: product // Keep the original data as raw
    }))

    // Apply pagination
    const totalProducts = productsWithUids.length
    const paginatedProducts = productsWithUids.slice(offset, offset + limit)
    const totalPages = Math.ceil(totalProducts / limit)

    console.log(`✅ Successfully parsed ${totalProducts} products from live source`)

    // Get latest ingestion info for reference
    const { data: ingestion } = await supabase
      .from('feed_ingestions')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.name || 'Unknown Supplier',
        workspace_id: supplier.workspace_id,
        source_type: supplier.source_type,
        endpoint_url: supplier.endpoint_url,
        products: paginatedProducts,
        total_products: totalProducts,
        current_page: page,
        total_pages: totalPages,
        ingestion_info: ingestion || null,
        live_data: true, // Flag to indicate this is live data
        fetched_at: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Error in raw-data API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// Data parsing functions (copied from import/route.ts)
function parseXMLProducts(xmlContent: string): any[] {
  const products: any[] = []
  
  try {
    // Look for product/item nodes
    const productRegex = /<(product|item|entry)[^>]*>([\s\S]*?)<\/\1>/gi
    const productMatches = xmlContent.match(productRegex)
    
    if (productMatches) {
      productMatches.forEach((productXML, index) => {
        const product: any = {}
        
        // Extract all field values
        const fieldRegex = /<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g
        let match
        
        while ((match = fieldRegex.exec(productXML)) !== null) {
          const fieldName = match[1]
          const fieldValue = match[2].trim()
          
          // Skip wrapper tags
          if (!['product', 'item', 'entry'].includes(fieldName.toLowerCase())) {
            product[fieldName] = fieldValue
          }
        }
        
        products.push(product)
      })
    }
  } catch (error) {
    console.error('Error parsing XML:', error)
  }
  
  return products
}

function parseJSONProducts(jsonContent: string): any[] {
  try {
    const data = JSON.parse(jsonContent)
    
    if (Array.isArray(data)) {
      return data
    } else if (typeof data === 'object' && data !== null) {
      // Check for wrapper objects
      for (const key of ['products', 'items', 'data', 'entries']) {
        if (Array.isArray(data[key])) {
          return data[key]
        }
      }
      
      // Single object
      return [data]
    }
    
    return []
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return []
  }
}

function parseCSVProducts(csvContent: string): any[] {
  const products: any[] = []
  
  try {
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []
    
    const headers = lines[0]
      .split(',')
      .map(header => header.trim().replace(/['"]/g, ''))
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(value => value.trim().replace(/['"]/g, ''))
      const product: any = {}
      
      headers.forEach((header, index) => {
        if (values[index] !== undefined) {
          product[header] = values[index]
        }
      })
      
      products.push(product)
    }
  } catch (error) {
    console.error('Error parsing CSV:', error)
  }
  
  return products
}