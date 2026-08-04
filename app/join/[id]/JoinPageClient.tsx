
// 





'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Call = {
  id: string
  status: string
  scheduled_time: string | null
  daily_room_url: string | null
  daily_room_name: string | null
}

export default function JoinPageClient({ callId }: { callId: string }) {
  const router = useRouter()
  const [call, setCall] = useState<Call | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState('')
  const [showMicStep, setShowMicStep] = useState(false)
  const [micDenied, setMicDenied] = useState(false)
  const [requestingMic, setRequestingMic] = useState(false)

  useEffect(() => {
    const savedName = localStorage.getItem('guest_name')
    if (savedName) setName(savedName)

    const load = async () => {
      const { data } = await supabase
        .from('calls')
        .select('id, status, scheduled_time, daily_room_url, daily_room_name')
        .eq('id', callId)
        .single()

      setCall(data)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`call_status_${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        (payload) => {
          setCall(payload.new as Call)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        () => {
          setCall(null)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callId])

  useEffect(() => {
    if (!call?.scheduled_time || call.status === 'live') return

    const interval = setInterval(() => {
      const diff = new Date(call.scheduled_time!).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('Starting any moment now')
        return
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const secs = Math.floor((diff % (1000 * 60)) / 1000)
      setCountdown(
        hrs > 0 ? `${hrs}h ${mins}m` : `${mins}:${secs.toString().padStart(2, '0')}`
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [call])

  const handleJoinTap = () => {
    if (!name.trim()) return
    localStorage.setItem('guest_name', name.trim())
    setMicDenied(false)
    setShowMicStep(true)
  }

  const handleAllowMic = async () => {
    setRequestingMic(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // We only needed this to trigger and confirm the permission — stop it immediately,
      // Daily will request its own stream once we actually join the room.
      stream.getTracks().forEach((track) => track.stop())

      router.push(`/call?room=${call?.daily_room_name}&name=${encodeURIComponent(name.trim())}`)
    } catch (err) {
      setMicDenied(true)
    } finally {
      setRequestingMic(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900">
        <p className="text-[#5B6B82] dark:text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900 px-6 text-center">
        <p className="text-[#5B6B82] dark:text-gray-400 text-sm">
          This call link is no longer valid.
        </p>
      </div>
    )
  }

  const isLive = call.status === 'live'
  const hasEnded = call.status === 'ended'

  // Mic permission step — shown after tapping Join, before entering the call
  if (showMicStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900 px-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">
          <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white">
            One quick step
          </h1>
          <div className="w-16 h-[2px] bg-[#C9A227] mx-auto my-4" />

          {!micDenied ? (
            <>
              <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-6">
                MARC needs microphone access so you can listen and speak during session.
                Tap "ALLOW" when your browser asks.
              </p>
              <button
                onClick={handleAllowMic}
                disabled={requestingMic}
                className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium disabled:opacity-60"
              >
                {requestingMic ? 'Waiting for permission...' : 'Continue'}
              </button>
              <button
                onClick={() => setShowMicStep(false)}
                className="w-full h-10 mt-2 text-sm text-[#5B6B82] dark:text-gray-400"
              >
                Back
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-6">
                Microphone access was blocked. Tap the lock icon  next to your browser's
                address bar, allow microphone access, then try again.
              </p>
              <button
                onClick={handleAllowMic}
                className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900 px-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">

        <h1 className="font-serif text-2xl text-[#0B1F3A] dark:text-white">
          {hasEnded ? 'This call has ended' : isLive ? 'MARC.AG is live' : 'MARC.AG prayer call'}
        </h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mx-auto my-4" />

        {hasEnded ? (
          <p className="text-sm text-[#5B6B82] dark:text-gray-400 mt-2">
            Look out for the next session in the church group.
          </p>
        ) : !isLive ? (
          <>
            <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-1">Starts in</p>
            <p className="text-3xl font-serif text-[#0B1F3A] dark:text-white mb-6">{countdown}</p>
            <p className="text-xs text-[#5B6B82] dark:text-gray-400 mb-4">
              This page will move to the call automatically once it begins.
            </p>
          </>
        ) : (
          <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-6">The prayer call is live now</p>
        )}

        {!hasEnded && (
          <div className="space-y-3 mt-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white text-center"
            />
            <button
              onClick={handleJoinTap}
              disabled={!name.trim() || !isLive}
              className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium disabled:opacity-40"
            >
              {isLive ? 'Join call' : 'Waiting for host to start'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}