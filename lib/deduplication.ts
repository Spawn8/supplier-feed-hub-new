// lib/deduplication.ts
// DEPRECATED: No longer used since we removed products_final table
// products_mapped is now the single source of truth
import { createSupabaseServerClient } from './supabaseServer'
import { logActivity } from './auth'

export type MatchKey = 'ean' | 'sku' | 'title'
export type SelectionPolicy = 'lowest_price' | 'preferred_supplier' | 'highest_stock' | 'first_available'

export interface DeduplicationRule {
  id: string
  workspace_id: string
  name: string
  match_key: MatchKey
  selection_policy: SelectionPolicy
  preferred_suppliers: string[]
  exclusion_rules: {
    min_price?: number
    max_price?: number
    exclude_out_of_stock?: boolean
    category_blacklist?: string[]
    keyword_blacklist?: string[]
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductConflict {
  uid: string
  products: Array<{
    supplier_id: string
    supplier_name: string
    title: string
    price: number
    currency: string
    quantity: number
    in_stock: boolean
    category: string
    brand: string
    image_url: string
    raw_data: any
  }>
  winning_supplier_id: string
  winning_reason: string
  conflict_details: string
}

export interface DeduplicationStats {
  total_products: number
  unique_products: number
  conflicts_resolved: number
  duplicates_removed: number
  coverage_percentage: number
}

/**
 * Get deduplication rules for a workspace
 */
export async function getDeduplicationRules(workspaceId: string): Promise<DeduplicationRule[]> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('deduplication_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching deduplication rules:', error)
    return []
  }
  
  return data || []
}

/**
 * Create a new deduplication rule
 */
export async function createDeduplicationRule(
  workspaceId: string,
  ruleData: {
    name: string
    match_key: MatchKey
    selection_policy: SelectionPolicy
    preferred_suppliers?: string[]
    exclusion_rules?: Record<string, any>
  }
): Promise<{ success: boolean; rule?: DeduplicationRule; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('deduplication_rules')
    .insert({
      workspace_id: workspaceId,
      name: ruleData.name,
      match_key: ruleData.match_key,
      selection_policy: ruleData.selection_policy,
      preferred_suppliers: ruleData.preferred_suppliers || [],
      exclusion_rules: ruleData.exclusion_rules || {}
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating deduplication rule:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(workspaceId, 'deduplication_rule_created', 'deduplication_rule', data.id, {
    name: data.name,
    match_key: data.match_key,
    selection_policy: data.selection_policy
  })
  
  return { success: true, rule: data }
}

/**
 * Update a deduplication rule
 */
export async function updateDeduplicationRule(
  ruleId: string,
  updates: Partial<{
    name: string
    match_key: MatchKey
    selection_policy: SelectionPolicy
    preferred_suppliers: string[]
    exclusion_rules: Record<string, any>
    is_active: boolean
  }>
): Promise<{ success: boolean; rule?: DeduplicationRule; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get current rule for logging
  const { data: currentRule } = await supabase
    .from('deduplication_rules')
    .select('workspace_id, name')
    .eq('id', ruleId)
    .single()
  
  if (!currentRule) {
    return { success: false, error: 'Rule not found' }
  }
  
  const { data, error } = await supabase
    .from('deduplication_rules')
    .update(updates)
    .eq('id', ruleId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating deduplication rule:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(currentRule.workspace_id, 'deduplication_rule_updated', 'deduplication_rule', ruleId, {
    name: currentRule.name,
    changes: Object.keys(updates)
  })
  
  return { success: true, rule: data }
}

/**
 * Delete a deduplication rule
 */
export async function deleteDeduplicationRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get rule info for logging
  const { data: rule } = await supabase
    .from('deduplication_rules')
    .select('workspace_id, name')
    .eq('id', ruleId)
    .single()
  
  if (!rule) {
    return { success: false, error: 'Rule not found' }
  }
  
  const { error } = await supabase
    .from('deduplication_rules')
    .delete()
    .eq('id', ruleId)
  
  if (error) {
    console.error('Error deleting deduplication rule:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(rule.workspace_id, 'deduplication_rule_deleted', 'deduplication_rule', ruleId, {
    name: rule.name
  })
  
  return { success: true }
}

/**
 * Run deduplication process for a workspace
 */
export async function runDeduplication(
  workspaceId: string,
  ruleId?: string
): Promise<{ success: boolean; stats?: DeduplicationStats; conflicts?: ProductConflict[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get active deduplication rules
  let rules: DeduplicationRule[]
  if (ruleId) {
    const { data: rule } = await supabase
      .from('deduplication_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .single()
    
    rules = rule ? [rule] : []
  } else {
    rules = await getDeduplicationRules(workspaceId)
    rules = rules.filter(rule => rule.is_active)
  }
  
  // Get all mapped products for the workspace
  const { data: mappedProducts, error: productsError } = await supabase
    .from('products_mapped')
    .select(`
      *,
      suppliers (
        id,
        name
      )
    `)
    .eq('workspace_id', workspaceId)
  
  if (productsError) {
    console.error('Error fetching mapped products:', productsError)
    return { success: false, error: productsError.message }
  }
  
  if (!mappedProducts || mappedProducts.length === 0) {
    console.log('⚠️ No mapped products found')
    return { success: true, stats: { total_products: 0, unique_products: 0, conflicts_resolved: 0, duplicates_removed: 0, coverage_percentage: 0 }, conflicts: [] }
  }
  
  // If no deduplication rules, just copy all products to final (no deduplication)
  if (rules.length === 0) {
    console.log('⚠️ No deduplication rules found, copying all products to final without deduplication')
    
    // Clear existing final products
    await supabase
      .from('products_final')
      .delete()
      .eq('workspace_id', workspaceId)
    
    // Copy all mapped products to final
    const finalProductData = mappedProducts.map(product => ({
      workspace_id: workspaceId,
      uid: product.uid, // Use the product's UID directly
      title: product.fields.title || 'Unknown Product',
      description: product.fields.description,
      sku: product.fields.sku,
      ean: product.fields.ean,
      price: product.fields.price,
      currency: product.fields.currency,
      quantity: product.fields.quantity || 0,
      in_stock: (product.fields.quantity || 0) > 0,
      category_id: null, // Will be set by category mapping
      brand: product.fields.brand,
      image_url: product.fields.image_url,
      images: product.fields.images || [],
      attributes: product.fields.attributes || {},
      winning_supplier_id: product.supplier_id,
      winning_reason: 'no_deduplication',
      other_suppliers: []
    }))
    
    const { error: insertError } = await supabase
      .from('products_final')
      .insert(finalProductData)
    
    if (insertError) {
      console.error('Error inserting final products:', insertError)
      return { success: false, error: insertError.message }
    }
    
    const stats: DeduplicationStats = {
      total_products: mappedProducts.length,
      unique_products: mappedProducts.length,
      conflicts_resolved: 0,
      duplicates_removed: 0,
      coverage_percentage: 100
    }
    
    return { success: true, stats, conflicts: [] }
  }
  
  // Group products by match key (when rules exist)
  const productGroups = new Map<string, any[]>()
  const conflicts: ProductConflict[] = []
  
  for (const product of mappedProducts) {
    const matchValue = getMatchValue(product, rules[0].match_key)
    if (!matchValue) continue
    
    if (!productGroups.has(matchValue)) {
      productGroups.set(matchValue, [])
    }
    productGroups.get(matchValue)!.push(product)
  }
  
  // Process each group
  const finalProducts: any[] = []
  let conflictsResolved = 0
  let duplicatesRemoved = 0
  
  for (const [matchValue, products] of productGroups) {
    if (products.length === 1) {
      // No conflict, add directly
      finalProducts.push(products[0])
    } else {
      // Conflict detected, apply selection rules
      const winner = selectWinningProduct(products, rules[0])
      finalProducts.push(winner.product)
      
      // Record conflict details
      conflicts.push({
        uid: matchValue,
        products: products.map(p => ({
          supplier_id: p.supplier_id,
          supplier_name: p.suppliers.name,
          title: p.fields.title || 'Unknown',
          price: p.fields.price || 0,
          currency: p.fields.currency || 'USD',
          quantity: p.fields.quantity || 0,
          in_stock: p.fields.quantity > 0,
          category: p.fields.category || '',
          brand: p.fields.brand || '',
          image_url: p.fields.image_url || '',
          raw_data: p.fields
        })),
        winning_supplier_id: winner.product.supplier_id,
        winning_reason: winner.reason,
        conflict_details: winner.details
      })
      
      conflictsResolved++
      duplicatesRemoved += products.length - 1
    }
  }
  
  // Clear existing final products
  await supabase
    .from('products_final')
    .delete()
    .eq('workspace_id', workspaceId)
  
  // Insert final products
  const finalProductData = finalProducts.map(product => ({
    workspace_id: workspaceId,
    uid: getMatchValue(product, rules[0].match_key),
    title: product.fields.title || 'Unknown Product',
    description: product.fields.description,
    sku: product.fields.sku,
    ean: product.fields.ean,
    price: product.fields.price,
    currency: product.fields.currency,
    quantity: product.fields.quantity || 0,
    in_stock: (product.fields.quantity || 0) > 0,
    category_id: null, // Will be set by category mapping
    brand: product.fields.brand,
    image_url: product.fields.image_url,
    images: product.fields.images || [],
    attributes: product.fields.attributes || {},
    winning_supplier_id: product.supplier_id,
    winning_reason: 'deduplication_rule',
    other_suppliers: []
  }))
  
  const { error: insertError } = await supabase
    .from('products_final')
    .insert(finalProductData)
  
  if (insertError) {
    console.error('Error inserting final products:', insertError)
    return { success: false, error: insertError.message }
  }
  
  const stats: DeduplicationStats = {
    total_products: mappedProducts.length,
    unique_products: finalProducts.length,
    conflicts_resolved: conflictsResolved,
    duplicates_removed: duplicatesRemoved,
    coverage_percentage: Math.round((finalProducts.length / mappedProducts.length) * 100)
  }
  
  // Log activity
  await logActivity(workspaceId, 'deduplication_completed', 'deduplication_rule', rules[0].id, {
    stats
  })
  
  return { success: true, stats, conflicts }
}

/**
 * Get match value for a product based on match key
 */
function getMatchValue(product: any, matchKey: MatchKey): string | null {
  const fields = product.fields || {}
  
  switch (matchKey) {
    case 'ean':
      return fields.ean || null
    case 'sku':
      return fields.sku || null
    case 'title':
      return fields.title || null
    default:
      return null
  }
}

/**
 * Select winning product from a group of conflicting products
 */
function selectWinningProduct(
  products: any[],
  rule: DeduplicationRule
): { product: any; reason: string; details: string } {
  const { selection_policy, preferred_suppliers, exclusion_rules } = rule
  
  // Apply exclusion rules first
  const filteredProducts = products.filter(product => {
    const fields = product.fields || {}
    
    // Price exclusions
    if (exclusion_rules.min_price && fields.price < exclusion_rules.min_price) {
      return false
    }
    if (exclusion_rules.max_price && fields.price > exclusion_rules.max_price) {
      return false
    }
    
    // Stock exclusions
    if (exclusion_rules.exclude_out_of_stock && (fields.quantity || 0) <= 0) {
      return false
    }
    
    // Category exclusions
    if (exclusion_rules.category_blacklist && exclusion_rules.category_blacklist.length > 0) {
      const category = (fields.category || '').toLowerCase()
      if (exclusion_rules.category_blacklist.some((blacklisted: string) => 
        category.includes(blacklisted.toLowerCase())
      )) {
        return false
      }
    }
    
    // Keyword exclusions
    if (exclusion_rules.keyword_blacklist && exclusion_rules.keyword_blacklist.length > 0) {
      const title = (fields.title || '').toLowerCase()
      if (exclusion_rules.keyword_blacklist.some((keyword: string) => 
        title.includes(keyword.toLowerCase())
      )) {
        return false
      }
    }
    
    return true
  })
  
  if (filteredProducts.length === 0) {
    // All products excluded, return first original product
    return {
      product: products[0],
      reason: 'all_excluded',
      details: 'All products were excluded by rules'
    }
  }
  
  // Apply selection policy
  switch (selection_policy) {
    case 'lowest_price':
      const lowestPriceProduct = filteredProducts.reduce((min, current) => {
        const minPrice = min.fields?.price || Infinity
        const currentPrice = current.fields?.price || Infinity
        return currentPrice < minPrice ? current : min
      })
      return {
        product: lowestPriceProduct,
        reason: 'lowest_price',
        details: `Selected product with lowest price: ${lowestPriceProduct.fields?.price}`
      }
    
    case 'preferred_supplier':
      for (const supplierId of preferred_suppliers) {
        const preferredProduct = filteredProducts.find(p => p.supplier_id === supplierId)
        if (preferredProduct) {
          return {
            product: preferredProduct,
            reason: 'preferred_supplier',
            details: `Selected from preferred supplier: ${preferredProduct.suppliers?.name}`
          }
        }
      }
      // Fall back to first available
      return {
        product: filteredProducts[0],
        reason: 'preferred_supplier_fallback',
        details: 'Preferred supplier not available, selected first available'
      }
    
    case 'highest_stock':
      const highestStockProduct = filteredProducts.reduce((max, current) => {
        const maxStock = max.fields?.quantity || 0
        const currentStock = current.fields?.quantity || 0
        return currentStock > maxStock ? current : max
      })
      return {
        product: highestStockProduct,
        reason: 'highest_stock',
        details: `Selected product with highest stock: ${highestStockProduct.fields?.quantity}`
      }
    
    case 'first_available':
    default:
      return {
        product: filteredProducts[0],
        reason: 'first_available',
        details: 'Selected first available product'
      }
  }
}

/**
 * Get deduplication statistics
 */
export async function getDeduplicationStats(workspaceId: string): Promise<DeduplicationStats> {
  const supabase = await createSupabaseServerClient()
  
  // Get total mapped products
  const { count: totalMapped } = await supabase
    .from('products_mapped')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  // Get final products
  const { count: finalProducts } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  const total = totalMapped || 0
  const unique = finalProducts || 0
  const duplicates = total - unique
  const coverage = total > 0 ? Math.round((unique / total) * 100) : 0
  
  return {
    total_products: total,
    unique_products: unique,
    conflicts_resolved: 0, // Would need to track this separately
    duplicates_removed: duplicates,
    coverage_percentage: coverage
  }
}

/**
 * Get product conflicts for a workspace
 */
export async function getProductConflicts(
  workspaceId: string,
  limit: number = 50
): Promise<ProductConflict[]> {
  const supabase = await createSupabaseServerClient()
  
  // This would require a more complex query to find actual conflicts
  // For now, return empty array as conflicts are resolved during deduplication
  return []
}
