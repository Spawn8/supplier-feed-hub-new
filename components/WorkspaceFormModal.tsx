'use client'

import { useState } from 'react'
import Modal from './ui/Modal'
import { useWorkspace } from '@/lib/workspaceContext'

interface WorkspaceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (workspace: any) => void
}

export default function WorkspaceFormModal({ isOpen, onClose, onSuccess }: WorkspaceFormModalProps) {
  const { setWorkspaces, setActiveWorkspaceId } = useWorkspace()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_currency: 'USD',
    default_language: 'en',
    timezone: 'UTC'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let logoUrl = null

      // Upload avatar if a file is selected
      if (avatarFile) {
        const formData = new FormData()
        formData.append('avatar', avatarFile)
        formData.append('workspace_id', 'temp') // Will be updated after workspace creation

        const uploadResponse = await fetch('/api/workspaces/upload-avatar', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json()
          throw new Error(uploadError.error || 'Failed to upload avatar')
        }

        const uploadData = await uploadResponse.json()
        logoUrl = uploadData.logo_url
      }

      const response = await fetch('/api/create-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          logo_url: logoUrl
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workspace')
      }

      // Add the new workspace to the context
      setWorkspaces(prev => [...prev, data.workspace])
      
      // Auto-select the new workspace
      setActiveWorkspaceId(data.workspace.id)
      
      onSuccess(data.workspace)
      onClose()
      setFormData({
        name: '',
        description: '',
        default_currency: 'USD',
        default_language: 'en',
        timezone: 'UTC'
      })
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch (err) {
      console.error('Error creating workspace:', err)
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      setAvatarFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const currencies = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'CAD', label: 'CAD - Canadian Dollar' },
    { value: 'AUD', label: 'AUD - Australian Dollar' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
    { value: 'CHF', label: 'CHF - Swiss Franc' },
    { value: 'SEK', label: 'SEK - Swedish Krona' },
    { value: 'NOK', label: 'NOK - Norwegian Krone' },
    { value: 'DKK', label: 'DKK - Danish Krone' }
  ]

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'nl', label: 'Dutch' },
    { value: 'sv', label: 'Swedish' },
    { value: 'no', label: 'Norwegian' },
    { value: 'da', label: 'Danish' }
  ]

  const timezones = [
    { value: 'UTC', label: 'UTC - Coordinated Universal Time' },
    { value: 'America/New_York', label: 'America/New_York - Eastern Time' },
    { value: 'America/Chicago', label: 'America/Chicago - Central Time' },
    { value: 'America/Denver', label: 'America/Denver - Mountain Time' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles - Pacific Time' },
    { value: 'Europe/London', label: 'Europe/London - Greenwich Mean Time' },
    { value: 'Europe/Paris', label: 'Europe/Paris - Central European Time' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin - Central European Time' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo - Japan Standard Time' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai - China Standard Time' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney - Australian Eastern Time' }
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Workspace">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Workspace Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="My Store"
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be used to identify your workspace
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Workspace Avatar
          </label>
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-lg">
                    {formData.name.charAt(0).toUpperCase() || 'W'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                id="avatar"
                accept="image/*"
                onChange={handleAvatarChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF up to 5MB. Recommended: 200x200px
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of your workspace..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="default_currency" className="block text-sm font-medium text-gray-700 mb-2">
              Default Currency
            </label>
            <select
              id="default_currency"
              name="default_currency"
              value={formData.default_currency}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="default_language" className="block text-sm font-medium text-gray-700 mb-2">
              Default Language
            </label>
            <select
              id="default_language"
              name="default_language"
              value={formData.default_language}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {languages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {timezones.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </Modal>
  )
}