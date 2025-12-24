'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import ExportProfileFormModal from './ExportProfileFormModal'
import HoverTooltip from '@/components/ui/HoverTooltip'

interface ExportProfile {
  id: string
  name: string
  description?: string
  output_format: 'csv' | 'json' | 'xml'
  platform?: string
  field_selection: string[]
  field_ordering: string[]
  filters: Record<string, any>
  template_config: Record<string, any>
  file_naming: string
  delivery_method: 'download' | 'feed'
  delivery_config: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ExportHistory {
  id: string
  export_profile_id: string
  filename: string
  file_size?: number
  item_count: number
  generation_time_ms: number
  download_url?: string
  expires_at?: string
  created_at: string
}

interface ExportsListProps {
  onExportSelect?: (exportProfile: ExportProfile) => void
}

export default function ExportsList({ onExportSelect }: ExportsListProps) {
  const [profiles, setProfiles] = useState<ExportProfile[]>([])
  const [history, setHistory] = useState<ExportHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ExportProfile | undefined>(undefined)
  const [generating, setGenerating] = useState<string | null>(null)
  type NoticeType = 'success' | 'info' | 'warning' | 'error'
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null)
  const showNotice = (type: NoticeType, message: string, timeoutMs = 4000) => {
    setNotice({ type, message })
    window.clearTimeout((showNotice as any)._t)
    ;(showNotice as any)._t = window.setTimeout(() => setNotice(null), timeoutMs)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch export profiles
      const profilesResponse = await fetch('/api/exports', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const profilesData = await profilesResponse.json()
      if (profilesResponse.ok) {
        setProfiles(profilesData.profiles || [])
      }

      // Fetch export history
      const historyResponse = await fetch('/api/exports/history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const historyData = await historyResponse.json()
      if (historyResponse.ok) {
        setHistory(historyData.history || [])
      }

    } catch (err) {
      console.error('Error fetching exports data:', err)
      setError('Failed to load exports data')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateExport = async (profileId: string) => {
    try {
      setGenerating(profileId)
      setError(null)
      const response = await fetch(`/api/exports/${profileId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate export')
      }

      showNotice('success', 'Export generated successfully!')
      fetchData()
    } catch (err: any) {
      console.error('Error generating export:', err)
      showNotice('error', err.message || 'Failed to generate export')
    } finally {
      setGenerating(null)
    }
  }

  const handleOpenModal = (profile?: ExportProfile) => {
    setSelectedProfile(profile)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedProfile(undefined)
  }

  const handleModalSuccess = () => {
    fetchData()
    showNotice('success', selectedProfile ? 'Export profile updated successfully!' : 'Export profile created successfully!')
  }

  const handleEditProfile = (profile: ExportProfile, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    handleOpenModal(profile)
  }

  const handleDeleteProfile = async (profileId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const profile = profiles.find(p => p.id === profileId)
    if (!confirm(`Are you sure you want to delete "${profile?.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/exports/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete export profile')
      }

      showNotice('info', `"${profile?.name}" was deleted`)
      fetchData()
    } catch (err: any) {
      console.error('Error deleting export profile:', err)
      showNotice('error', err.message || 'Failed to delete export profile')
    }
  }

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'csv':
        return 'bg-green-100 text-green-800'
      case 'json':
        return 'bg-blue-100 text-blue-800'
      case 'xml':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getLastExport = (profileId: string) => {
    return history
      .filter(h => h.export_profile_id === profileId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatUrl = (url: string, maxStart: number = 15, maxEnd: number = 15) => {
    const totalLength = maxStart + maxEnd + 3 // +3 for "..."
    if (url.length <= totalLength) return url
    return `${url.substring(0, maxStart)}...${url.substring(url.length - maxEnd)}`
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
            onClick={fetchData}
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

      <ExportProfileFormModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        profile={selectedProfile}
      />
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Export Profiles</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Export Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No export profiles yet</h3>
          <p className="text-gray-500 mb-4">Create your first export profile to start generating feeds</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Export Profile
          </button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="relative">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Profile & Format
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Platform
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Fields
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Last Export
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {profiles.map((profile) => {
                  const lastExport = getLastExport(profile.id)
                  return (
                    <tr 
                      key={profile.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div>
                          <div className="flex items-center mb-2">
                            <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getFormatColor(profile.output_format)}`}>
                              {profile.output_format.toUpperCase()}
                            </span>
                          </div>
                          {profile.description && (
                            <div className="text-xs text-gray-500 truncate" title={profile.description}>
                              {profile.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {profile.platform ? (
                          <span className="capitalize">{profile.platform}</span>
                        ) : (
                          <span className="text-gray-400">Custom</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <HoverTooltip content={`Fields: ${profile.field_selection.join(', ')}`} useFixed={true}>
                          <span className="cursor-help">
                            {profile.field_selection.length} field{profile.field_selection.length !== 1 ? 's' : ''}
                          </span>
                        </HoverTooltip>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                            profile.delivery_method === 'download' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {profile.delivery_method === 'download' ? 'DL' : 'Feed'}
                          </span>
                          {profile.delivery_method === 'feed' && (
                            <div className="flex items-center">
                              <HoverTooltip content={`${window.location.origin}/api/exports/feed/${profile.id}.${profile.output_format}`} useFixed={true}>
                                <span className="truncate cursor-help text-xs text-gray-500">
                                  {formatUrl(`${window.location.origin}/api/exports/feed/${profile.id}.${profile.output_format}`, 15, 15)}
                                </span>
                              </HoverTooltip>
                              <HoverTooltip content="Copy Feed URL" useFixed={true}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const feedUrl = `${window.location.origin}/api/exports/feed/${profile.id}.${profile.output_format}`
                                    navigator.clipboard.writeText(feedUrl)
                                    showNotice('success', 'Feed URL copied to clipboard')
                                  }}
                                  className="ml-2 p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded cursor-pointer"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </HoverTooltip>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {lastExport ? (
                          <div>
                            <div className="text-xs text-gray-600">
                              {formatDate(lastExport.created_at)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {lastExport.item_count.toLocaleString()} items • {formatFileSize(lastExport.file_size)}
                            </div>
                            {lastExport.download_url && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    const response = await fetch(lastExport.download_url!)
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    // Extract filename from URL or use profile name
                                    const urlParts = lastExport.download_url!.split('/')
                                    const filenameWithParams = urlParts[urlParts.length - 1]
                                    const filename = filenameWithParams.split('?')[0] || `export_${profile.name}.${profile.output_format}`
                                    a.download = filename
                                    document.body.appendChild(a)
                                    a.click()
                                    window.URL.revokeObjectURL(url)
                                    document.body.removeChild(a)
                                  } catch (err) {
                                    console.error('Download failed:', err)
                                    alert('Failed to download file')
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-900 mt-1 inline-flex items-center cursor-pointer"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          profile.is_active 
                            ? 'text-green-600 bg-green-100' 
                            : 'text-gray-600 bg-gray-100'
                        }`}>
                          {profile.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <HoverTooltip content="Generate export" useFixed={true}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleGenerateExport(profile.id)
                              }}
                              disabled={generating === profile.id}
                              className={`text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded cursor-pointer ${
                                generating === profile.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {generating === profile.id ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                            </button>
                          </HoverTooltip>
                          <HoverTooltip content="Edit export profile" useFixed={true}>
                            <button
                              onClick={(e) => handleEditProfile(profile, e)}
                              className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </HoverTooltip>
                          <HoverTooltip content="Delete export profile" useFixed={true}>
                            <button
                              onClick={(e) => handleDeleteProfile(profile.id, e)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </HoverTooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
