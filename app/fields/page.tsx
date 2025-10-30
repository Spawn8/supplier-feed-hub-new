'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import FieldsList from '@/components/FieldsList'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import FieldFormModal from '@/components/FieldFormModal'
import FieldsPageSkeleton from '@/components/ui/FieldsPageSkeleton'
import { useWorkspace } from '@/lib/workspaceContext'

interface CustomField {
  id: string
  name: string
  key: string
  datatype: string
  description?: string
  is_required: boolean
  is_unique: boolean
  is_visible: boolean
  use_for_category_mapping?: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export default function FieldsPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [fields, setFields] = useState<CustomField[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    checkUser()
  }, [])

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchFields()
      fetchSuppliers()
    }
  }, [activeWorkspaceId])

  const checkUser = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
      await fetchFields()
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchFields = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setFields(data.fields || [])
      } else {
        console.error('Failed to fetch fields:', response.statusText)
        setFields([])
      }
    } catch (error) {
      console.error('Error fetching fields:', error)
      setFields([])
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
      setSuppliers((data.suppliers || []).map((s: any) => ({ id: s.id, name: s.name })))
    } catch (e: any) {
      console.error('Failed to load suppliers:', e)
      setSuppliers([])
    }
  }

  const handleFieldCreated = (field: CustomField) => {
    setFields(prev => [...prev, field])
    setShowCreateModal(false)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <FieldsPageSkeleton />
  }

  if (loading) {
    return <FieldsPageSkeleton />
  }

  if (!user) {
    return null
  }

  return (
    <div className="fields-page min-h-screen bg-gray-50">
      <div className="fields-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fields-header mb-8">
          <div className="fields-header-content flex items-center justify-between">
            <div className="fields-header-info">
              <h1 className="fields-title text-3xl font-bold text-gray-900">Custom Fields</h1>
              <p className="fields-subtitle text-gray-600 mt-2">
                Define the fields that will be used across all your suppliers and exports.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowMappingModal(true)}
              >
                Map Fields
              </Button>
              <Button 
                onClick={() => setShowCreateModal(true)}
                variant="primary"
              >
                Add Field
              </Button>
            </div>
          </div>
        </div>

        {/* Fields List */}
        <div className="fields-content mt-8">
          {fields.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Custom Fields</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <span>Drag to reorder</span>
                </div>
              </div>
            </div>
          )}
          <FieldsList 
            fields={fields} 
            onFieldUpdated={fetchFields}
            onCreateField={() => setShowCreateModal(true)}
          />
        </div>

        {/* Create Field Modal */}
        <FieldFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleFieldCreated}
        />

        {/* Field Mapping Modal */}
        <Modal
          isOpen={showMappingModal}
          onClose={() => {
            setShowMappingModal(false)
            setSelectedSupplier('')
          }}
          title="Map Fields"
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
                  Click "Open Mapping Interface" to map supplier fields to your custom fields.
                </p>
                <Button
                  onClick={() => {
                    router.push(`/suppliers/${selectedSupplier}/map`)
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
      </div>
    </div>
  )
}