// lib/logging.ts
import { createSupabaseServerClient } from './supabaseServer'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type LogCategory = 'system' | 'user' | 'supplier' | 'sync' | 'export' | 'integration'

export interface LogEntry {
  id: string
  workspace_id: string
  level: LogLevel
  category: LogCategory
  message: string
  details?: Record<string, any>
  user_id?: string
  resource_type?: string
  resource_id?: string
  created_at: string
}

export interface FeedIngestion {
  id: string
  workspace_id: string
  supplier_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  duration_ms?: number
  items_total: number
  items_processed: number
  items_success: number
  items_errors: number
  error_message?: string
  source_file?: string
  created_by?: string
}

export interface FeedError {
  id: string
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  item_index?: number
  code?: string
  message: string
  raw?: any
  created_at: string
}

export interface ActivityLog {
  id: string
  workspace_id: string
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

/**
 * Log a message
 */
export async function logMessage(
  workspaceId: string,
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: Record<string, any>,
  userId?: string,
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  
  await supabase
    .from('activity_logs')
    .insert({
      workspace_id: workspaceId,
      user_id: userId || 'system',
      action: `${category}:${level}`,
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        message,
        level,
        category,
        ...details
      }
    })
}

/**
 * Log feed ingestion start
 */
export async function logFeedIngestionStart(
  workspaceId: string,
  supplierId: string,
  userId?: string,
  sourceFile?: string
): Promise<string> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('feed_ingestions')
    .insert({
      workspace_id: workspaceId,
      supplier_id: supplierId,
      status: 'running',
      source_file: sourceFile,
      created_by: userId
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Error creating feed ingestion log:', error)
    return ''
  }
  
  return data.id
}

/**
 * Log feed ingestion completion
 */
export async function logFeedIngestionComplete(
  ingestionId: string,
  stats: {
    items_total: number
    items_processed: number
    items_success: number
    items_errors: number
    error_message?: string
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  
  const { data: ingestion } = await supabase
    .from('feed_ingestions')
    .select('started_at')
    .eq('id', ingestionId)
    .single()
  
  const duration = ingestion?.started_at 
    ? Date.now() - new Date(ingestion.started_at).getTime()
    : 0
  
  await supabase
    .from('feed_ingestions')
    .update({
      status: stats.items_errors > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      items_total: stats.items_total,
      items_processed: stats.items_processed,
      items_success: stats.items_success,
      items_errors: stats.items_errors,
      error_message: stats.error_message
    })
    .eq('id', ingestionId)
}

/**
 * Log feed error
 */
export async function logFeedError(
  workspaceId: string,
  supplierId: string,
  ingestionId: string,
  error: {
    item_index?: number
    code?: string
    message: string
    raw?: any
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  
  await supabase
    .from('feed_errors')
    .insert({
      workspace_id: workspaceId,
      supplier_id: supplierId,
      ingestion_id: ingestionId,
      item_index: error.item_index,
      code: error.code,
      message: error.message,
      raw: error.raw ? JSON.stringify(error.raw).slice(0, 2000) : null
    })
}

/**
 * Get feed ingestion logs
 */
export async function getFeedIngestions(
  workspaceId: string,
  supplierId?: string,
  limit: number = 50
): Promise<FeedIngestion[]> {
  const supabase = await createSupabaseServerClient()
  
  let query = supabase
    .from('feed_ingestions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false })
    .limit(limit)
  
  if (supplierId) {
    query = query.eq('supplier_id', supplierId)
  }
  
  const { data, error } = await supabase
    .from('feed_ingestions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching feed ingestions:', error)
    return []
  }
  
  return data || []
}

/**
 * Get feed errors
 */
export async function getFeedErrors(
  workspaceId: string,
  supplierId?: string,
  ingestionId?: string,
  limit: number = 100
): Promise<FeedError[]> {
  const supabase = await createSupabaseServerClient()
  
  let query = supabase
    .from('feed_errors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (supplierId) {
    query = query.eq('supplier_id', supplierId)
  }
  
  if (ingestionId) {
    query = query.eq('ingestion_id', ingestionId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching feed errors:', error)
    return []
  }
  
  return data || []
}

/**
 * Get activity logs
 */
export async function getActivityLogs(
  workspaceId: string,
  userId?: string,
  action?: string,
  limit: number = 100
): Promise<ActivityLog[]> {
  const supabase = await createSupabaseServerClient()
  
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (userId) {
    query = query.eq('user_id', userId)
  }
  
  if (action) {
    query = query.eq('action', action)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching activity logs:', error)
    return []
  }
  
  return data || []
}

/**
 * Get system health metrics
 */
export async function getSystemHealth(workspaceId: string): Promise<{
  total_suppliers: number
  active_suppliers: number
  failed_suppliers: number
  total_products: number
  last_sync_at?: string
  error_rate: number
  success_rate: number
}> {
  const supabase = await createSupabaseServerClient()
  
  // Get supplier counts
  const { count: totalSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  const { count: activeSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  
  const { count: failedSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'error')
  
  // Get product count
  const { count: totalProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  // Get last sync time
  const { data: lastSync } = await supabase
    .from('feed_ingestions')
    .select('completed_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()
  
  // Get sync statistics
  const { data: syncStats } = await supabase
    .from('feed_ingestions')
    .select('items_success, items_errors')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
  
  const totalSuccess = syncStats?.reduce((sum, stat) => sum + stat.items_success, 0) || 0
  const totalErrors = syncStats?.reduce((sum, stat) => sum + stat.items_errors, 0) || 0
  const totalItems = totalSuccess + totalErrors
  
  const errorRate = totalItems > 0 ? (totalErrors / totalItems) * 100 : 0
  const successRate = totalItems > 0 ? (totalSuccess / totalItems) * 100 : 0
  
  return {
    total_suppliers: totalSuppliers || 0,
    active_suppliers: activeSuppliers || 0,
    failed_suppliers: failedSuppliers || 0,
    total_products: totalProducts || 0,
    last_sync_at: lastSync?.completed_at,
    error_rate: Math.round(errorRate),
    success_rate: Math.round(successRate)
  }
}

/**
 * Get supplier health metrics
 */
export async function getSupplierHealth(supplierId: string): Promise<{
  status: string
  last_sync_at?: string
  sync_frequency: number
  success_rate: number
  error_count: number
  total_products: number
  avg_processing_time: number
}> {
  const supabase = await createSupabaseServerClient()
  
  // Get supplier status
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('status, last_sync_at, schedule_cron')
    .eq('id', supplierId)
    .single()
  
  // Get sync statistics
  const { data: syncStats } = await supabase
    .from('feed_ingestions')
    .select('items_success, items_errors, duration_ms, completed_at')
    .eq('supplier_id', supplierId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)
  
  // Get error count
  const { count: errorCount } = await supabase
    .from('feed_errors')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
  
  // Get product count
  const { count: totalProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('winning_supplier_id', supplierId)
  
  const totalSuccess = syncStats?.reduce((sum, stat) => sum + stat.items_success, 0) || 0
  const totalErrors = syncStats?.reduce((sum, stat) => sum + stat.items_errors, 0) || 0
  const totalItems = totalSuccess + totalErrors
  const successRate = totalItems > 0 ? (totalSuccess / totalItems) * 100 : 0
  
  const avgProcessingTime = syncStats?.length 
    ? Math.round(syncStats.reduce((sum, stat) => sum + (stat.duration_ms || 0), 0) / syncStats.length)
    : 0
  
  // Calculate sync frequency (approximate)
  let syncFrequency = 0
  if (supplier?.schedule_cron) {
    // Parse cron expression to get frequency
    // This is a simplified calculation
    if (supplier.schedule_cron.includes('* * * * *')) {
      syncFrequency = 1 // Every minute
    } else if (supplier.schedule_cron.includes('0 * * * *')) {
      syncFrequency = 60 // Every hour
    } else if (supplier.schedule_cron.includes('0 0 * * *')) {
      syncFrequency = 1440 // Daily
    }
  }
  
  return {
    status: supplier?.status || 'unknown',
    last_sync_at: supplier?.last_sync_at,
    sync_frequency: syncFrequency,
    success_rate: Math.round(successRate),
    error_count: errorCount || 0,
    total_products: totalProducts || 0,
    avg_processing_time: avgProcessingTime
  }
}

/**
 * Clean up old logs
 */
export async function cleanupOldLogs(workspaceId: string, daysToKeep: number = 30): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()
  
  // Clean up old feed errors
  await supabase
    .from('feed_errors')
    .delete()
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate)
  
  // Clean up old activity logs
  await supabase
    .from('activity_logs')
    .delete()
    .eq('workspace_id', workspaceId)
    .lt('created_at', cutoffDate)
  
  // Clean up old feed ingestions (keep successful ones longer)
  const successfulCutoff = new Date(Date.now() - daysToKeep * 2 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('feed_ingestions')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('status', 'failed')
    .lt('started_at', cutoffDate)
  
  await supabase
    .from('feed_ingestions')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .lt('started_at', successfulCutoff)
}

/**
 * Get dashboard metrics
 */
export async function getDashboardMetrics(workspaceId: string): Promise<{
  suppliers: {
    total: number
    active: number
    with_errors: number
  }
  products: {
    total: number
    in_stock: number
    out_of_stock: number
  }
  syncs: {
    last_24h: number
    successful: number
    failed: number
  }
  exports: {
    last_7d: number
    total_items: number
  }
}> {
  const supabase = await createSupabaseServerClient()
  
  // Supplier metrics
  const { count: totalSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  const { count: activeSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  
  const { count: suppliersWithErrors } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'error')
  
  // Product metrics
  const { count: totalProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  const { count: inStockProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('in_stock', true)
  
  const { count: outOfStockProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('in_stock', false)
  
  // Sync metrics (last 24 hours)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { count: syncsLast24h } = await supabase
    .from('feed_ingestions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('started_at', last24h)
  
  const { count: successfulSyncs } = await supabase
    .from('feed_ingestions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .gte('started_at', last24h)
  
  const { count: failedSyncs } = await supabase
    .from('feed_ingestions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'failed')
    .gte('started_at', last24h)
  
  // Export metrics (last 7 days)
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { count: exportsLast7d } = await supabase
    .from('export_history')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', last7d)
  
  const { data: exportItems } = await supabase
    .from('export_history')
    .select('item_count')
    .eq('workspace_id', workspaceId)
    .gte('created_at', last7d)
  
  const totalExportItems = exportItems?.reduce((sum, exp) => sum + exp.item_count, 0) || 0
  
  return {
    suppliers: {
      total: totalSuppliers || 0,
      active: activeSuppliers || 0,
      with_errors: suppliersWithErrors || 0
    },
    products: {
      total: totalProducts || 0,
      in_stock: inStockProducts || 0,
      out_of_stock: outOfStockProducts || 0
    },
    syncs: {
      last_24h: syncsLast24h || 0,
      successful: successfulSyncs || 0,
      failed: failedSyncs || 0
    },
    exports: {
      last_7d: exportsLast7d || 0,
      total_items: totalExportItems
    }
  }
}
