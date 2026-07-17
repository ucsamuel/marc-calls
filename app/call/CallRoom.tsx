'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import DailyIframe, { DailyCall, DailyParticipant } from '@daily-co/daily-js'
import { supabase } from '@/lib/supabase'
import { Mic, MicOff, Hand, Users, PhoneOff, Crown, Share2 } from 'lucide-react'
import EmojiReactions from './EmojiReactions'

type ParticipantInfo = {
  session_id: string
  user_name: string
  audio: boolean
  photoUrl?: string
}

export default function CallRoom() {
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomName = searchParams.get('room')
  const guestName = searchParams.get('name')

  const callRef = useRef<DailyCall | null>(null)
  const adminPhotosRef = useRef<Record<string, string>>({})
  const speakerIdsRef = useRef<Set<string>>(new Set())

  const [callId, setCallId] = useState('')
  const [joined, setJoined] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isCoHost, setIsCoHost] = useState(false)
  const [myMuted, setMyMuted] = useState(true)
  const [hardMuted, setHardMuted] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [listenerCount, setListenerCount] = useState(0)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [speakerIds, setSpeakerIds] = useState<Set<string>>(new Set())
  const [raisedHands, setRaisedHands] = useState<string[]>([])
  const [networkIssues, setNetworkIssues] = useState<Record<string, 'low' | 'very-low'>>({})
  const [showManage, setShowManage] = useState(false)
  const [showListeners, setShowListeners] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [blockedEntry, setBlockedEntry] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  useEffect(() => {
    speakerIdsRef.current = speakerIds
  }, [speakerIds])

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch (e) {
      // silently ignore if audio context unavailable
    }
  }

  useEffect(() => {
    if (callRef.current) return

    let hasJoinedOnce = false

    const setup = async () => {
      const kickedKey = `kicked_${roomName}`
      if (localStorage.getItem(kickedKey) === 'true') {
        setBlockedEntry(true)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      let displayName = guestName || 'Guest'
      let admin = false

      const { data: allAdmins } = await supabase.from('admins').select('id, name, photo_url')
      const photoMap: Record<string, string> = {}
      allAdmins?.forEach((a) => {
        photoMap[a.name] = a.photo_url
      })
      adminPhotosRef.current = photoMap

      if (user) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('name, photo_url')
          .eq('id', user.id)
          .single()

        if (adminData) {
          displayName = adminData.name
          admin = true
        }
      }

      setIsAdmin(admin)

      const { data: callData } = await supabase
        .from('calls')
        .select('id, host_id')
        .eq('daily_room_name', roomName)
        .single()

      if (callData) setCallId(callData.id)
      if (user && callData?.host_id === user.id) setIsHost(true)

      const existingInstance = DailyIframe.getCallInstance()
      if (existingInstance) {
        await existingInstance.destroy()
      }

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      })
      callRef.current = call

      call.on('joined-meeting', () => {
        hasJoinedOnce = true
        setJoined(true)
        call.setLocalAudio(false)
      })

      call.on('participant-joined', () => {
        updateParticipants()

        const localId = call.participants().local?.session_id
        if (localId && speakerIdsRef.current.has(localId)) {
          call.sendAppMessage({ type: 'speaker-status', sessionId: localId, isSpeaker: true }, '*')
        }
      })

      call.on('participant-updated', updateParticipants)
      call.on('participant-left', updateParticipants)

      call.on('left-meeting', () => {
        if (hasJoinedOnce) setDisconnected(true)
      })

      call.on('error', () => {
        if (hasJoinedOnce) setDisconnected(true)
      })

      call.on('network-quality-change', (ev: any) => {
        const localId = call.participants().local?.session_id
        const quality = ev.threshold === 'good' ? null : ev.threshold

        call.on('active-speaker-change', (ev: any) => {
       setActiveSpeaker(ev.activeSpeaker?.peerId || null)
       })

        call.sendAppMessage({ type: 'network-status', sessionId: localId, quality }, '*')

        setNetworkIssues((prev) => {
          const next = { ...prev }
          if (quality) {
            next[localId] = quality
          } else {
            delete next[localId]
          }
          return next
        })
      })

      call.on('app-message', (ev: any) => {
        const localId = call.participants().local?.session_id

        if (ev.data?.type === 'kick' && ev.data.targetId === localId) {
          localStorage.setItem(kickedKey, 'true')
          setKicked(true)
          call.leave()
        }
        if (ev.data?.type === 'raise-hand') {
          setRaisedHands((prev) =>
            ev.data.raised
              ? [...new Set([...prev, ev.data.sessionId])]
              : prev.filter((id) => id !== ev.data.sessionId)
          )
        }
        if (ev.data?.type === 'promote-cohost' && ev.data.targetId === localId) {
          setIsCoHost(true)
        }
        if (ev.data?.type === 'force-mute' && ev.data.targetId === localId) {
          const wasMuted = hardMuted
          setHardMuted(ev.data.mute)
          if (ev.data.mute) {
            call.setLocalAudio(false)
            setMyMuted(true)
          } else if (wasMuted) {
            playChime()
          }
        }
        if (ev.data?.type === 'speaker-status') {
          setSpeakerIds((prev) => {
            const next = new Set(prev)
            if (ev.data.isSpeaker) next.add(ev.data.sessionId)
            else next.delete(ev.data.sessionId)
            return next
          })
        }
        if (ev.data?.type === 'network-status') {
          setNetworkIssues((prev) => {
            const next = { ...prev }
            if (ev.data.quality) {
              next[ev.data.sessionId] = ev.data.quality
            } else {
              delete next[ev.data.sessionId]
            }
            return next
          })
        }
      })

      await call.join({
        url: `https://marccalls.daily.co/${roomName}`,
        userName: displayName,
      })

      if (admin && callData?.host_id === user?.id) {
        setTimeout(() => {
          const localId = call.participants().local?.session_id
          call.sendAppMessage({ type: 'speaker-status', sessionId: localId, isSpeaker: true }, '*')
          setSpeakerIds((prev) => new Set(prev).add(localId))
        }, 500)
      }
    }

    const updateParticipants = () => {
      const call = callRef.current
      if (!call) return
      const all = Object.values(call.participants())
      const list: ParticipantInfo[] = all.map((p: DailyParticipant) => ({
        session_id: p.session_id,
        user_name: p.user_name || 'Guest',
        audio: p.audio,
        photoUrl: adminPhotosRef.current[p.user_name || ''],
      }))
      setParticipants(list)
      setListenerCount(list.length)

      const local = call.participants().local
      if (local) setMyMuted(!local.audio)
    }

    setup()

    return () => {
      callRef.current?.leave()
      callRef.current?.destroy()
      callRef.current = null
    }
  }, [roomName, guestName])

  const toggleMic = () => {
    if (hardMuted) return
    const call = callRef.current
    if (!call) return
    const newState = !myMuted
    call.setLocalAudio(!newState)
    setMyMuted(newState)
  }

  const toggleRaiseHand = () => {
    const call = callRef.current
    if (!call) return
    const newState = !handRaised
    setHandRaised(newState)
    call.sendAppMessage(
      { type: 'raise-hand', sessionId: call.participants().local.session_id, raised: newState },
      '*'
    )
  }

  const handleShare = async () => {
    const joinLink = `${window.location.origin}/join/${callId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MARC.AG is live', text: 'Join the prayer call now', url: joinLink })
      } catch (err) {}
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(joinLink)
      alert('Link copied to clipboard')
    }
  }

  const handleMuteParticipant = (sessionId: string, currentlyOn: boolean) => {
    callRef.current?.sendAppMessage({ type: 'force-mute', targetId: sessionId, mute: currentlyOn }, '*')
  }

  const handleMuteAll = () => {
    const call = callRef.current
    if (!call) return
    Object.values(call.participants()).forEach((p: any) => {
      if (!p.local) {
        call.sendAppMessage({ type: 'force-mute', targetId: p.session_id, mute: true }, '*')
      }
    })
  }

  const handleKick = (sessionId: string) => {
    const call = callRef.current
    if (!call) return
    call.sendAppMessage({ type: 'kick', targetId: sessionId }, '*')
    setTimeout(() => call.updateParticipant(sessionId, { eject: true }), 300)
  }

  const handlePromoteCoHost = (sessionId: string) => {
    callRef.current?.sendAppMessage({ type: 'promote-cohost', targetId: sessionId }, '*')
    callRef.current?.sendAppMessage({ type: 'speaker-status', sessionId, isSpeaker: true }, '*')
    setSpeakerIds((prev) => new Set(prev).add(sessionId))
  }

  const handleEndCall = async () => {
    const { data: callData } = await supabase
      .from('calls')
      .select('id')
      .eq('daily_room_name', roomName)
      .single()

    if (callData) {
      await supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString(), peak_listeners: listenerCount })
        .eq('id', callData.id)
    }

    await fetch('/api/delete-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName }),
    })

    callRef.current?.leave()
    router.push('/home')
  }

  const handleLeave = () => {
    callRef.current?.leave()
    router.push(isAdmin ? '/home' : '/')
  }

  const handleReconnect = () => {
    window.location.reload()
  }

  if (blockedEntry) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center px-6 text-center">
        <p className="text-white text-sm">You were removed from this call by an admin and can't rejoin this session.</p>
      </div>
    )
  }

  if (kicked) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center px-6 text-center">
        <p className="text-white text-sm">You've been removed from this call by an admin.</p>
      </div>
    )
  }

  if (disconnected) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-white text-sm">You were disconnected from the call.</p>
        <button
          onClick={handleReconnect}
          className="h-12 px-6 rounded-lg bg-[#C9A227] text-[#0B1F3A] font-medium"
        >
          Tap to rejoin
        </button>
      </div>
    )
  }

  const canManage = isHost || isCoHost
  const speakers = participants.filter((p) => speakerIds.has(p.session_id))

  return (
    <div className="min-h-screen bg-[#0B1F3A] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <p className="text-white/60 text-sm">Prayer call</p>
        <button onClick={() => setShowListeners(true)} className="flex items-center gap-1.5 text-white text-sm">
          <Users size={16} />
          <span>{listenerCount} listening</span>
        </button>
      </div>

      <div className="flex-1 px-5">
        {!joined ? (
          <p className="text-white/60 text-sm text-center mt-10">Connecting...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
              {speakers.map((p) => (
  <div
    key={p.session_id}
    className={`bg-white/10 rounded-xl aspect-square flex flex-col items-center justify-center relative transition-all ${
      activeSpeaker === p.session_id ? 'ring-2 ring-[#C9A227]' : ''
    }`}
  >
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.user_name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-medium">
                    {p.user_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-white text-xs mt-2">{p.user_name}</span>
                {networkIssues[p.session_id] && (
                  <span className="text-[10px] text-yellow-400 mt-0.5">
                    {networkIssues[p.session_id] === 'very-low' ? 'Poor connection' : 'Weak connection'}
                  </span>
                )}
                {!p.audio && <MicOff size={14} className="absolute bottom-2 right-2 text-white/60" />}
              </div>
            ))}
          </div>
        )}

        {raisedHands.length > 0 && canManage && (
          <div className="bg-white/10 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-white text-sm">{raisedHands.length} hand(s) raised</span>
            <button onClick={() => setShowManage(true)} className="text-[#C9A227] text-sm">Review</button>
          </div>
        )}
      </div>

      {showManage && canManage && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto">
            <h2 className="font-serif text-lg text-[#0B1F3A] dark:text-white mb-4">Manage participants</h2>
            {participants.map((p) => (
              <div key={p.session_id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#0B1F3A] dark:text-white">{p.user_name}</span>
                  {raisedHands.includes(p.session_id) && <Hand size={14} className="text-[#C9A227]" />}
                  {networkIssues[p.session_id] && (
                    <span className="text-[10px] text-yellow-500">
                      {networkIssues[p.session_id] === 'very-low' ? 'Poor' : 'Weak'}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleMuteParticipant(p.session_id, p.audio)}>
                    {p.audio ? <Mic size={16} className="text-[#0B1F3A] dark:text-white" /> : <MicOff size={16} className="text-red-500" />}
                  </button>
                  {isHost && (
                    <button onClick={() => handlePromoteCoHost(p.session_id)}>
                      <Crown size={16} className="text-[#C9A227]" />
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => handleKick(p.session_id)} className="text-xs text-red-500">Remove</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setShowManage(false)} className="w-full h-12 mt-4 rounded-lg border border-gray-300 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium">Close</button>
          </div>
        </div>
      )}

      {showListeners && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowListeners(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto animate-[slideUp_0.25s_ease-out]">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <h2 className="font-serif text-lg text-[#0B1F3A] dark:text-white mb-1">{listenerCount} listening</h2>
            <div className="w-12 h-[2px] bg-[#C9A227] mb-4" />
            <div className="space-y-3">
              {participants.map((p) => (
                <div key={p.session_id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0B1F3A]/10 dark:bg-white/10 flex items-center justify-center text-xs font-medium text-[#0B1F3A] dark:text-white">
                    {p.user_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-[#0B1F3A] dark:text-white">{p.user_name}</span>
                  {networkIssues[p.session_id] && (
                    <span className="text-[10px] text-yellow-500 ml-auto">
                      {networkIssues[p.session_id] === 'very-low' ? 'Poor connection' : 'Weak'}
                    </span>
                  )}
                  {!p.audio && <MicOff size={14} className="text-gray-400" />}
                </div>
              ))}
            </div>
            <button onClick={() => setShowListeners(false)} className="w-full h-12 mt-5 rounded-lg border border-gray-300 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium">Close</button>
          </div>
        </div>
      )}

      <EmojiReactions call={callRef.current} />

      <div className="px-5 pb-8 pt-4 flex items-center justify-around border-t border-white/10">
        <button onClick={toggleMic} className="flex flex-col items-center gap-1">
          {myMuted ? <MicOff size={22} className="text-white/60" /> : <Mic size={22} className="text-[#C9A227]" />}
          <span className="text-xs text-white/60">{hardMuted ? 'Muted by admin' : myMuted ? 'Muted' : 'Mute'}</span>
        </button>
        <button onClick={toggleRaiseHand} className="flex flex-col items-center gap-1">
          <Hand size={22} className={handRaised ? 'text-[#C9A227]' : 'text-white/60'} />
          <span className="text-xs text-white/60">Raise hand</span>
        </button>
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <Share2 size={22} className="text-white/60" />
          <span className="text-xs text-white/60">Share</span>
        </button>
        {canManage && (
          <button onClick={handleMuteAll} className="flex flex-col items-center gap-1">
            <Users size={22} className="text-white/60" />
            <span className="text-xs text-white/60">Mute all</span>
          </button>
        )}
        {canManage && (
          <button onClick={() => setShowManage(true)} className="flex flex-col items-center gap-1">
            <Crown size={22} className="text-white/60" />
            <span className="text-xs text-white/60">Manage</span>
          </button>
        )}
        <button onClick={isHost ? handleEndCall : handleLeave} className="flex flex-col items-center gap-1">
          <PhoneOff size={22} className="text-red-400" />
          <span className="text-xs text-red-400">{isHost ? 'End call' : 'Leave'}</span>
        </button>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
