import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getSupplier } from '@/lib/memoryStore'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Handle both JSON and FormData requests
    let supplier_id: string
    let mappings: any[]
    let file: File | null = null
    
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      // JSON request from wizard
      const body = await req.json()
      supplier_id = body.supplier_id
      mappings = body.mappings || []
    } else {
      // FormData request with file upload
      const formData = await req.formData()
      supplier_id = formData.get('supplier_id') as string
      mappings = JSON.parse(formData.get('mappings') as string || '[]')
      file = formData.get('file') as File
    }

    if (!supplier_id) {
      return NextResponse.json({ error: 'Missing supplier_id' }, { status: 400 })
    }

    console.log('🚀 Starting import process for supplier:', supplier_id)
    console.log('🗺️ Using mappings:', mappings)

    // Get supplier from memory first, then database
    let supplier = getSupplier(supplier_id)
    
    if (!supplier) {
      // Fallback to database
      const { data: dbSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplier_id)
        .eq('created_by', user.id)
        .single()

      if (supplierError || !dbSupplier) {
        console.error('❌ Supplier not found in memory or database:', supplierError)
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      
      supplier = dbSupplier
      console.log('✅ Found supplier in database for import')
    } else {
      console.log('✅ Found supplier in memory for import')
    }

    // Start real import process
    console.log('🚀 Starting real import process...')
    
    const startTime = Date.now()
    const ingestionId = crypto.randomUUID()
    
    // Create ingestion record in database
    const { data: ingestion, error: ingestionError } = await supabase
      .from('feed_ingestions')
      .insert({
        id: ingestionId,
        workspace_id: supplier.workspace_id,
        supplier_id: supplier_id,
        status: 'running',
        started_at: new Date().toISOString(),
        items_total: 0,
        items_success: 0,
        items_errors: 0
      })
      .select()
      .single()

    if (ingestionError) {
      console.error('❌ Error creating ingestion record:', ingestionError)
      return NextResponse.json({ 
        error: `Failed to create ingestion record: ${ingestionError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Ingestion record created:', ingestionId)

    try {
      // 1. Fetch data from supplier source
      let rawData: string = ''
      let contentType: string = ''
      
      if (supplier.source_type === 'url') {
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
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        rawData = await response.text()
        contentType = response.headers.get('content-type') || ''
      } else if (file) {
        // For uploaded files, use the file from the request
        console.log('📁 Processing uploaded file')
        
        rawData = await file.text()
        contentType = file.type || 'application/xml'
        
        console.log(`📄 File received: ${file.name}, size: ${file.size} bytes, type: ${contentType}`)
      } else if (supplier.source_type === 'upload' && supplier.source_path) {
        // Resume case: supplier is upload-type and we have a stored file path
        console.log('📦 Downloading stored uploaded file from bucket using source_path:', supplier.source_path)
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('feeds')
          .download(supplier.source_path)

        if (downloadError) {
          console.error('❌ Error downloading stored file:', downloadError)
          throw new Error('Failed to download stored uploaded file')
        }

        rawData = await fileData.text()

        // Infer content type from extension
        const ext = supplier.source_path.split('.').pop()?.toLowerCase()
        if (ext === 'xml') contentType = 'application/xml'
        else if (ext === 'json') contentType = 'application/json'
        else if (ext === 'csv') contentType = 'text/csv'
        else contentType = 'application/octet-stream'

        console.log('✅ Downloaded stored file, bytes:', rawData.length, 'type:', contentType)
      } else {
        // No file provided and not a URL source - this shouldn't happen in normal flow
        throw new Error('No data source available - either provide a file or configure a URL source')
      }

      // 2. Parse the data according to format
      console.log('📋 Parsing data...')
      let parsedProducts: any[] = []
      
      if (contentType.includes('xml') || supplier.endpoint_url?.includes('.xml') || rawData.trim().startsWith('<')) {
        parsedProducts = parseXMLProducts(rawData)
      } else if (contentType.includes('json') || supplier.endpoint_url?.includes('.json') || rawData.trim().startsWith('{') || rawData.trim().startsWith('[')) {
        parsedProducts = parseJSONProducts(rawData)
      } else {
        parsedProducts = parseCSVProducts(rawData)
      }

      console.log(`📊 Parsed ${parsedProducts.length} products`)

      // 3. Raw products are no longer stored in database - they will be fetched live when needed
      console.log('ℹ️ Skipping raw product storage - data will be fetched live from source')
      
      const insertedCount = parsedProducts.length
      const errorCount = 0

      // 4. Create mapped products (even if no mappings → empty fields)
      console.log('🗺️ Creating mapped products rows...')

      // Skip database field_mappings insertion due to RLS issues
      console.log('Skipping field_mappings database insertion due to RLS issues')

      // 4.a Prepare effective mappings
      // If none provided from the wizard, fall back to DB field_mappings (source_key/field_key)
      let effectiveMappings: Array<{ sourceField: string; targetKey: string }> = []
      // Build a global id->key map for this workspace to normalize legacy stored fields
      let idToKeyGlobal: Record<string, string> = {}
      try {
        const { data: allFields } = await supabase
          .from('custom_fields')
          .select('id,key')
          .eq('workspace_id', supplier.workspace_id)
        allFields?.forEach((cf: any) => { idToKeyGlobal[cf.id] = cf.key })
      } catch {}

      if (!Array.isArray(mappings) || mappings.length === 0) {
        const { data: dbMappings, error: dbMapErr } = await supabase
          .from('field_mappings')
          .select('source_key, field_key')
          .eq('supplier_id', supplier_id)

        if (dbMapErr) {
          console.error('⚠️ Failed to load DB field mappings:', dbMapErr)
        } else if (dbMappings) {
          // We need field_key as a key string (not UUID). Lookup if needed
          const potentialIds = Array.from(new Set(dbMappings
            .map((m: any) => m.field_key)
            .filter((v: any) => typeof v === 'string')))

          let idToKeyFromDb: Record<string, string> = {}
          if (potentialIds.length > 0) {
            const { data: cfLookup } = await supabase
              .from('custom_fields')
              .select('id,key')
              .in('id', potentialIds)
            cfLookup?.forEach((cf: any) => { idToKeyFromDb[cf.id] = cf.key })
          }

          effectiveMappings = dbMappings.map((m: any) => ({
            sourceField: m.source_key,
            targetKey: idToKeyFromDb[m.field_key] || m.field_key, // already a key or fallback
          }))
        }
      } else {
        // Mappings provided by wizard: { custom_field_id, source_field }
        // Build id -> key lookup
        let idToKey: Record<string, string> = {}
        const ids = Array.from(new Set(mappings.map((m: any) => m.custom_field_id).filter(Boolean)))
        if (ids.length > 0) {
          const { data: customFieldsLookup, error: lookupErr } = await supabase
            .from('custom_fields')
            .select('id,key')
            .in('id', ids)
          if (lookupErr) {
            console.error('⚠️ Failed to lookup custom field keys, will fallback to IDs:', lookupErr)
          } else {
            customFieldsLookup?.forEach((cf: any) => { idToKey[cf.id] = cf.key })
          }
        }
        effectiveMappings = mappings.map((m: any) => ({
          sourceField: m.source_field,
          targetKey: idToKey[m.custom_field_id] || m.custom_field_id,
        }))
      }

      // 4.b Build rows using Unique Identifier Field as UID
      const uidSourceKey = supplier.settings?.uid_source_key as string | undefined
      if (!uidSourceKey) {
        console.warn('⚠️ No uid_source_key set; UIDs will fallback to sequential per run')
      }

      // Load existing mapped fields to avoid overwriting with nulls on re-sync
      const existingByUid: Record<string, any> = {}
      try {
        const { data: existingRows } = await supabase
          .from('products_mapped')
          .select('uid, fields')
          .eq('supplier_id', supplier_id)
        existingRows?.forEach((row: any) => {
          existingByUid[row.uid] = row.fields || {}
        })
      } catch (e) {
        console.warn('⚠️ Could not load existing mapped rows; proceeding without merge')
      }

      // Allocate numeric UIDs for all parsed products to satisfy chk_uid_numeric
      let allocatedUids: string[] = []
      try {
        const { data: uidBatch, error: uidErr } = await supabase.rpc('allocate_batch_uids', {
          p_workspace_id: supplier.workspace_id,
          p_count: parsedProducts.length
        })
        if (uidErr || !Array.isArray(uidBatch)) {
          console.warn('⚠️ UID allocation failed or returned invalid data, falling back to local counters:', uidErr)
          allocatedUids = parsedProducts.map((_, i) => String(i + 1))
        } else {
          allocatedUids = uidBatch.map((v: any) => String(v))
        }
      } catch (e) {
        console.warn('⚠️ Exception allocating batch UIDs, falling back to local counters:', e)
        allocatedUids = parsedProducts.map((_, i) => String(i + 1))
      }

      const mappedProductsToInsert = parsedProducts
        .map((product, index) => {
          const mappedFields: any = {}
          effectiveMappings.forEach((m) => {
          const sourceValue = product[m.sourceField]
          const isEmptyString = typeof sourceValue === 'string' && sourceValue.trim() === ''
          const isNullString = typeof sourceValue === 'string' && sourceValue.trim().toLowerCase() === 'null'
          const isUndefinedString = typeof sourceValue === 'string' && sourceValue.trim().toLowerCase() === 'undefined'
          if (sourceValue !== undefined && sourceValue !== null && !isEmptyString && !isNullString && !isUndefinedString) {
              mappedFields[m.targetKey] = sourceValue
            }
          })

          // Regardless of source UID shape, we use numeric UID from allocator to satisfy constraint
          const numericUid = allocatedUids[index]

          // Merge with existing fields to avoid nullifying prior values
          // Normalize existing fields (convert UUID keys to field keys)
          const rawExistingFields = existingByUid[numericUid] || {}
          const normalizedExisting: any = {}
          Object.entries(rawExistingFields).forEach(([k, v]) => {
            const key = idToKeyGlobal[k] || k
            if (normalizedExisting[key] === undefined) normalizedExisting[key] = v
          })
          const mergedFields = { ...normalizedExisting, ...mappedFields }

          return {
            workspace_id: supplier.workspace_id,
            supplier_id: supplier_id,
            ingestion_id: ingestionId,
            uid: numericUid,
            fields: mergedFields,
            source_file: supplier.source_type === 'upload' ? supplier.source_path || 'uploaded_file' : supplier.endpoint_url
          }
        })
        .filter(row => row.uid) // ensure uid present

      // Upsert mapped products by (workspace_id, supplier_id, uid)
      const { data: insertedMappedProducts, error: mappedProductsError } = await supabase
        .from('products_mapped')
        .upsert(mappedProductsToInsert, { onConflict: 'workspace_id,supplier_id,uid' })
        .select('id')

      if (mappedProductsError) {
        console.error('❌ Error inserting mapped products:', mappedProductsError)
        throw new Error(`Failed to insert mapped products: ${mappedProductsError.message}`)
      }

      console.log(`✅ Inserted ${insertedMappedProducts.length} mapped products into database`)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Update ingestion record with final status
      const { error: ingestionUpdateError } = await supabase
        .from('feed_ingestions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_total: parsedProducts.length,
          items_success: insertedCount,
          items_errors: errorCount,
          duration_ms: duration
        })
        .eq('id', ingestionId)

      if (ingestionUpdateError) {
        console.error('❌ Error updating ingestion record:', ingestionUpdateError)
      } else {
        console.log('✅ Updated ingestion record')
      }

      // Update supplier status
      const { error: supplierUpdateError } = await supabase
        .from('suppliers')
        .update({
          status: 'active',
          last_sync_status: 'completed',
          last_sync_completed_at: new Date().toISOString()
        })
        .eq('id', supplier_id)

      if (supplierUpdateError) {
        console.error('❌ Error updating supplier:', supplierUpdateError)
      } else {
        console.log('✅ Updated supplier status')
      }

      const results = {
        total_products: parsedProducts.length,
        new_products: insertedCount,
        updated_products: 0, // For now, treating all as new
        errors: errorCount,
        duration_ms: duration,
        status: 'completed',
        ingestion_id: ingestionId
      }

      console.log('✅ Import completed:', results)

      return NextResponse.json({ 
        success: true,
        results: results,
        supplier: supplier
      })

    } catch (importError: any) {
      console.error('❌ Import failed:', importError)
      
      // Update ingestion record with error status
      try {
        await supabase
          .from('feed_ingestions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: importError.message
          })
          .eq('id', ingestionId)
        console.log('✅ Updated ingestion record with error status')
      } catch (updateError) {
        console.error('❌ Failed to update ingestion record with error:', updateError)
      }

      return NextResponse.json({ 
        error: `Import failed: ${importError.message}` 
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error in import API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// Data parsing functions
function parseXMLProducts(xmlContent: string): any[] {
  const products: any[] = []
  
  try {
    // Look for product/item nodes
    const productRegex = /<(product|item|entry)[^>]*>([\s\S]*?)<\/\1>/gi
    const productMatches = xmlContent.match(productRegex)
    
    if (productMatches) {
      productMatches.forEach((productXML, index) => {
        const product: any = { uid: `xml_${index}` }
        
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
      return data.map((item, index) => ({ ...item, uid: item.id || item.uid || `json_${index}` }))
    } else if (typeof data === 'object' && data !== null) {
      // Check for wrapper objects
      for (const key of ['products', 'items', 'data', 'entries']) {
        if (Array.isArray(data[key])) {
          return data[key].map((item: any, index: number) => ({ 
            ...item, 
            uid: item.id || item.uid || `json_${index}` 
          }))
        }
      }
      
      // Single object
      return [{ ...data, uid: data.id || data.uid || 'json_0' }]
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
      const product: any = { uid: `csv_${i - 1}` }
      
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