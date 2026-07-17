
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, MessageCircle, Users, User } from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successLink, setSuccessLink] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSchedule = async () => {
    setError('')

    if (!date || !time) {
      setError('Please pick both a date and time.')
      return
    }

    const scheduledDateTime = new Date(`${date}T${time}`)

    if (scheduledDateTime.getTime() < Date.now()) {
      setError('That time has already passed. Pick a future date and time.')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/create-room', { method: 'POST' })
    const roomData = await res.json()

    if (!roomData.url) {
      setError('Something went wrong creating the call. Please try again.')
      setSaving(false)
      return
    }

    const { data: callData, error: insertError } = await supabase
      .from('calls')
      .insert({
        host_id: user?.id,
        status: 'scheduled',
        scheduled_time: scheduledDateTime.toISOString(),
        daily_room_name: roomData.name,
        daily_room_url: roomData.url,
      })
      .select()
      .single()

    if (insertError) {
      setError('Something went wrong saving the schedule. Please try again.')
      setSaving(false)
      return
    }

    const joinLink = `${window.location.origin}/join/${callData.id}`
    setSuccessLink(joinLink)
    setSaving(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(successLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
   <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 pb-24 flex items-center">
  <div className="max-w-md mx-auto px-5 w-full">
        <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mb-1">Schedule a call</h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />

        {!successLink ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              onClick={handleSchedule}
              disabled={saving}
              className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium disabled:opacity-60"
            >
              {saving ? 'Scheduling...' : 'Schedule call'}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-[#0B1F3A]/8 dark:border-gray-700 text-center">
            <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-2">Call scheduled successfully</p>
            <p className="text-sm text-[#0B1F3A] dark:text-white font-medium break-all mb-4">
              {successLink}
            </p>
            <button
              onClick={handleCopy}
              className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium mb-2"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={() => router.push('/home')}
              className="w-full h-12 rounded-lg border border-[#0B1F3A]/20 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium"
            >
              Back to home
            </button>
          </div>
        )}
      </div>

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
          <button onClick={() => router.push('/profile')} className="flex flex-col items-center gap-1 px-4 py-1">
            <User size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}