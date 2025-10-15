'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'
import SupplierFormModal from './SupplierFormModal'
import SupplierDeleteButton from './SupplierDeleteButton'
import LastImportCell from './LastImportCell'
import ReRunButton from './ReRunButton'
import HoverTooltip from './ui/HoverTooltip'

interface Supplier {
  id: string
  name: string
  description?: string
  source_type: 'url' | 'upload'
  endpoint_url?: string
  schedule_cron?: string
  schedule_enabled: boolean
  last_sync_at?: string
  next_sync_at?: string
  status: 'draft' | 'active' | 'paused' | 'error'
  sync_status?: 'synced' | 'sync_needed' | 'syncing' | 'failed'
  error_message?: string
  creation_started_at?: string
  creation_completed_at: string
  created_at?: string
  updated_at: string
  uid?: string
}

export default function SuppliersList() {
  const { activeWorkspaceId } = useWorkspace()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  type NoticeType = 'success' | 'info' | 'warning' | 'error'
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null)
  const showNotice = (type: NoticeType, message: string, timeoutMs = 4000) => {
    setNotice({ type, message })
    window.clearTimeout((showNotice as any)._t)
    ;(showNotice as any)._t = window.setTimeout(() => setNotice(null), timeoutMs)
  }
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchSuppliers()
    }
  }, [activeWorkspaceId])

  const fetchSuppliers = async () => {
    if (!activeWorkspaceId) return
    
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch(`/api/suppliers?workspace_id=${activeWorkspaceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load suppliers')
      }

      // Sort suppliers by creation date (newest first)
      const sortedSuppliers = (data.suppliers || []).sort((a: Supplier, b: Supplier) => {
        const dateA = new Date(a.creation_completed_at || a.created_at || 0)
        const dateB = new Date(b.creation_completed_at || b.created_at || 0)
        return dateB.getTime() - dateA.getTime() // Descending order (newest first)
      })
      setSuppliers(sortedSuppliers)
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      setError('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuccess = (supplier: Supplier) => {
    setSuppliers(prev => {
      const updated = [...prev, supplier]
      // Re-sort to maintain oldest-first order
      return updated.sort((a, b) => {
        const dateA = new Date(a.creation_completed_at || a.created_at || 0)
        const dateB = new Date(b.creation_completed_at || b.created_at || 0)
        return dateA.getTime() - dateB.getTime()
      })
    })
    setShowForm(false)
    showNotice('success', `“${supplier.name}” was added successfully`)
  }

  const handleUpdateSuccess = (updatedSupplier: Supplier) => {
    setSuppliers(prev => 
      prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s)
    )
    setEditingSupplier(null)
    showNotice('success', `Changes to “${updatedSupplier.name}” were saved`)
  }

  const handleDeleteSuccess = (supplierId: string) => {
    let deletedName = ''
    setSuppliers(prev => {
      const del = prev.find(s => s.id === supplierId)
      deletedName = del?.name || 'Supplier'
      return prev.filter(s => s.id !== supplierId)
    })
    showNotice('info', `“${deletedName}” was deleted`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-gray-600 bg-gray-100'
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'paused':
        return 'text-yellow-600 bg-yellow-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatUrl = (url: string, maxStart: number = 20, maxEnd: number = 20) => {
    const totalLength = maxStart + maxEnd + 3 // +3 for "..."
    if (url.length <= totalLength) return url
    
    return `${url.substring(0, maxStart)}...${url.substring(url.length - maxEnd)}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'paused':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-6" suppressHydrationWarning={true}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchSuppliers}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" suppressHydrationWarning={true}>
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={
            `mb-4 rounded-lg px-4 py-3 shadow-sm border flex items-start gap-3 transition-all duration-300 ` +
            (notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : '') +
            (notice.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : '') +
            (notice.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : '') +
            (notice.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : '')
          }
        >
          <span className="mt-0.5">
            {notice.type === 'success' && (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            )}
            {notice.type === 'info' && (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9h2v6H9V9zm0-4h2v2H9V5z"/></svg>
            )}
            {notice.type === 'warning' && (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            )}
            {notice.type === 'error' && (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 10-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
            )}
          </span>
          <div className="flex-1 text-sm">
            {notice.message}
          </div>
          <button
            aria-label="Dismiss notice"
            onClick={() => setNotice(null)}
            className="ml-2 p-1 rounded hover:bg-black/5"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Suppliers</h2>
        <button
          onClick={() => window.location.href = '/suppliers/new'}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Supplier
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers yet</h3>
          <p className="text-gray-500 mb-4">Add your first supplier to start importing products</p>
          <button
            onClick={() => window.location.href = '/suppliers/new'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Supplier
          </button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="relative">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    Supplier & Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Last Import
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier, index) => (
                  <tr 
                    key={supplier.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                      {supplier.uid || 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center mb-3">
                          <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                          {supplier.sync_status === 'sync_needed' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              Sync Needed
                            </span>
                          )}
                          {supplier.sync_status === 'syncing' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              <svg className="w-3 h-3 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              Syncing...
                            </span>
                          )}
                          {supplier.sync_status === 'failed' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Sync Failed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 w-12 ${
                            supplier.source_type === 'url' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {supplier.source_type === 'url' ? 'URL' : 'FILE'}
                          </span>
                          {(supplier.endpoint_url || supplier.source_type === 'upload') && (
                            <div className="flex items-center">
                              {supplier.source_type === 'url' ? (
                                <>
                                  <HoverTooltip content={supplier.endpoint_url || ''} useFixed={true}>
                                    <span className="truncate cursor-help">
                                      {supplier.endpoint_url ? formatUrl(supplier.endpoint_url, 20, 20) : ''}
                                    </span>
                                  </HoverTooltip>
                                  <HoverTooltip content="Copy URL" useFixed={true}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (supplier.endpoint_url) {
                                          navigator.clipboard.writeText(supplier.endpoint_url)
                                        }
                                      }}
                                      className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </HoverTooltip>
                                </>
                              ) : (
                                <>
                                  <HoverTooltip content="Download uploaded file" useFixed={true}>
                                    <span className="truncate cursor-help">
                                      {(supplier as any).settings?.original_filename || 'Uploaded file'}
                                    </span>
                                  </HoverTooltip>
                                  <HoverTooltip content="Download file" useFixed={true}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Use secure download endpoint
                                        window.open(`/api/suppliers/${supplier.id}/download`, '_blank')
                                      }}
                                      className="ml-2 p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded cursor-pointer"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  </HoverTooltip>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {supplier.description && (
                          <div className="text-xs text-gray-400 mt-1 truncate">
                            {supplier.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {supplier.schedule_enabled ? (
                        <span className="text-green-600 font-medium">Scheduled</span>
                      ) : (
                        <span className="text-gray-500">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(supplier.status)}`}>
                        {getStatusIcon(supplier.status)}
                        <span className="ml-1 capitalize">{supplier.status}</span>
                      </span>
                      {supplier.error_message && (
                        <div className="text-xs text-red-600 mt-1 truncate" title={supplier.error_message}>
                          {supplier.error_message.length > 30 
                            ? `${supplier.error_message.substring(0, 30)}...` 
                            : supplier.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <LastImportCell supplierId={supplier.id} />
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium">
                      {supplier.status === 'draft' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/suppliers/new?resume=${supplier.id}`
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Continue Import
                          </button>
                          <SupplierDeleteButton 
                            supplierId={supplier.id} 
                            supplierName={supplier.name}
                            onSuccess={() => handleDeleteSuccess(supplier.id)}
                          />
                        </div>
                      ) : (
                      <div className="flex items-center justify-end space-x-2">
                        <HoverTooltip content="View raw imported data" useFixed={true}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/suppliers/${supplier.id}/raw`
                            }}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        </HoverTooltip>
                        <HoverTooltip content="View mapped data" useFixed={true}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/suppliers/${supplier.id}/mapped`
                            }}
                            className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </button>
                        </HoverTooltip>
                        <HoverTooltip content="Run sync now" useFixed={true}>
                          <ReRunButton 
                            supplierId={supplier.id} 
                            onSuccess={() => {
                              // Refresh the suppliers list to show updated sync data
                              fetchSuppliers()
                            }}
                          />
                        </HoverTooltip>
                        <HoverTooltip content="Edit supplier details and field mappings" useFixed={true}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/suppliers/${supplier.id}/edit`
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </HoverTooltip>
                        <SupplierDeleteButton 
                          supplierId={supplier.id} 
                          supplierName={supplier.name}
                          onSuccess={() => handleDeleteSuccess(supplier.id)}
                        />
                      </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SupplierFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={handleCreateSuccess}
      />

      <SupplierFormModal
        isOpen={!!editingSupplier}
        onClose={() => {
          console.log('Closing edit modal')
          setEditingSupplier(null)
        }}
        onSuccess={handleUpdateSuccess}
        supplier={editingSupplier}
      />
      
    </div>
  )
}