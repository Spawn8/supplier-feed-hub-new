// lib/billing.ts
import { createSupabaseServerClient } from './supabaseServer'
import { logActivity } from './auth'

export type BillingPlan = 'free' | 'pro' | 'business'
export type BillingStatus = 'active' | 'cancelled' | 'past_due' | 'unpaid'

export interface BillingPlanInfo {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly?: number
  limits: {
    workspaces: number
    suppliers: number
    products: number
    exports: number
    scheduling: boolean
  }
  features: string[]
  is_active: boolean
}

export interface WorkspaceSubscription {
  id: string
  workspace_id: string
  plan_id: string
  status: BillingStatus
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface UsageMetrics {
  workspaces: number
  suppliers: number
  products: number
  exports_this_month: number
  storage_used_mb: number
}

export interface BillingLimits {
  workspaces: { used: number; limit: number; exceeded: boolean }
  suppliers: { used: number; limit: number; exceeded: boolean }
  products: { used: number; limit: number; exceeded: boolean }
  exports: { used: number; limit: number; exceeded: boolean }
  scheduling: { allowed: boolean; reason?: string }
}

/**
 * Get all available billing plans
 */
export async function getBillingPlans(): Promise<BillingPlanInfo[]> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true })
  
  if (error) {
    console.error('Error fetching billing plans:', error)
    return []
  }
  
  return data || []
}

/**
 * Get workspace subscription
 */
export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('workspace_subscriptions')
    .select(`
      *,
      billing_plans (
        id,
        name,
        description,
        price_monthly,
        price_yearly,
        limits,
        features
      )
    `)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error) {
    console.error('Error fetching workspace subscription:', error)
    return null
  }
  
  return data
}

/**
 * Get workspace usage metrics
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<UsageMetrics> {
  const supabase = await createSupabaseServerClient()
  
  // Get workspace count (should be 1 for single workspace)
  const { count: workspaces } = await supabase
    .from('workspaces')
    .select('*', { count: 'exact', head: true })
    .eq('id', workspaceId)
  
  // Get supplier count
  const { count: suppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  // Get product count
  const { count: products } = await supabase
    .from('products_final')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  
  // Get exports this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { count: exportsThisMonth } = await supabase
    .from('export_history')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', startOfMonth.toISOString())
  
  // Get storage usage (approximate)
  const { data: files } = await supabase
    .from('supplier_files')
    .select('file_size')
    .eq('supplier_id', workspaceId) // This would need to be adjusted based on actual schema
  
  const storageUsed = files?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0
  const storageUsedMB = Math.round(storageUsed / (1024 * 1024))
  
  return {
    workspaces: workspaces || 0,
    suppliers: suppliers || 0,
    products: products || 0,
    exports_this_month: exportsThisMonth || 0,
    storage_used_mb: storageUsedMB
  }
}

/**
 * Check if workspace has exceeded limits
 */
export async function checkWorkspaceLimits(workspaceId: string): Promise<BillingLimits> {
  const subscription = await getWorkspaceSubscription(workspaceId)
  const usage = await getWorkspaceUsage(workspaceId)
  
  if (!subscription) {
    // Free plan limits
    return {
      workspaces: { used: usage.workspaces, limit: 1, exceeded: usage.workspaces > 1 },
      suppliers: { used: usage.suppliers, limit: 1, exceeded: usage.suppliers > 1 },
      products: { used: usage.products, limit: 1000, exceeded: usage.products > 1000 },
      exports: { used: usage.exports_this_month, limit: 5, exceeded: usage.exports_this_month > 5 },
      scheduling: { allowed: false, reason: 'Scheduling requires Pro plan or higher' }
    }
  }
  
  const plan = subscription.billing_plans
  const limits = plan.limits
  
  return {
    workspaces: { 
      used: usage.workspaces, 
      limit: limits.workspaces, 
      exceeded: usage.workspaces > limits.workspaces 
    },
    suppliers: { 
      used: usage.suppliers, 
      limit: limits.suppliers, 
      exceeded: usage.suppliers > limits.suppliers 
    },
    products: { 
      used: usage.products, 
      limit: limits.products, 
      exceeded: usage.products > limits.products 
    },
    exports: { 
      used: usage.exports_this_month, 
      limit: limits.exports, 
      exceeded: usage.exports_this_month > limits.exports 
    },
    scheduling: { 
      allowed: limits.scheduling, 
      reason: limits.scheduling ? undefined : 'Scheduling requires Pro plan or higher' 
    }
  }
}

/**
 * Create workspace subscription
 */
export async function createWorkspaceSubscription(
  workspaceId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; subscription?: WorkspaceSubscription; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  // Get plan details
  const { data: plan } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('id', planId)
    .single()
  
  if (!plan) {
    return { success: false, error: 'Billing plan not found' }
  }
  
  // Calculate period dates
  const now = new Date()
  const periodEnd = new Date(now)
  if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }
  
  // Cancel existing subscription if any
  await supabase
    .from('workspace_subscriptions')
    .update({ status: 'cancelled' })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  
  // Create new subscription
  const { data, error } = await supabase
    .from('workspace_subscriptions')
    .insert({
      workspace_id: workspaceId,
      plan_id: planId,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating workspace subscription:', error)
    return { success: false, error: error.message }
  }
  
  // Update workspace billing status
  await supabase
    .from('workspaces')
    .update({ 
      billing_plan: plan.name.toLowerCase(),
      billing_status: 'active'
    })
    .eq('id', workspaceId)
  
  // Log activity
  await logActivity(workspaceId, 'subscription_created', 'workspace_subscription', data.id, {
    plan_name: plan.name,
    billing_cycle: billingCycle
  })
  
  return { success: true, subscription: data }
}

/**
 * Cancel workspace subscription
 */
export async function cancelWorkspaceSubscription(
  workspaceId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  const { error } = await supabase
    .from('workspace_subscriptions')
    .update({
      cancel_at_period_end: cancelAtPeriodEnd,
      status: cancelAtPeriodEnd ? 'active' : 'cancelled'
    })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  
  if (error) {
    console.error('Error cancelling workspace subscription:', error)
    return { success: false, error: error.message }
  }
  
  // Log activity
  await logActivity(workspaceId, 'subscription_cancelled', 'workspace_subscription', workspaceId, {
    cancel_at_period_end: cancelAtPeriodEnd
  })
  
  return { success: true }
}

/**
 * Update subscription status (for webhook handling)
 */
export async function updateSubscriptionStatus(
  workspaceId: string,
  status: BillingStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  
  const { error } = await supabase
    .from('workspace_subscriptions')
    .update({ status })
    .eq('workspace_id', workspaceId)
  
  if (error) {
    console.error('Error updating subscription status:', error)
    return { success: false, error: error.message }
  }
  
  // Update workspace billing status
  await supabase
    .from('workspaces')
    .update({ billing_status: status })
    .eq('id', workspaceId)
  
  return { success: true }
}

/**
 * Check if feature is available for workspace
 */
export async function isFeatureAvailable(
  workspaceId: string,
  feature: string
): Promise<{ available: boolean; reason?: string }> {
  const subscription = await getWorkspaceSubscription(workspaceId)
  
  if (!subscription) {
    // Free plan features
    const freeFeatures = ['basic_mapping', 'csv_export', 'email_support']
    return {
      available: freeFeatures.includes(feature),
      reason: freeFeatures.includes(feature) ? undefined : 'Feature requires paid plan'
    }
  }
  
  const plan = subscription.billing_plans
  const features = plan.features || []
  
  return {
    available: features.includes(feature),
    reason: features.includes(feature) ? undefined : 'Feature not included in current plan'
  }
}

/**
 * Get upgrade recommendations
 */
export async function getUpgradeRecommendations(workspaceId: string): Promise<{
  current_plan: string
  recommended_plan: string
  reasons: string[]
  benefits: string[]
}> {
  const subscription = await getWorkspaceSubscription(workspaceId)
  const limits = await checkWorkspaceLimits(workspaceId)
  
  const currentPlan = subscription?.billing_plans?.name || 'Free'
  const reasons: string[] = []
  const benefits: string[] = []
  
  // Check for limit violations
  if (limits.suppliers.exceeded) {
    reasons.push(`You have ${limits.suppliers.used} suppliers but your plan allows only ${limits.suppliers.limit}`)
    benefits.push('Add unlimited suppliers')
  }
  
  if (limits.products.exceeded) {
    reasons.push(`You have ${limits.products.used} products but your plan allows only ${limits.products.limit}`)
    benefits.push('Process unlimited products')
  }
  
  if (limits.exports.exceeded) {
    reasons.push(`You've generated ${limits.exports.used} exports this month but your plan allows only ${limits.exports.limit}`)
    benefits.push('Generate unlimited exports')
  }
  
  if (!limits.scheduling.allowed) {
    reasons.push('Scheduling is not available on your current plan')
    benefits.push('Schedule automatic feed updates')
  }
  
  // Determine recommended plan
  let recommendedPlan = 'Pro'
  if (limits.suppliers.used > 10 || limits.products.used > 50000) {
    recommendedPlan = 'Business'
  }
  
  // Add plan-specific benefits
  if (recommendedPlan === 'Pro') {
    benefits.push('Advanced field mapping', 'All export formats', 'Priority support')
  } else if (recommendedPlan === 'Business') {
    benefits.push('White-label options', 'API access', 'Custom integrations', 'Dedicated support')
  }
  
  return {
    current_plan: currentPlan,
    recommended_plan: recommendedPlan,
    reasons,
    benefits
  }
}

/**
 * Get billing history
 */
export async function getBillingHistory(workspaceId: string): Promise<any[]> {
  // In a real implementation, this would fetch from your payment processor
  // For now, return empty array
  return []
}

/**
 * Get invoice details
 */
export async function getInvoiceDetails(invoiceId: string): Promise<any | null> {
  // In a real implementation, this would fetch from your payment processor
  return null
}

/**
 * Create payment intent
 */
export async function createPaymentIntent(
  workspaceId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; client_secret?: string; error?: string }> {
  // In a real implementation, this would create a payment intent with Stripe
  // For now, return a mock response
  return {
    success: true,
    client_secret: 'pi_mock_' + Date.now()
  }
}

/**
 * Handle successful payment
 */
export async function handleSuccessfulPayment(
  workspaceId: string,
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  // In a real implementation, this would update the subscription status
  // For now, just return success
  return { success: true }
}

/**
 * Get workspace billing dashboard data
 */
export async function getBillingDashboard(workspaceId: string): Promise<{
  subscription: WorkspaceSubscription | null
  usage: UsageMetrics
  limits: BillingLimits
  recommendations: {
    current_plan: string
    recommended_plan: string
    reasons: string[]
    benefits: string[]
  }
  available_plans: BillingPlanInfo[]
}> {
  const [
    subscription,
    usage,
    limits,
    recommendations,
    availablePlans
  ] = await Promise.all([
    getWorkspaceSubscription(workspaceId),
    getWorkspaceUsage(workspaceId),
    checkWorkspaceLimits(workspaceId),
    getUpgradeRecommendations(workspaceId),
    getBillingPlans()
  ])
  
  return {
    subscription,
    usage,
    limits,
    recommendations,
    available_plans: availablePlans
  }
}
