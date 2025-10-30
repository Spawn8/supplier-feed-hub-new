'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useWorkspace } from '@/lib/workspaceContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import CategoryMappingInterface from '@/components/CategoryMappingInterface'
import CategoryTreeView from '@/components/CategoryTreeView'
import CategoryTreeEditor from '@/components/CategoryTreeEditor'
import CategoriesPageSkeleton from '@/components/ui/CategoriesPageSkeleton'

type Category = {
  id: string
  name: string
  path: string
  parent_id?: string
  sort_order: number
  created_at: string
}

type CategoryMapping = {
  id?: string
  supplier_id?: string
  supplier_category: string
  workspace_category_id?: string
  custom_categories?: {
    id: string
    name: string
    path: string
  }
}

type Supplier = {
  id: string
  name: string
  source_type: string
}

export default function CategoriesPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [mappings, setMappings] = useState<CategoryMapping[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [showMappingInterface, setShowMappingInterface] = useState(false)
  const [selectedSupplierForMapping, setSelectedSupplierForMapping] = useState<Supplier | null>(null)
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState({
    name: '',
    parent_id: '',
    sort_order: 0
  })
  const [pendingCategories, setPendingCategories] = useState<Category[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const hasInitializedExpandedState = useRef(false)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (activeWorkspaceId) {
      setLoading(true)
      Promise.all([
        fetchCategories(),
        fetchSuppliers(),
        fetchMappings()
      ]).finally(() => {
        setLoading(false)
      })
    }
  }, [activeWorkspaceId])

  // Persist expanded state to sessionStorage
  useEffect(() => {
    if (expandedCategories.size > 0 && hasInitializedExpandedState.current) {
      try {
        const arr = Array.from(expandedCategories)
        sessionStorage.setItem('categories_expanded_state', JSON.stringify(arr))
      } catch {}
    }
  }, [expandedCategories])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load categories')
      const fetchedCategories = data.categories || []
      setCategories(fetchedCategories)
      setPendingCategories(fetchedCategories)
      setHasUnsavedChanges(false)
      
      // Initialize expanded state from sessionStorage or default to all expanded
      if (!hasInitializedExpandedState.current) {
        try {
          const saved = typeof window !== 'undefined' ? sessionStorage.getItem('categories_expanded_state') : null
          if (saved) {
            const parsed: string[] = JSON.parse(saved)
            setExpandedCategories(new Set(parsed))
          } else {
            // Default: expand all categories with children
            const allCategoryIds = fetchedCategories
              .filter(cat => cat.parent_id === null) // Only root categories
              .map(cat => cat.id)
            setExpandedCategories(new Set(allCategoryIds))
          }
          hasInitializedExpandedState.current = true
        } catch {
          // Fallback: expand all root categories
          const allCategoryIds = fetchedCategories
            .filter(cat => cat.parent_id === null)
            .map(cat => cat.id)
          setExpandedCategories(new Set(allCategoryIds))
          hasInitializedExpandedState.current = true
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load categories')
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to load suppliers:', data.error)
        setSuppliers([])
        return
      }
      setSuppliers(data.suppliers || [])
    } catch (e: any) {
      console.error('Failed to load suppliers:', e)
      setSuppliers([])
    }
  }

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/categories/mappings')
      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to load mappings:', data.error)
        setMappings([])
        return
      }
      setMappings(data.mappings || [])
    } catch (e: any) {
      console.error('Failed to load mappings:', e)
      setMappings([])
    }
  }

  const fetchSourceFields = async (supplierId: string) => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/sample-keys?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      
      if (response.ok && data.keys && Array.isArray(data.keys)) {
        setSourceFields(data.keys)
      } else {
        setSourceFields([])
      }
    } catch (err) {
      console.error('Error fetching source fields:', err)
      setSourceFields([])
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const generatedPath = generateCategoryPath(newCategory.name, newCategory.parent_id || null, pendingCategories)
      const categoryData = {
        ...newCategory,
        path: generatedPath
      }
      
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create category')
      
      // Update both categories and pending categories
      const newCategories = [...categories, data.category]
      const newPendingCategories = [...pendingCategories, data.category]
      setCategories(newCategories)
      setPendingCategories(newPendingCategories)
      setShowCreateModal(false)
      setNewCategory({ name: '', parent_id: '', sort_order: 0 })
    } catch (e: any) {
      setError(e.message || 'Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return
    
    try {
      setLoading(true)
      const generatedPath = generateCategoryPath(newCategory.name, newCategory.parent_id || null, pendingCategories)
      const categoryData = {
        ...newCategory,
        path: generatedPath
      }
      
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update category')
      
      // Update both categories and pending categories
      const newCategories = categories.map(c => c.id === editingCategory.id ? data.category : c)
      const newPendingCategories = pendingCategories.map(c => c.id === editingCategory.id ? data.category : c)
      setCategories(newCategories)
      setPendingCategories(newPendingCategories)
      setEditingCategory(null)
      setNewCategory({ name: '', parent_id: '', sort_order: 0 })
    } catch (e: any) {
      setError(e.message || 'Failed to update category')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    
    try {
      setLoading(true)
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete category')
      }
      
      // Update both categories and pending categories
      const newCategories = categories.filter(c => c.id !== id)
      const newPendingCategories = pendingCategories.filter(c => c.id !== id)
      setCategories(newCategories)
      setPendingCategories(newPendingCategories)
    } catch (e: any) {
      setError(e.message || 'Failed to delete category')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMapping = async (supplierCategory: string, workspaceCategoryId: string) => {
    if (!selectedSupplier) return
    
    try {
      setLoading(true)
      const res = await fetch('/api/categories/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplier,
          supplier_category: supplierCategory,
          workspace_category_id: workspaceCategoryId
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create mapping')
      
      setMappings([...mappings, data.mapping])
    } catch (e: any) {
      setError(e.message || 'Failed to create mapping')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to flatten tree structure back to flat array
  const flattenCategoryTree = (tree: any[]): Category[] => {
    const result: Category[] = []
    
    const flatten = (nodes: any[]) => {
      nodes.forEach(node => {
        result.push({
          id: node.id,
          name: node.name,
          path: node.path,
          parent_id: node.parent_id,
          sort_order: node.sort_order,
          created_at: node.created_at
        })
        if (node.children && node.children.length > 0) {
          flatten(node.children)
        }
      })
    }
    
    flatten(tree)
    return result
  }

  const handleReorderCategories = (reorderedCategories: any[]) => {
    // Flatten the tree structure back to flat array for pendingCategories
    const flattenedCategories = flattenCategoryTree(reorderedCategories)
    setPendingCategories(flattenedCategories)
    setHasUnsavedChanges(true)
  }

  const handleSaveOrder = async () => {
    if (!hasUnsavedChanges) return
    
    setIsSaving(true)
    try {
      const res = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: pendingCategories })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save category order')
      }

      // Update the main categories state and clear pending changes
      setCategories(pendingCategories)
      setHasUnsavedChanges(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save category order')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelOrder = () => {
    // Revert pendingCategories back to the original categories
    setPendingCategories(categories)
    setHasUnsavedChanges(false)
  }

  const handleMoveCategory = async (categoryId: string, newParentId: string) => {
    try {
      const res = await fetch('/api/categories/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcategoryId: categoryId,
          newParentId
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to move category')
      }

      // Refresh categories to get the updated structure
      await fetchCategories()
    } catch (e: any) {
      setError(e.message || 'Failed to move category')
      throw e // Re-throw so the component can handle the error
    }
  }

  const generateCategoryPath = (categoryName: string, parentId: string | null, categories: Category[]): string => {
    if (!parentId) {
      return categoryName
    }
    
    const parent = categories.find(cat => cat.id === parentId)
    if (!parent) {
      return categoryName
    }
    
    return `${parent.path} > ${categoryName}`
  }

  const renderHierarchicalOptions = (categories: Category[], excludeId?: string) => {
    const renderCategory = (category: Category, depth: number = 0): React.ReactNode => {
      const indent = '— '.repeat(depth)
      
      return (
        <React.Fragment key={category.id}>
          <option value={category.id}>
            {indent}{category.name}
          </option>
          {categories
            .filter(cat => cat.parent_id === category.id && cat.id !== excludeId)
            .map(child => renderCategory(child, depth + 1))
          }
        </React.Fragment>
      )
    }
    
    return categories
      .filter(cat => !cat.parent_id && cat.id !== excludeId)
      .map(category => renderCategory(category))
  }

  const buildCategoryTree = (categories: Category[]) => {
    const tree: any[] = []
    const map = new Map<string, any>()
    
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] })
    })
    
    categories.forEach(cat => {
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(map.get(cat.id)!)
      } else {
        tree.push(map.get(cat.id)!)
      }
    })
    
    return tree
  }

  const renderCategoryTree = (tree: any[], level = 0) => {
    return tree.map(category => (
      <div key={category.id} className="ml-4">
        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg mb-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div>
              <h3 className="font-medium text-gray-900">{category.name}</h3>
              <p className="text-sm text-gray-500">{category.path}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingCategory(category)
                setNewCategory({
                  name: category.name,
                  parent_id: category.parent_id || '',
                  sort_order: category.sort_order
                })
              }}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        </div>
        {category.children.length > 0 && renderCategoryTree(category.children, level + 1)}
      </div>
    ))
  }

  const categoryTree = buildCategoryTree(pendingCategories as Category[])

  if (loading) {
    return <CategoriesPageSkeleton />
  }

  return (
    <div className="categories-page min-h-screen bg-gray-50">
      <div className="categories-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="categories-header mb-8">
          <div className="categories-header-content flex items-center justify-between">
            <div className="categories-header-info">
              <h1 className="categories-title text-3xl font-bold text-gray-900">Categories</h1>
              <p className="categories-subtitle text-gray-600 mt-2">
                Manage your custom categories and supplier mappings
              </p>
            </div>
            <div className="flex gap-3">
              {isEditMode ? (
                <>
                  <Button
                    onClick={handleCancelOrder}
                    variant="outline"
                    disabled={!hasUnsavedChanges}
                    className="border-red-300 text-red-600 hover:bg-red-50 disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveOrder}
                    variant="primary"
                    disabled={!hasUnsavedChanges || isSaving}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:hover:bg-gray-400"
                  >
                    {isSaving ? 'Saving...' : 'Save Order'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setShowMappingModal(true)}
                    variant="outline"
                    disabled={suppliers.length === 0}
                  >
                    Map Categories
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)} variant="primary">
                    Add Category
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Categories Content */}
        <div className="categories-content mt-8">
          {categories.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">Custom Categories</h3>
                  {isEditMode && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                      Edit Mode
                    </div>
                  )}
                  {isEditMode && hasUnsavedChanges && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Unsaved changes
                    </div>
                  )}
                </div>
                
                {/* Mode Toggle Switch */}
                <div className="flex items-center gap-3">
                  {/* Edit Order */}
                  <div className={`flex items-center gap-2 ${!isEditMode ? 'text-black' : 'text-blue-600'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-sm font-medium">Edit Order</span>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isEditMode}
                      onChange={() => setIsEditMode(!isEditMode)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>

                </div>
              </div>

              {/* Mode explanation and instructions - below toggle switch */}
              <div className="flex justify-end">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isEditMode ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                      <span>Drag to reorder categories</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Enable "Edit Order" to reorder categories</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories created yet</h3>
              <p className="text-gray-500 mb-4">Create your first category to start organizing your data</p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Your First Category
              </Button>
            </div>
          ) : (
            <>
              {isEditMode ? (
              <CategoryTreeEditor
                categories={categoryTree}
                onReorder={handleReorderCategories}
                onEdit={(category) => {
                  setEditingCategory(category)
                  setNewCategory({
                    name: category.name,
                    parent_id: category.parent_id || '',
                    sort_order: category.sort_order
                  })
                }}
                onDelete={handleDeleteCategory}
                onMoveCategory={handleMoveCategory}
              />
            ) : (
              <CategoryTreeView
                categories={categoryTree}
                expandedCategories={expandedCategories}
                onToggleExpanded={(categoryId) => {
                  const newExpanded = new Set(expandedCategories)
                  if (newExpanded.has(categoryId)) {
                    newExpanded.delete(categoryId)
                  } else {
                    newExpanded.add(categoryId)
                  }
                  setExpandedCategories(newExpanded)
                }}
                onEdit={(category) => {
                  setEditingCategory(category)
                  setNewCategory({
                    name: category.name,
                    parent_id: category.parent_id || '',
                    sort_order: category.sort_order
                  })
                }}
                onDelete={handleDeleteCategory}
              />
            )}
            </>
          )}
        </div>

      {/* Category Mappings */}
      {mappings.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Category Mappings</h3>
            <p className="text-sm text-gray-600">How supplier categories map to your workspace categories</p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {mappings.map(mapping => (
                <div key={mapping.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-900">{mapping.supplier_category}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm text-gray-600">
                      {mapping.custom_categories?.name || 'Unmapped'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {suppliers.find(s => s.id === mapping.supplier_id)?.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewCategory({ name: '', parent_id: '', sort_order: 0 })
        }}
        title="Create Category"
        footer={<></>}
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Electronics"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
            <select
              value={newCategory.parent_id}
              onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No parent (root category)</option>
              {renderHierarchicalOptions(categories)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} variant="primary">
              {loading ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => {
          setEditingCategory(null)
          setNewCategory({ name: '', parent_id: '', sort_order: 0 })
        }}
        title="Edit Category"
        footer={<></>}
      >
        <form onSubmit={handleUpdateCategory} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
            <select
              value={newCategory.parent_id}
              onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No parent (root category)</option>
              {renderHierarchicalOptions(categories, editingCategory?.id)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingCategory(null)
                setNewCategory({ name: '', parent_id: '', sort_order: 0 })
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} variant="primary">
              {loading ? 'Updating...' : 'Update Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Mapping Modal */}
      <Modal
        isOpen={showMappingModal}
        onClose={() => {
          setShowMappingModal(false)
          setSelectedSupplier('')
        }}
        title="Map Categories"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          
          {selectedSupplier && (
            <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Click "Open Mapping Interface" to map supplier categories to your custom categories.
            </p>
              <Button
                onClick={async () => {
                  const supplier = suppliers.find(s => s.id === selectedSupplier)
                  if (supplier) {
                    setSelectedSupplierForMapping(supplier)
                    await fetchSourceFields(supplier.id)
                    setShowMappingInterface(true)
                    setShowMappingModal(false)
                  }
                }}
                className="w-full"
              >
                Open Mapping Interface
              </Button>
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowMappingModal(false)
                setSelectedSupplier('')
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enhanced Category Mapping Interface */}
      {showMappingInterface && selectedSupplierForMapping && (
        <CategoryMappingInterface
          supplierId={selectedSupplierForMapping.id}
          supplierName={selectedSupplierForMapping.name}
          sourceFields={sourceFields}
          onClose={() => {
            setShowMappingInterface(false)
            setSelectedSupplierForMapping(null)
            fetchMappings() // Refresh mappings
          }}
          onMappingCreated={(mapping) => {
            setMappings([...mappings, mapping])
          }}
        />
      )}
      </div>
    </div>
  )
}
