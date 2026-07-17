'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getStoredTheme, applyTheme } from '@/lib/theme'
import { Home, MessageCircle, Users, User } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(getStoredTheme() === 'dark')
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('admins')
        .select('name, phone, email, photo_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.name)
        setPhone(data.phone)
        setEmail(data.email)
        setPhotoUrl(data.photo_url)
      }
      setLoading(false)
    }

    load()
  }, [router])

  const handleThemeToggle = () => {
    const newTheme = isDark ? 'light' : 'dark'
    applyTheme(newTheme)
    setIsDark(!isDark)
  }
                 const handleSave = async () => {
  setSaving(true)
  setMessage('')

  const { data: { user } } = await supabase.auth.getUser()
  let updatedPhotoUrl = photoUrl

  if (newPhoto) {
    const fileExt = newPhoto.name.split('.').pop()
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('admin-photos')
      .upload(fileName, newPhoto)

    if (uploadError) {
      console.error('Upload failed:', uploadError)
      alert('Photo upload failed: ' + uploadError.message)
    } else {
      const { data: urlData } = supabase.storage
        .from('admin-photos')
        .getPublicUrl(fileName)
      updatedPhotoUrl = urlData.publicUrl
    }
  }

  await supabase
    .from('admins')
    .update({ name, phone, photo_url: updatedPhotoUrl })
    .eq('id', user?.id)

  setPhotoUrl(updatedPhotoUrl)
  setMessage('Profile updated.')
  setSaving(false)
}

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900">
        <p className="text-[#5B6B82] dark:text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 pb-24">
      <div className="max-w-md mx-auto px-5 pt-8">

        <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mb-1">Profile</h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />

        <div className="flex flex-col items-center mb-8">
          <img
            src={newPhoto ? URL.createObjectURL(newPhoto) : photoUrl}
            alt={name}
            className="w-24 h-24 rounded-full object-cover border-1 border-[#0A0A0A] mb-3"
          />
          <label className="text-sm text-[#0B1F3A] dark:text-[#C9A227] underline cursor-pointer">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setNewPhoto(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full h-12 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email can't be changed here.</p>
          </div>

          {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>

          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <span className="text-sm text-[#0B1F3A] dark:text-white">Dark mode</span>
            <button
              onClick={handleThemeToggle}
              className={`w-12 h-6 rounded-full transition ${isDark ? 'bg-[#C9A227]' : 'bg-gray-300'}`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full h-12 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-medium"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-[#0B1F3A]/8 dark:border-gray-700">
        <div className="max-w-md mx-auto flex justify-around py-2.5">
          <button onClick={() => router.push('/home')} className="flex flex-col items-center gap-1 px-4 py-1">
            <Home size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Home</span>
          </button>
          <button onClick={() => router.push('/chat')} className="flex flex-col items-center gap-1 px-4 py-1">
            <MessageCircle size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Chat</span>
          </button>
          <button onClick={() => router.push('/team')} className="flex flex-col items-center gap-1 px-4 py-1">
            <Users size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Team</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-4 py-1">
            <User size={22} strokeWidth={2} className="text-[#0B1F3A] dark:text-[#C9A227]" />
            <span className="text-xs text-[#0B1F3A] dark:text-[#C9A227] font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}