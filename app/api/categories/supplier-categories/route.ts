import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplier_id')
    const sourceField = url.searchParams.get('field') // optional: explicit source field name

    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }

    // Get unique categories from raw products for this supplier
    const { data: products, error } = await supabase
      .from('products_raw')
      .select('raw, category')
      .eq('workspace_id', workspaceId)
      .eq('supplier_id', supplierId)

    if (error) throw error

    console.log(`🔍 Processing ${products?.length || 0} products for supplier ${supplierId}`)
    console.log(`🔍 Source field parameter: "${sourceField}"`)

    // Extract unique categories from the data
    const categories = new Set<string>()
    let detectedField: string | null = sourceField || null // Track which field was used
    
    // If no products in database, try to fetch from supplier source directly
    if (!products || products.length === 0) {
      try {
        // Get supplier details to fetch from source
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('endpoint_url, source_path, source_type')
          .eq('id', supplierId)
          .eq('workspace_id', workspaceId)
          .single()

        if (supplier) {
          let xmlContent = ''
          
          if (supplier.source_type === 'url' && supplier.endpoint_url) {
            const response = await fetch(supplier.endpoint_url)
            xmlContent = await response.text()
          } else if (supplier.source_type === 'upload' && supplier.source_path) {
            const { data: fileBlob } = await supabase.storage
              .from('feeds')
              .download(supplier.source_path)
            if (fileBlob) {
              xmlContent = await fileBlob.text()
            }
          }

          if (xmlContent) {
            if (sourceField) {
              // Use explicitly provided field
              const regex = new RegExp(`<${sourceField}>(.*?)</${sourceField}>`, 'gi')
              let match
              
              while ((match = regex.exec(xmlContent)) !== null) {
                const category = match[1].trim()
                if (category) {
                  categories.add(category)
                }
              }
              detectedField = sourceField
            } else {
              // Auto-detect field from XML content
              const categoryFields = ['category', 'categories', 'cat', 'type', 'group', 'classification']
              let foundField = false
              
              for (const field of categoryFields) {
                if (!foundField) {
                  const regex = new RegExp(`<${field}>(.*?)</${field}>`, 'gi')
                  let match
                  let fieldCategories = new Set<string>()
                  
                  while ((match = regex.exec(xmlContent)) !== null) {
                    const category = match[1].trim()
                    if (category) {
                      fieldCategories.add(category)
                    }
                  }
                  
                  if (fieldCategories.size > 0) {
                    foundField = true
                    detectedField = field
                    console.log(`🔍 Auto-detected field from XML source: "${field}" with ${fieldCategories.size} categories`)
                    
                    // Add all categories from this field
                    fieldCategories.forEach(cat => categories.add(cat))
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch categories from supplier source:', e)
      }
    }
    
    products?.forEach(product => {
      // 1) If an explicit source field is provided, prefer that
      if (sourceField && product.raw && typeof product.raw === 'object') {
        const rawObj = product.raw as Record<string, any>
        const lower = Object.fromEntries(Object.entries(rawObj).map(([k, v]) => [k.toLowerCase(), v])) as Record<string, any>
        const value = lower[sourceField.toLowerCase()]
        if (value != null) {
          if (Array.isArray(value)) {
            value.forEach((cat: any) => {
              if (typeof cat === 'string' && cat.trim()) categories.add(cat.trim())
              else if (typeof cat === 'object' && cat?.name) categories.add(String(cat.name).trim())
            })
          } else if (typeof value === 'string' && value.trim()) {
            categories.add(value.trim())
          } else if (typeof value === 'object' && value?.name) {
            categories.add(String(value.name).trim())
          }
        }
        // Also include normalized column if user chose 'category'
        if (sourceField.toLowerCase() === 'category' && product.category) categories.add(product.category)
        return
      }

      // 2) Default heuristic extraction (no explicit field)
      if (product.category) {
        categories.add(product.category)
        if (detectedField === null) detectedField = 'category' // Track that we used the normalized category field
      }
      if (product.raw && typeof product.raw === 'object') {
        const rawData = product.raw as any
        const categoryFields = ['category', 'categories', 'cat', 'type', 'group', 'classification']
        
        // Debug: Log available fields in raw data
        if (categories.size === 0) { // Only log for first product to avoid spam
          console.log('🔍 Available fields in raw data:', Object.keys(rawData))
        }
        
        // Find the first field that has data
        for (const field of categoryFields) {
          if (rawData[field] && detectedField === null) {
            detectedField = field // Track the first field we found
            console.log(`🔍 Auto-detected field: "${field}" from product data`)
          }
          
          if (rawData[field]) {
            if (Array.isArray(rawData[field])) {
              rawData[field].forEach((cat: any) => {
                if (typeof cat === 'string' && cat.trim()) {
                  categories.add(cat.trim())
                } else if (typeof cat === 'object' && cat.name) {
                  categories.add(cat.name.trim())
                }
              })
            } else if (typeof rawData[field] === 'string' && rawData[field].trim()) {
              categories.add(rawData[field].trim())
            }
          }
        }
      }
    })

    // Convert to array and sort
    const uniqueCategories = Array.from(categories).sort()

    console.log('🔍 API returning detectedField:', detectedField)
    console.log('🔍 API returning categories count:', uniqueCategories.length)
    
    return NextResponse.json({ 
      categories: uniqueCategories,
      count: uniqueCategories.length,
      detectedField: detectedField // Include which field was used for extraction
    })
  } catch (e: any) {
    console.error('Error fetching supplier categories:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

