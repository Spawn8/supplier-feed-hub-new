'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import TimezoneSelect from '@/components/TimezoneSelect'

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    timezone: 'UTC'
  })

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
      setFormData({
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        timezone: user.user_metadata?.timezone || 'UTC'
      })
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createSupabaseBrowserClient()
      
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name,
          timezone: formData.timezone
        }
      })

      if (error) {
        throw error
      }

      setSuccess('Account updated successfully')
    } catch (err) {
      console.error('Error updating account:', err)
      setError('Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSignOut = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed. Contact support if you need to update your email.
                </p>
              </div>

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <TimezoneSelect
                  value={formData.timezone}
                  onChange={(timezone) => setFormData(prev => ({ ...prev, timezone }))}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Sign Out
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h2>
            <div className="border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">Delete Account</h3>
              <p className="text-sm text-red-600 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                onClick={() => {
                  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                    // TODO: Implement account deletion
                    alert('Account deletion not yet implemented')
                  }
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}