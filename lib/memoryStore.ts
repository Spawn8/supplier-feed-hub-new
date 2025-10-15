// Centralized in-memory store for temporary data (workaround for RLS issues)

// Use globalThis to ensure singleton across all API routes
declare global {
  var __suppliersStore: Map<string, any> | undefined
}

// Suppliers store - singleton pattern
export const suppliersStore = globalThis.__suppliersStore ?? new Map<string, any>()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__suppliersStore = suppliersStore
}

// Helper functions
export const storeSupplier = (supplier: any) => {
  suppliersStore.set(supplier.id, supplier)
  console.log('✅ Stored supplier in centralized memory:', supplier.id)
  console.log('📊 Total suppliers in memory:', suppliersStore.size)
  console.log('🔍 Store instance ID:', suppliersStore === globalThis.__suppliersStore ? 'GLOBAL' : 'LOCAL')
  console.log('🗂️ All supplier IDs in store:', Array.from(suppliersStore.keys()))
}

export const getSupplier = (supplierId: string) => {
  console.log('🔍 Getting supplier from store instance:', suppliersStore === globalThis.__suppliersStore ? 'GLOBAL' : 'LOCAL')
  const supplier = suppliersStore.get(supplierId)
  if (supplier) {
    console.log('✅ Found supplier in centralized memory:', supplierId)
  } else {
    console.log('❌ Supplier not found in centralized memory:', supplierId)
    console.log('🗂️ Available supplier IDs:', Array.from(suppliersStore.keys()))
    console.log('📊 Store size:', suppliersStore.size)
  }
  return supplier
}

export const hasSupplier = (supplierId: string) => {
  return suppliersStore.has(supplierId)
}

export const getAllSuppliers = () => {
  return Array.from(suppliersStore.values())
}

export const getStoreSize = () => {
  console.log('📊 Getting store size from instance:', suppliersStore === globalThis.__suppliersStore ? 'GLOBAL' : 'LOCAL')
  return suppliersStore.size
}
