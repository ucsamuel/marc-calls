'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, MessageCircle, Users, User, Clipboard } from 'lucide-react'

type Admin = {
  id: string
  name: string
  photo_url: string
}

type Call = {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
  peak_listeners: number
  host_id: string
  host_name?: string
}

export default function HomePage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [recentCalls, setRecentCalls] = useState<Call[]>([])
  const [totalCalls, setTotalCalls] = useState(0)
  const [avgListeners, setAvgListeners] = useState(0)
  const [upcomingCalls, setUpcomingCalls] = useState<any[]>([])
  const [liveCall, setLiveCall] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showStartChoice, setShowStartChoice] = useState(false)
  const [pendingScheduledCall, setPendingScheduledCall] = useState<any>(null)
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: adminData } = await supabase
        .from('admins')
        .select('id, name, photo_url')
        .eq('id', user.id)
        .single()

      setAdmin(adminData)

      const { data: callsData } = await supabase
        .from('calls')
        .select('id, status, started_at, ended_at, peak_listeners, host_id, admins(name)')
        .eq('status', 'ended')
        .order('started_at', { ascending: false })
        .limit(5)

      const formatted = (callsData || []).map((c: any) => ({
        ...c,
        host_name: c.admins?.name || 'Unknown',
      }))

      setRecentCalls(formatted)

      const { count } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ended')

      setTotalCalls(count || 0)

      if (formatted.length > 0) {
        const avg = formatted.reduce((sum, c) => sum + (c.peak_listeners || 0), 0) / formatted.length
        setAvgListeners(Math.round(avg))
      }

      const { data: upcoming } = await supabase
        .from('calls')
        .select('id, scheduled_time, daily_room_name, admins(name)')
        .eq('status', 'scheduled')
        .order('scheduled_time', { ascending: true })

      setUpcomingCalls(upcoming || [])

      const { data: live } = await supabase
        .from('calls')
        .select('id, daily_room_name')
        .eq('status', 'live')
        .maybeSingle()

      setLiveCall(live)

      setLoading(false)
    }

    load()

    // Real-time: reflect calls starting, ending, being scheduled, or deleted, without needing a refresh
    const channel = supabase
      .channel('home_calls_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const checkAndStart = async () => {
    const { data: live } = await supabase
      .from('calls')
      .select('id, daily_room_name')
      .eq('status', 'live')
      .maybeSingle()

    const { data: scheduled } = await supabase
      .from('calls')
      .select('id, scheduled_time, daily_room_name, daily_room_url')
      .eq('status', 'scheduled')
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (live) {
      setLiveCall(live)
      setPendingScheduledCall(scheduled || null)
      setShowStartChoice(true)
    } else if (scheduled) {
      setPendingScheduledCall(scheduled)
      setShowStartChoice(true)
    } else {
      startNewCall()
    }
  }

  const startNewCall = async () => {
    const res = await fetch('/api/create-room', { method: 'POST' })
    const data = await res.json()

    if (data.url) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('calls').insert({
        host_id: user?.id,
        status: 'live',
        started_at: new Date().toISOString(),
        daily_room_name: data.name,
        daily_room_url: data.url,
      })
      router.push(`/call?room=${data.name}`)
    }
  }

  const startScheduledCall = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    await supabase
      .from('calls')
      .update({
        status: 'live',
        started_at: new Date().toISOString(),
        host_id: user?.id,
      })
      .eq('id', pendingScheduledCall.id)

    router.push(`/call?room=${pendingScheduledCall.daily_room_name}`)
  }

  const joinExistingCall = () => {
    router.push(`/call?room=${liveCall.daily_room_name}`)
  }

  const handleDeleteScheduled = async (callId: string) => {
    const confirmed = window.confirm('Delete this scheduled call? This cannot be undone.')
    if (!confirmed) return

    const call = upcomingCalls.find((c) => c.id === callId)

    if (call?.daily_room_name) {
      await fetch('/api/delete-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: call.daily_room_name }),
      })
    }

    await supabase.from('calls').delete().eq('id', callId)
    setUpcomingCalls(upcomingCalls.filter((c) => c.id !== callId))
  }

  const handleCopyScheduledLink = async (callId: string) => {
    const link = `${window.location.origin}/join/${callId}`

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopiedId(callId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent, callId: string) => {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current

    if (deltaX < -40) {
      setSwipedCardId(callId)
    } else if (deltaX > 40) {
      setSwipedCardId(null)
    }
    touchStartX.current = null
  }

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—'
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
    return `${mins} min`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-[#5B6B82] dark:text-gray-400 tracking-wide uppercase">Welcome back</p>
            <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mt-0.5">{admin?.name}</h1>
          </div>
          <button onClick={() => router.push('/profile')}>
            {admin?.photo_url ? (
              <img
                src={admin.photo_url}
                alt={admin.name}
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#0B1F3A]" />
            )}
          </button>
        </div>

        {/* Live call banner */}
        {liveCall && (
          <button
            onClick={joinExistingCall}
            className="w-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 flex items-center gap-3 text-left"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600"></span>
            </span>
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Call in progress — tap to join</span>
          </button>
        )}

        {/* Primary actions */}
        <button
          onClick={checkAndStart}
          className="w-full h-14 rounded-xl bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium text-[15px] mb-3 shadow-sm active:opacity-90 transition"
        >
          Start call
        </button>

        <button
          onClick={() => router.push('/schedule')}
          className="w-full h-12 rounded-xl border border-[#0B1F3A]/20 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium text-[14px] mb-8 active:bg-[#0B1F3A]/5 dark:active:bg-white/5 transition"
        >
          Schedule a call
        </button>

        {/* Upcoming */}
        {upcomingCalls.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-[#0B1F3A] dark:text-white">Upcoming</h2>
              <div className="h-px bg-[#C9A227]/40 flex-1 ml-3" />
            </div>
            <p className="text-xs text-[#5B6B82] dark:text-gray-400 mb-2">Swipe left on a call to copy its link</p>
            <div className="space-y-2">
              {upcomingCalls.map((call) => (
                <div key={call.id} className="relative overflow-hidden rounded-xl">
                  <div className="absolute inset-0 flex items-center justify-end pr-4 bg-[#0B1F3A] dark:bg-[#C9A227]">
                    <button
                      onClick={() => handleCopyScheduledLink(call.id)}
                      className="flex flex-col items-center gap-1 text-white dark:text-[#0B1F3A]"
                    >
                      <Clipboard size={20} />
                      <span className="text-[10px]">{copiedId === call.id ? 'Copied!' : 'Copy link'}</span>
                    </button>
                  </div>
                  <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTouchEnd(e, call.id)}
                    className="relative bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#C9A227]/30 dark:border-[#C9A227]/30 flex items-center justify-between transition-transform"
                    style={{ transform: swipedCardId === call.id ? 'translateX(-90px)' : 'translateX(0)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0B1F3A] dark:text-white">
                        {new Date(call.scheduled_time).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          hour12: true,
                        })}
                      </p>
                      <p className="text-xs text-[#5B6B82] dark:text-gray-400 mt-0.5">
                        Scheduled by {call.admins?.name || 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteScheduled(call.id)}
                      className="text-xs text-red-500 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights strip */}
        <div className="flex gap-3 mb-8">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#0B1F3A]/8 dark:border-gray-700">
            <p className="text-2xl font-serif text-[#0B1F3A] dark:text-white">{totalCalls}</p>
            <p className="text-xs text-[#5B6B82] dark:text-gray-400 mt-0.5">Sessions held</p>
          </div>
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#0B1F3A]/8 dark:border-gray-700">
            <p className="text-2xl font-serif text-[#0B1F3A] dark:text-white">{avgListeners || '—'}</p>
            <p className="text-xs text-[#5B6B82] dark:text-gray-400 mt-0.5">Avg. listeners</p>
          </div>
        </div>

        {/* Recent calls */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[#0B1F3A] dark:text-white">Recent calls</h2>
          <div className="h-px bg-[#C9A227]/40 flex-1 ml-3" />
        </div>

        {recentCalls.length === 0 ? (
          <p className="text-sm text-[#5B6B82] dark:text-gray-400 py-6 text-center">
            No calls yet — start your first session above.
          </p>
        ) : (
          <div className="space-y-2">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#0B1F3A]/8 dark:border-gray-700 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A] dark:text-white">{call.host_name}</p>
                  <p className="text-xs text-[#5B6B82] dark:text-gray-400 mt-0.5">
                    {formatDate(call.started_at)} · {formatDuration(call.started_at, call.ended_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#0B1F3A] dark:text-white">{call.peak_listeners}</p>
                  <p className="text-xs text-[#5B6B82] dark:text-gray-400">peak</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start call choice modal */}
      {showStartChoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6">
            <h2 className="font-serif text-lg text-[#0B1F3A] dark:text-white mb-2">
              {liveCall ? 'A call is already in progress' : 'You have a scheduled call'}
            </h2>
            {pendingScheduledCall && (
              <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-5">
                Scheduled for {new Date(pendingScheduledCall.scheduled_time).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  hour12: true,
                })}
              </p>
            )}

            {liveCall && (
              <button
                onClick={joinExistingCall}
                className="w-full h-12 rounded-lg bg-green-600 text-white font-medium mb-2"
              >
                Join existing call
              </button>
            )}

            {pendingScheduledCall && (
              <button
                onClick={startScheduledCall}
                className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium mb-2"
              >
                Start scheduled call
              </button>
            )}

            <button
              onClick={startNewCall}
              className="w-full h-12 rounded-lg border border-[#0B1F3A]/20 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium mb-2"
            >
              Start a new call instead
            </button>
            <button
              onClick={() => setShowStartChoice(false)}
              className="w-full h-10 text-sm text-[#5B6B82] dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-[#0B1F3A]/8 dark:border-gray-700">
        <div className="max-w-md mx-auto flex justify-around py-2.5">
          <button className="flex flex-col items-center gap-1 px-4 py-1">
            <Home size={22} strokeWidth={2} className="text-[#0B1F3A] dark:text-[#C9A227]" />
            <span className="text-xs text-[#0B1F3A] dark:text-[#C9A227] font-medium">Home</span>
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