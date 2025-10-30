// lib/exports.ts
import { createSupabaseServerClient } from './supabaseServer'
import { logActivity } from './auth'

export type ExportFormat = 'csv' | 'json' | 'xml'
export type ExportPlatform = 'woocommerce' | 'shopify' | 'magento' | 'custom'
export type DeliveryMethod = 'download' | 'webhook' | 's3'

export interface ExportProfile {
  id: string
  workspace_id: string
  name: string
  description?: string
  output_format: ExportFormat
  platform?: ExportPlatform
  field_selection: string[]
  field_ordering: string[]
  filters: Record<string, any>
  template_config: Record<string, any>
  file_naming: string
  delivery_method: DeliveryMethod
  delivery_config: Record<string, any>
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ExportHistory {
  id: string
  workspace_id: string
  export_profile_id: string
  filename: string
  file_size?: number
  item_count: number
  generation_time_ms: number
  download_url?: string
  expires_at?: string
  created_by: string
  created_at: string
}

export interface ExportStats {
  total_exports: number
  total_items_exported: number
  average_generation_time: number
  last_export_at?: string
}

/**
 * Get all export profiles for a workspace
 */
export async function getExportProfiles(workspaceId: string): Promise<ExportProfile[]> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('export_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching export profiles:', error)
    return []
  }
  
  return data || []
}

/**
 * Get a single export profile
 */
export async function getExportProfile(profileId: string): Promise<ExportProfile | null> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('export_profiles')
    .select('*')
    .eq('id', profileId)
    .single()
  
  if (error) {
    console.error('Error fetching export profile:', error)
    return null
  }
  
  return data
}

/**
 * Create a new export profile
 */
export async function createExportProfile(
  workspaceId: string,
  profileData: {
    name: string
    description?: string
    output_format: ExportFormat
    platform?: ExportPlatform
    field_selection: string[]
    field_ordering: string[]
    filters?: Record<string, any>
    template_config?: Record<string, any>
    file_naming?: string
    delivery_method?: DeliveryMethod
    delivery_config?: Record<string, any>
  }
): Promise<{ success: boolean; profile?: ExportProfile; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  const { data, error } = await supabase
    .from('export_profiles')
    .insert({
      workspace_id: workspaceId,
      name: profileData.name,
      description: profileData.description,
      output_format: profileData.output_format,
      platform: profileData.platform,
      field_selection: profileData.field_selection,
      field_ordering: profileData.field_ordering,
      filters: profileData.filters || {},
      template_config: profileData.template_config || {},
      file_naming: profileData.file_naming || 'export_{timestamp}',
      delivery_method: profileData.delivery_method || 'download',
      delivery_config: profileData.delivery_config || {},
      created_by: user.id
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating export profile:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(workspaceId, 'export_profile_created', 'export_profile', data.id, {
    name: data.name,
    output_format: data.output_format,
    platform: data.platform
  })
  
  return { success: true, profile: data }
}

/**
 * Update an export profile
 */
export async function updateExportProfile(
  profileId: string,
  updates: Partial<{
    name: string
    description: string
    output_format: ExportFormat
    platform: ExportPlatform
    field_selection: string[]
    field_ordering: string[]
    filters: Record<string, any>
    template_config: Record<string, any>
    file_naming: string
    delivery_method: DeliveryMethod
    delivery_config: Record<string, any>
    is_active: boolean
  }>
): Promise<{ success: boolean; profile?: ExportProfile; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get current profile for logging
  const { data: currentProfile } = await supabase
    .from('export_profiles')
    .select('workspace_id, name')
    .eq('id', profileId)
    .single()
  
  if (!currentProfile) {
    return { success: false, error: 'Export profile not found' }
  }
  
  const { data, error } = await supabase
    .from('export_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating export profile:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(currentProfile.workspace_id, 'export_profile_updated', 'export_profile', profileId, {
    name: currentProfile.name,
    changes: Object.keys(updates)
  })
  
  return { success: true, profile: data }
}

/**
 * Delete an export profile
 */
export async function deleteExportProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get profile info for logging
  const { data: profile } = await supabase
    .from('export_profiles')
    .select('workspace_id, name')
    .eq('id', profileId)
    .single()
  
  if (!profile) {
    return { success: false, error: 'Export profile not found' }
  }
  
  const { error } = await supabase
    .from('export_profiles')
    .delete()
    .eq('id', profileId)
  
  if (error) {
    console.error('Error deleting export profile:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(profile.workspace_id, 'export_profile_deleted', 'export_profile', profileId, {
    name: profile.name
  })
  
  return { success: true }
}

/**
 * Generate export preview
 */
export async function generateExportPreview(
  profileId: string,
  limit: number = 10
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  const profile = await getExportProfile(profileId)
  if (!profile) {
    return { success: false, error: 'Export profile not found' }
  }
  
  // Get products with filters applied
  let query = supabase
    .from('products_mapped')
    .select('*')
    .eq('workspace_id', profile.workspace_id)
    .limit(limit)
  
  // Apply filters
  if (profile.filters.in_stock_only) {
    query = query.eq('in_stock', true)
  }
  
  if (profile.filters.min_price) {
    query = query.gte('price', profile.filters.min_price)
  }
  
  if (profile.filters.max_price) {
    query = query.lte('price', profile.filters.max_price)
  }
  
  if (profile.filters.categories && profile.filters.categories.length > 0) {
    query = query.in('category_id', profile.filters.categories)
  }
  
  const { data: products, error } = await query
  
  if (error) {
    console.error('Error fetching products for preview:', error)
    return { success: false, error: error.message }
  }
  
  // Transform products based on field selection and ordering
  const transformedData = products?.map(product => {
    const result: Record<string, any> = {}
    
    // Apply field selection and ordering
    const fieldsToInclude = profile.field_ordering.length > 0 
      ? profile.field_ordering 
      : profile.field_selection
    
    for (const fieldKey of fieldsToInclude) {
      if (profile.field_selection.includes(fieldKey)) {
        result[fieldKey] = product[fieldKey] || product.attributes?.[fieldKey]
      }
    }
    
    return result
  }) || []
  
  return { success: true, data: transformedData }
}

/**
 * Generate full export
 */
export async function generateFullExport(
  profileId: string
): Promise<{ success: boolean; exportId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  const profile = await getExportProfile(profileId)
  if (!profile) {
    return { success: false, error: 'Export profile not found' }
  }
  
  const startTime = Date.now()
  
  // Get all products with filters applied
  let query = supabase
    .from('products_mapped')
    .select('*')
    .eq('workspace_id', profile.workspace_id)
  
  // Apply filters
  if (profile.filters.in_stock_only) {
    query = query.eq('in_stock', true)
  }
  
  if (profile.filters.min_price) {
    query = query.gte('price', profile.filters.min_price)
  }
  
  if (profile.filters.max_price) {
    query = query.lte('price', profile.filters.max_price)
  }
  
  if (profile.filters.categories && profile.filters.categories.length > 0) {
    query = query.in('category_id', profile.filters.categories)
  }
  
  const { data: products, error } = await query
  
  if (error) {
    console.error('Error fetching products for export:', error)
    return { success: false, error: error.message }
  }
  
  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = profile.file_naming
    .replace('{timestamp}', timestamp)
    .replace('{format}', profile.output_format)
    .replace('{platform}', profile.platform || 'custom')
  
  // Transform data based on format
  let exportData: string
  let contentType: string
  
  switch (profile.output_format) {
    case 'csv':
      exportData = generateCSV(products || [], profile)
      contentType = 'text/csv'
      break
    case 'json':
      exportData = generateJSON(products || [], profile)
      contentType = 'application/json'
      break
    case 'xml':
      exportData = generateXML(products || [], profile)
      contentType = 'application/xml'
      break
    default:
      return { success: false, error: 'Unsupported export format' }
  }
  
  // Upload to storage
  const storagePath = `exports/${profile.workspace_id}/${filename}`
  const { error: uploadError } = await supabase.storage
    .from('exports')
    .upload(storagePath, exportData, {
      contentType,
      cacheControl: '3600'
    })
  
  if (uploadError) {
    console.error('Error uploading export file:', uploadError)
    return { success: false, error: uploadError.message }
  }
  
  // Generate signed URL
  const { data: signedUrlData } = await supabase.storage
    .from('exports')
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60) // 7 days
  
  const generationTime = Date.now() - startTime
  
  // Create export history record
  const { data: exportHistory, error: historyError } = await supabase
    .from('export_history')
    .insert({
      workspace_id: profile.workspace_id,
      export_profile_id: profileId,
      filename,
      file_size: exportData.length,
      item_count: products?.length || 0,
      generation_time_ms: generationTime,
      download_url: signedUrlData?.signedUrl,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id
    })
    .select()
    .single()
  
  if (historyError) {
    console.error('Error creating export history:', historyError)
    return { success: false, error: historyError.message }
  }
  
  // Log activity
  await logActivity(profile.workspace_id, 'export_generated', 'export_profile', profileId, {
    filename,
    item_count: products?.length || 0,
    generation_time_ms: generationTime
  })
  
  return { success: true, exportId: exportHistory.id }
}

/**
 * Generate CSV export
 */
function generateCSV(products: any[], profile: ExportProfile): string {
  const fieldsToInclude = profile.field_ordering.length > 0 
    ? profile.field_ordering 
    : profile.field_selection
  
  // CSV header
  const headers = fieldsToInclude.join(',')
  
  // CSV rows
  const rows = products.map(product => {
    const values = fieldsToInclude.map(fieldKey => {
      const value = product[fieldKey] || product.attributes?.[fieldKey] || ''
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
function generateJSON(products: any[], profile: ExportProfile): string {
  const fieldsToInclude = profile.field_ordering.length > 0 
    ? profile.field_ordering 
    : profile.field_selection
  
  const transformedProducts = products.map(product => {
    const result: Record<string, any> = {}
    
    for (const fieldKey of fieldsToInclude) {
      if (profile.field_selection.includes(fieldKey)) {
        result[fieldKey] = product[fieldKey] || product.attributes?.[fieldKey]
      }
    }
    
    return result
  })
  
  return JSON.stringify(transformedProducts, null, 2)
}

/**
 * Generate XML export
 */
function generateXML(products: any[], profile: ExportProfile): string {
  const fieldsToInclude = profile.field_ordering.length > 0
    ? profile.field_ordering 
    : profile.field_selection
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<products>\n'
  
  for (const product of products) {
    xml += '  <product>\n'
    
    for (const fieldKey of fieldsToInclude) {
      if (profile.field_selection.includes(fieldKey)) {
        const value = product[fieldKey] || product.attributes?.[fieldKey] || ''
        const escapedValue = String(value).replace(/&/g, '&amp;')
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

/**
 * Get export history for a workspace
 */
export async function getExportHistory(
  workspaceId: string,
  limit: number = 50
): Promise<ExportHistory[]> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('export_history')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching export history:', error)
    return []
  }
  
  return data || []
}

/**
 * Get export statistics
 */
export async function getExportStats(workspaceId: string): Promise<ExportStats> {
  const supabase = await createSupabaseServerClient()
  
  // Get total exports
  const { count: totalExports } = await supabase
    .from('export_history')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  // Get total items exported
  const { data: exports } = await supabase
    .from('export_history')
    .select('item_count, generation_time_ms, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  const totalItems = exports?.reduce((sum, exp) => sum + exp.item_count, 0) || 0
  const avgGenerationTime = exports?.length 
    ? Math.round(exports.reduce((sum, exp) => sum + exp.generation_time_ms, 0) / exports.length)
    : 0
  const lastExport = exports?.[0]?.created_at
  
  return {
    total_exports: totalExports || 0,
    total_items_exported: totalItems,
    average_generation_time: avgGenerationTime,
    last_export_at: lastExport
  }
}

/**
 * Get WooCommerce-specific export template
 */
export function getWooCommerceTemplate(): Partial<ExportProfile> {
  return {
    output_format: 'csv',
    platform: 'woocommerce',
    field_selection: [
      'title',
      'description',
      'sku',
      'price',
      'regular_price',
      'sale_price',
      'stock_quantity',
      'manage_stock',
      'stock_status',
      'category',
      'tags',
      'images',
      'attributes'
    ],
    field_ordering: [
      'title',
      'description',
      'sku',
      'price',
      'regular_price',
      'sale_price',
      'stock_quantity',
      'manage_stock',
      'stock_status',
      'category',
      'tags',
      'images',
      'attributes'
    ],
    template_config: {
      csv_separator: ',',
      include_headers: true,
      date_format: 'Y-m-d H:i:s',
      decimal_separator: '.',
      thousand_separator: ','
    }
  }
}

/**
 * Get Shopify-specific export template
 */
export function getShopifyTemplate(): Partial<ExportProfile> {
  return {
    output_format: 'csv',
    platform: 'shopify',
    field_selection: [
      'title',
      'body_html',
      'vendor',
      'product_type',
      'tags',
      'published',
      'option1_name',
      'option1_value',
      'option2_name',
      'option2_value',
      'option3_name',
      'option3_value',
      'variant_sku',
      'variant_grams',
      'variant_inventory_tracker',
      'variant_inventory_qty',
      'variant_inventory_policy',
      'variant_fulfillment_service',
      'variant_price',
      'variant_compare_at_price',
      'variant_requires_shipping',
      'variant_taxable',
      'variant_barcode',
      'image_src',
      'image_position',
      'image_alt_text',
      'gift_card',
      'seo_title',
      'seo_description',
      'google_shopping_category',
      'google_shopping_gender',
      'google_shopping_age_group',
      'google_shopping_mpn',
      'google_shopping_adwords_grouping',
      'google_shopping_adwords_labels',
      'google_shopping_condition',
      'google_shopping_custom_product',
      'google_shopping_custom_label_0',
      'google_shopping_custom_label_1',
      'google_shopping_custom_label_2',
      'google_shopping_custom_label_3',
      'google_shopping_custom_label_4'
    ],
    field_ordering: [
      'title',
      'body_html',
      'vendor',
      'product_type',
      'tags',
      'published',
      'option1_name',
      'option1_value',
      'option2_name',
      'option2_value',
      'option3_name',
      'option3_value',
      'variant_sku',
      'variant_grams',
      'variant_inventory_tracker',
      'variant_inventory_qty',
      'variant_inventory_policy',
      'variant_fulfillment_service',
      'variant_price',
      'variant_compare_at_price',
      'variant_requires_shipping',
      'variant_taxable',
      'variant_barcode',
      'image_src',
      'image_position',
      'image_alt_text',
      'gift_card',
      'seo_title',
      'seo_description',
      'google_shopping_category',
      'google_shopping_gender',
      'google_shopping_age_group',
      'google_shopping_mpn',
      'google_shopping_adwords_grouping',
      'google_shopping_adwords_labels',
      'google_shopping_condition',
      'google_shopping_custom_product',
      'google_shopping_custom_label_0',
      'google_shopping_custom_label_1',
      'google_shopping_custom_label_2',
      'google_shopping_custom_label_3',
      'google_shopping_custom_label_4'
    ],
    template_config: {
      csv_separator: ',',
      include_headers: true,
      date_format: 'Y-m-d H:i:s',
      decimal_separator: '.',
      thousand_separator: ','
    }
  }
}
