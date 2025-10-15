'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'

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
  delivery_method: 'download' | 'webhook' | 's3'
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
  const [activeTab, setActiveTab] = useState<'profiles' | 'history'>('profiles')

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

      // Refresh history
      fetchData()
    } catch (err) {
      console.error('Error generating export:', err)
      setError('Failed to generate export')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
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

  if (loading) {
    return (
      <div className="p-6">
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Exports</h2>
        <button
          onClick={() => {/* TODO: Create export profile modal */}}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Export Profile
        </button>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profiles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Export Profiles
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Export History
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'profiles' ? (
        <div>
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
                onClick={() => {/* TODO: Create export profile modal */}}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Export Profile
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onExportSelect?.(profile)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{profile.name}</h3>
                      {profile.description && (
                        <p className="text-sm text-gray-500 mt-1">{profile.description}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFormatColor(profile.output_format)}`}>
                      {profile.output_format.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="w-20">Fields:</span>
                      <span>{profile.field_selection.length} selected</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-20">Platform:</span>
                      <span>{profile.platform || 'Custom'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-20">Delivery:</span>
                      <span className="capitalize">{profile.delivery_method}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className={`text-xs ${profile.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                      {profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleGenerateExport(profile.id)
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No exports yet</h3>
              <p className="text-gray-500">Generate your first export to see it here</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((exportItem) => (
                      <tr key={exportItem.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{exportItem.filename}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exportItem.item_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatFileSize(exportItem.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(exportItem.generation_time_ms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(exportItem.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {exportItem.download_url ? (
                            <a
                              href={exportItem.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-400">Expired</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}