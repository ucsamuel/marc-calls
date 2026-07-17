'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresence } from '@/lib/usePresence'
import { Home, MessageCircle, Users, User, Trash2 } from 'lucide-react'

type Admin = {
  id: string
  name: string
  phone: string
  photo_url: string
  is_primary: boolean
}

export default function TeamPage() {
  const router = useRouter()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [loading, setLoading] = useState(true)
  const onlineIds = usePresence()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: allAdmins } = await supabase
        .from('admins')
        .select('id, name, phone, photo_url, is_primary')
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true })

         const sorted = [...(allAdmins || [])].sort((a, b) => {
  if (a.id === user.id) return -1
  if (b.id === user.id) return 1
  if (a.is_primary && !b.is_primary) return -1
  if (!a.is_primary && b.is_primary) return 1
  return a.name.localeCompare(b.name)
})

setAdmins(sorted)

const me = allAdmins?.find((a) => a.id === user.id)
setIsPrimary(me?.is_primary || false)

setLoading(false)
    }

    load()
  }, [router])

  const handleRemove = async (adminId: string, adminName: string) => {
    const confirmed = window.confirm(`Remove ${adminName} as an admin? This can't be undone.`)
    if (!confirmed) return

    await supabase.from('admins').delete().eq('id', adminId)
    setAdmins(admins.filter((a) => a.id !== adminId))
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

        <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mb-1">Team</h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />

        <button
          onClick={() => router.push('/team/invite')}
          className="w-full h-12 rounded-xl border border-[#0B1F3A]/20 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium text-sm mb-6"
        >
          Add admin
        </button>

        <div className="space-y-2">
          {admins.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#0B1F3A]/8 dark:border-gray-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={a.photo_url}
                    alt={a.name}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  {onlineIds.has(a.id) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A] dark:text-white">
                    {a.name} {a.id === currentUserId && <span className="text-[#5B6B82] dark:text-gray-400">(you)</span>}
                  </p>
                  <p className="text-xs text-[#5B6B82] dark:text-gray-400">
                    {a.is_primary ? 'Primary admin' : 'Admin'} · {a.phone}
                  </p>
                </div>
              </div>

              {isPrimary && !a.is_primary && (
                <button onClick={() => handleRemove(a.id, a.name)}>
                  <Trash2 size={18} className="text-red-400 dark:text-red-400" />
                </button>
              )}
            </div>
          ))}
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
          <button className="flex flex-col items-center gap-1 px-4 py-1">
            <Users size={22} strokeWidth={2} className="text-[#0B1F3A] dark:text-[#C9A227]" />
            <span className="text-xs text-[#0B1F3A] dark:text-[#C9A227] font-medium">Team</span>
          </button>
          <button onClick={() => router.push('/profile')} className="flex flex-col items-center gap-1 px-4 py-1">
            <User size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}