import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getSupplier, getActiveSupplierFile, getSupplierFiles } from '@/lib/suppliers'
import { detectFeedType, ingestCSV, ingestJSON, ingestXMLBuffer } from '@/lib/ingest'
import { ingestCSVWithGlobalUids, ingestJSONWithGlobalUids, ingestXMLWithGlobalUids } from '@/lib/ingestWithGlobalUids'
import { Readable } from 'stream'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ingestionId: string | null = null
  
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

    const { id: supplierId } = await params

    // Get supplier details
    const supplier = await getSupplier(supplierId)
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify supplier belongs to current workspace
    if (supplier.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const syncStartTime = new Date().toISOString()

    // Create ingestion record for history
    const { data: ingestion, error: ingestionError } = await supabase
      .from('feed_ingestions')
      .insert({
        workspace_id: workspaceId,
        supplier_id: supplierId,
        status: 'running',
        started_at: syncStartTime,
        created_by: user.id
      })
      .select('id')
      .single()

    if (ingestionError) {
      console.error('Error creating ingestion record:', ingestionError)
      return NextResponse.json({ error: ingestionError.message }, { status: 400 })
    }

    ingestionId = ingestion.id
    console.log('✅ Created ingestion record:', ingestionId)

    // Update supplier to show sync is starting
    const { error: startError } = await supabase
      .from('suppliers')
      .update({
        last_sync_status: 'running',
        last_sync_started_at: syncStartTime,
        last_sync_completed_at: null,
        last_sync_error_message: null
      })
      .eq('id', supplierId)

    if (startError) {
      console.error('Error starting sync:', startError)
      return NextResponse.json({ error: startError.message }, { status: 400 })
    }

    console.log('✅ Started sync for supplier:', supplierId)

    try {
      let stats: any = { total: 0, ok: 0, errors: 0 }

      if (supplier.endpoint_url) {
        // Handle URL-based ingestion (UID-enforced)
        const response = await fetch(supplier.endpoint_url)
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`)
        }

        const feedType = detectFeedType((supplier.endpoint_url as string))
        const uidSourceKey = supplier.settings?.uid_source_key

        if (feedType === 'csv') {
          const stream = Readable.fromWeb(response.body as any)
          stats = await ingestCSV({
            stream,
            supabase,
            workspace_id: workspaceId,
            supplier_id: supplierId,
            ingestion_id: ingestionId,
            uid_source_key: uidSourceKey || undefined,
            source_file: (supplier.endpoint_url as string)
          })
        } else if (feedType === 'json') {
          // Stream JSON directly to parser
          const stream = Readable.fromWeb(response.body as any)
          stats = await ingestJSON({
            stream,
            supabase,
            workspace_id: workspaceId,
            supplier_id: supplierId,
            ingestion_id: ingestionId,
            uid_source_key: uidSourceKey || undefined,
            source_file: (supplier.endpoint_url as string)
          })
        } else if (feedType === 'xml') {
          const xmlText = await response.text()
          const stream = Readable.from([xmlText])
          stats = await ingestXMLBuffer({
            stream,
            supabase,
            workspace_id: workspaceId,
            supplier_id: supplierId,
            ingestion_id: ingestionId,
            uid_source_key: uidSourceKey || undefined,
            source_file: (supplier.endpoint_url as string)
          })
        } else {
          throw new Error('Unsupported feed format')
        }
      } else {
        // Prefer supplier.source_path in 'feeds' bucket (current upload flow)
        if (supplier.source_path) {
          const objectName = supplier.source_path as string
          const { data: fileBlob, error: downloadErr } = await supabase
            .storage
            .from('feeds')
            .download(objectName)
          if (downloadErr || !fileBlob) {
            throw new Error(`Failed to download uploaded file from feeds: ${downloadErr?.message || 'unknown error'}`)
          }
          const uidSourceKey = supplier.settings?.uid_source_key
          const feedType = detectFeedType(objectName)

          if (feedType === 'csv') {
            const stream = Readable.fromWeb((fileBlob as any).stream())
            stats = await ingestCSV({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: objectName
            })
          } else if (feedType === 'json') {
            const text = await (fileBlob as any).text()
            const stream = Readable.from([text])
            stats = await ingestJSON({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: objectName
            })
          } else if (feedType === 'xml') {
            const text = await (fileBlob as any).text()
            const stream = Readable.from([text])
            stats = await ingestXMLBuffer({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: objectName
            })
          } else {
            throw new Error('Unsupported feed format')
          }
        } else {
          // Legacy path: try supplier_files table/storage
          let activeFile = await getActiveSupplierFile(supplierId)
          if (!activeFile) {
            console.log('ℹ️ No active uploaded file; falling back to most recent file...')
            const files = await getSupplierFiles(supplierId)
            activeFile = files?.[0] || null
          }
          if (!activeFile) {
            throw new Error('No uploaded file found for this supplier. Upload a file first and try again.')
          }
          const { data: fileBlob, error: downloadError } = await supabase
            .storage
            .from('supplier-files')
            .download(activeFile.storage_path)
          if (downloadError || !fileBlob) {
            throw new Error(`Failed to download uploaded file: ${downloadError?.message || 'unknown error'}`)
          }
          const stream = Readable.fromWeb((fileBlob as any).stream())
          const uidSourceKey = supplier.settings?.uid_source_key
          const key = (activeFile.filename || activeFile.content_type || activeFile.storage_path) as string
          const feedType = detectFeedType(key)
          if (feedType === 'csv') {
            stats = await ingestCSV({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: (activeFile.filename || activeFile.storage_path) as string
            })
          } else if (feedType === 'json') {
            stats = await ingestJSON({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: (activeFile.filename || activeFile.storage_path) as string
            })
          } else if (feedType === 'xml') {
            stats = await ingestXMLBuffer({
              stream,
              supabase,
              workspace_id: workspaceId,
              supplier_id: supplierId,
              ingestion_id: ingestionId,
              uid_source_key: uidSourceKey || undefined,
              source_file: (activeFile.filename || activeFile.storage_path) as string
            })
          } else {
            throw new Error('Unsupported feed format')
          }
        }
      }

      console.log('✅ Ingestion completed with stats:', stats)

      const syncEndTime = new Date().toISOString()
      const duration = new Date(syncEndTime).getTime() - new Date(syncStartTime).getTime()

      // Update feed_ingestions with results (for history)
      const { error: ingestionUpdateError } = await supabase
        .from('feed_ingestions')
        .update({
          status: 'completed',
          completed_at: syncEndTime,
          duration_ms: duration,
          items_total: stats.total,
          items_processed: stats.total,
          items_success: stats.ok,
          items_errors: stats.errors
        })
        .eq('id', ingestionId)

      if (ingestionUpdateError) {
        console.error('❌ Error updating feed_ingestions:', ingestionUpdateError)
      } else {
        console.log('✅ Updated feed_ingestions with results')
      }

      // Remove products that are no longer present in the latest source
      // Any product for this supplier not touched in this run (different ingestion_id)
      // is considered removed from source and will be deleted.
      try {
        const { error: delMappedError } = await supabase
          .from('products_mapped')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('supplier_id', supplierId)
          .neq('ingestion_id', ingestionId)

        if (delMappedError) {
          console.error('❌ Error deleting stale products from products_mapped:', delMappedError)
        } else {
          console.log('✅ Removed stale products from products_mapped')
        }

        const { error: delRawError } = await supabase
          .from('products_raw')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('supplier_id', supplierId)
          .neq('ingestion_id', ingestionId)

        if (delRawError) {
          console.error('❌ Error deleting stale products from products_raw:', delRawError)
        } else {
          console.log('✅ Removed stale products from products_raw')
        }
      } catch (delErr) {
        console.error('❌ Exception while deleting stale products:', delErr)
      }

      // Products stored with latest ingestion_id in products_raw/products_mapped
      console.log('✅ Products upserted and stale ones removed')

      // Update supplier with successful sync results (for UI)
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          last_sync_status: 'completed',
          last_sync_completed_at: syncEndTime,
          last_sync_duration_ms: duration,
          last_sync_items_total: stats.total,
          last_sync_items_success: stats.ok,
          last_sync_items_errors: stats.errors,
          last_sync_error_message: null,
          status: 'active',
          error_message: null
        })
        .eq('id', supplierId)

      if (updateError) {
        console.error('❌ Error updating supplier after success:', updateError)
        throw new Error(`Failed to update supplier: ${updateError.message}`)
      } else {
        console.log('✅ Updated supplier with successful sync results')
      }

      return NextResponse.json({ 
        success: true, 
        ingestion_id: ingestionId,
        stats
      })

    } catch (ingestionError: any) {
      console.error('❌ Ingestion failed:', ingestionError)
      
      const syncEndTime = new Date().toISOString()
      const duration = new Date(syncEndTime).getTime() - new Date(syncStartTime).getTime()

      // Update feed_ingestions with failure (for history)
      const { error: ingestionUpdateError } = await supabase
        .from('feed_ingestions')
        .update({
          status: 'failed',
          completed_at: syncEndTime,
          duration_ms: duration,
          error_message: ingestionError.message || 'Unknown error'
        })
        .eq('id', ingestionId)

      if (ingestionUpdateError) {
        console.error('❌ Error updating feed_ingestions on failure:', ingestionUpdateError)
      } else {
        console.log('✅ Updated feed_ingestions with failure')
      }

      // Update supplier with failed sync results (for UI)
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          last_sync_status: 'failed',
          last_sync_completed_at: syncEndTime,
          last_sync_duration_ms: duration,
          last_sync_items_total: 0,
          last_sync_items_success: 0,
          last_sync_items_errors: 1,
          last_sync_error_message: ingestionError.message || 'Unknown error',
          status: 'error',
          error_message: ingestionError.message || 'Unknown error'
        })
        .eq('id', supplierId)

      if (updateError) {
        console.error('❌ Error updating supplier after failure:', updateError)
      } else {
        console.log('✅ Updated supplier with failed sync results')
      }

      return NextResponse.json({ 
        success: false,
        error: ingestionError.message || 'Ingestion failed',
        ingestion_id: ingestionId
      })
    }

  } catch (error: any) {
    console.error('❌ Error in ingest route:', error)
    
    // Update feed_ingestions if we have an ID
    if (ingestionId) {
      try {
        const supabase = await createSupabaseServerClient()
        const { error: updateError } = await supabase
          .from('feed_ingestions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message || 'Unknown error'
          })
          .eq('id', ingestionId)
          
        if (updateError) {
          console.error('❌ Error updating feed_ingestions in catch block:', updateError)
        } else {
          console.log('✅ Updated feed_ingestions in catch block')
        }
      } catch (updateError) {
        console.error('❌ Error updating feed_ingestions in catch block:', updateError)
      }
    }
    
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}