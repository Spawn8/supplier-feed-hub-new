// lib/woocommerce.ts
import { createSupabaseServerClient } from './supabaseServer'
import { logActivity } from './auth'

export interface WooCommerceConfig {
  site_url: string
  consumer_key: string
  consumer_secret: string
  api_version: string
}

export interface WooCommerceProduct {
  id?: number
  name: string
  type: string
  status: string
  featured: boolean
  catalog_visibility: string
  description: string
  short_description: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  date_on_sale_from?: string
  date_on_sale_to?: string
  on_sale: boolean
  purchasable: boolean
  total_sales: number
  virtual: boolean
  downloadable: boolean
  downloads: any[]
  download_limit: number
  download_expiry: number
  external_url: string
  button_text: string
  tax_status: string
  tax_class: string
  manage_stock: boolean
  stock_quantity?: number
  stock_status: string
  backorders: string
  backorders_allowed: boolean
  backordered: boolean
  sold_individually: boolean
  weight: string
  dimensions: {
    length: string
    width: string
    height: string
  }
  shipping_required: boolean
  shipping_taxable: boolean
  shipping_class: string
  shipping_class_id: number
  reviews_allowed: boolean
  average_rating: string
  rating_count: number
  related_ids: number[]
  upsell_ids: number[]
  cross_sell_ids: number[]
  parent_id: number
  purchase_note: string
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
  tags: Array<{
    id: number
    name: string
    slug: string
  }>
  images: Array<{
    id: number
    date_created: string
    date_created_gmt: string
    date_modified: string
    date_modified_gmt: string
    src: string
    name: string
    alt: string
  }>
  attributes: Array<{
    id: number
    name: string
    position: number
    visible: boolean
    variation: boolean
    options: string[]
  }>
  default_attributes: Array<{
    id: number
    name: string
    option: string
  }>
  variations: number[]
  grouped_products: number[]
  menu_order: number
  meta_data: Array<{
    id: number
    key: string
    value: string
  }>
}

export interface WooCommerceSyncResult {
  success: boolean
  created: number
  updated: number
  errors: number
  error_details: string[]
}

/**
 * Test WooCommerce connection
 */
export async function testWooCommerceConnection(
  config: WooCommerceConfig
): Promise<{ success: boolean; error?: string; site_info?: any }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/system_status`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const data = await response.json()
    
    return {
      success: true,
      site_info: data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get WooCommerce products
 */
export async function getWooCommerceProducts(
  config: WooCommerceConfig,
  page: number = 1,
  perPage: number = 100
): Promise<{ success: boolean; products?: WooCommerceProduct[]; error?: string }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/products?page=${page}&per_page=${perPage}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const products = await response.json()
    
    return {
      success: true,
      products
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create or update WooCommerce product
 */
export async function upsertWooCommerceProduct(
  config: WooCommerceConfig,
  product: WooCommerceProduct
): Promise<{ success: boolean; product?: WooCommerceProduct; error?: string }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    
    // First, try to find existing product by SKU
    const existingProduct = await findWooCommerceProductBySku(config, product.sku)
    
    let response: Response
    let url: string
    
    if (existingProduct) {
      // Update existing product
      url = `${config.site_url}/wp-json/wc/${config.api_version}/products/${existingProduct.id}`
      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(product)
      })
    } else {
      // Create new product
      url = `${config.site_url}/wp-json/wc/${config.api_version}/products`
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(product)
      })
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorData.message || response.statusText}`
      }
    }
    
    const result = await response.json()
    
    return {
      success: true,
      product: result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find WooCommerce product by SKU
 */
export async function findWooCommerceProductBySku(
  config: WooCommerceConfig,
  sku: string
): Promise<WooCommerceProduct | null> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/products?sku=${encodeURIComponent(sku)}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const products = await response.json()
    return products.length > 0 ? products[0] : null
  } catch (error) {
    return null
  }
}

/**
 * Delete WooCommerce product
 */
export async function deleteWooCommerceProduct(
  config: WooCommerceConfig,
  productId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/products/${productId}?force=true`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorData.message || response.statusText}`
      }
    }
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sync products to WooCommerce
 */
export async function syncProductsToWooCommerce(
  workspaceId: string,
  integrationId: string,
  productIds?: string[]
): Promise<{ success: boolean; result?: WooCommerceSyncResult; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get integration config
  const { data: integration } = await supabase
    .from('integrations')
    .select('config')
    .eq('id', integrationId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (!integration) {
    return { success: false, error: 'Integration not found' }
  }
  
  const config = integration.config as WooCommerceConfig
  
  // Test connection first
  const connectionTest = await testWooCommerceConnection(config)
  if (!connectionTest.success) {
    return { success: false, error: `Connection failed: ${connectionTest.error}` }
  }
  
  // Get products to sync
  let query = supabase
    .from('products_final')
    .select('*')
    .eq('workspace_id', workspaceId)
  
  if (productIds && productIds.length > 0) {
    query = query.in('id', productIds)
  }
  
  const { data: products, error: productsError } = await query
  
  if (productsError) {
    console.error('Error fetching products for sync:', productsError)
    return { success: false, error: productsError.message }
  }
  
  if (!products || products.length === 0) {
    return { success: false, error: 'No products found to sync' }
  }
  
  // Get existing WooCommerce products to track what should be deleted
  const existingProducts = await getWooCommerceProducts(config, 1, 1000)
  const existingSkus = new Set(
    existingProducts.products?.map(p => p.sku).filter(Boolean) || []
  )
  
  const result: WooCommerceSyncResult = {
    success: true,
    created: 0,
    updated: 0,
    errors: 0,
    error_details: []
  }
  
  const processedSkus = new Set<string>()
  
  // Process each product
  for (const product of products) {
    try {
      const wooProduct = transformProductToWooCommerce(product)
      
      if (!wooProduct.sku) {
        result.errors++
        result.error_details.push(`Product ${product.id} has no SKU`)
        continue
      }
      
      processedSkus.add(wooProduct.sku)
      
      const upsertResult = await upsertWooCommerceProduct(config, wooProduct)
      
      if (upsertResult.success) {
        if (existingSkus.has(wooProduct.sku)) {
          result.updated++
        } else {
          result.created++
        }
      } else {
        result.errors++
        result.error_details.push(`Failed to sync product ${product.id}: ${upsertResult.error}`)
      }
    } catch (error) {
      result.errors++
      result.error_details.push(`Error processing product ${product.id}: ${error}`)
    }
  }
  
  // Delete products that are no longer in our feed
  if (productIds === undefined) { // Only delete if syncing all products
    for (const existingSku of existingSkus) {
      if (!processedSkus.has(existingSku)) {
        try {
          const productToDelete = await findWooCommerceProductBySku(config, existingSku)
          if (productToDelete) {
            const deleteResult = await deleteWooCommerceProduct(config, productToDelete.id!)
            if (!deleteResult.success) {
              result.error_details.push(`Failed to delete product ${existingSku}: ${deleteResult.error}`)
            }
          }
        } catch (error) {
          result.error_details.push(`Error deleting product ${existingSku}: ${error}`)
        }
      }
    }
  }
  
  // Update integration sync status
  await supabase
    .from('integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: 'completed'
    })
    .eq('id', integrationId)
  
  // Log activity
  await logActivity(workspaceId, 'woocommerce_sync_completed', 'integration', integrationId, {
    result
  })
  
  return { success: true, result }
}

/**
 * Transform our product to WooCommerce format
 */
function transformProductToWooCommerce(product: any): WooCommerceProduct {
  return {
    name: product.title || 'Unknown Product',
    type: 'simple',
    status: 'publish',
    featured: false,
    catalog_visibility: 'visible',
    description: product.description || '',
    short_description: product.description ? product.description.substring(0, 160) : '',
    sku: product.sku || '',
    price: product.price ? String(product.price) : '0',
    regular_price: product.price ? String(product.price) : '0',
    sale_price: '',
    on_sale: false,
    purchasable: product.in_stock,
    total_sales: 0,
    virtual: false,
    downloadable: false,
    downloads: [],
    download_limit: -1,
    download_expiry: -1,
    external_url: '',
    button_text: '',
    tax_status: 'taxable',
    tax_class: '',
    manage_stock: true,
    stock_quantity: product.quantity || 0,
    stock_status: product.in_stock ? 'instock' : 'outofstock',
    backorders: 'no',
    backorders_allowed: false,
    backordered: false,
    sold_individually: false,
    weight: '',
    dimensions: {
      length: '',
      width: '',
      height: ''
    },
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: '',
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: '0',
    rating_count: 0,
    related_ids: [],
    upsell_ids: [],
    cross_sell_ids: [],
    parent_id: 0,
    purchase_note: '',
    categories: product.category_id ? [{
      id: product.category_id,
      name: product.category_name || 'Uncategorized',
      slug: product.category_slug || 'uncategorized'
    }] : [],
    tags: [],
    images: product.image_url ? [{
      id: 0,
      date_created: new Date().toISOString(),
      date_created_gmt: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      date_modified_gmt: new Date().toISOString(),
      src: product.image_url,
      name: product.title || 'Product Image',
      alt: product.title || 'Product Image'
    }] : [],
    attributes: [],
    default_attributes: [],
    variations: [],
    grouped_products: [],
    menu_order: 0,
    meta_data: [
      {
        id: 0,
        key: '_supplier_feed_hub_id',
        value: product.id
      },
      {
        id: 0,
        key: '_supplier_feed_hub_uid',
        value: product.uid
      },
      {
        id: 0,
        key: '_supplier_feed_hub_supplier',
        value: product.winning_supplier_id
      }
    ]
  }
}

/**
 * Get WooCommerce categories
 */
export async function getWooCommerceCategories(
  config: WooCommerceConfig
): Promise<{ success: boolean; categories?: any[]; error?: string }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/products/categories`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const categories = await response.json()
    
    return {
      success: true,
      categories
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create WooCommerce category
 */
export async function createWooCommerceCategory(
  config: WooCommerceConfig,
  categoryData: {
    name: string
    slug?: string
    parent?: number
    description?: string
  }
): Promise<{ success: boolean; category?: any; error?: string }> {
  try {
    const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)
    const url = `${config.site_url}/wp-json/wc/${config.api_version}/products/categories`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorData.message || response.statusText}`
      }
    }
    
    const category = await response.json()
    
    return {
      success: true,
      category
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
