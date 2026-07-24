
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, MessageCircle, Users, User, MessagesSquare } from 'lucide-react'

export default function ChatListPage() {
  const router = useRouter()
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [wasTagged, setWasTagged] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: messages, error: messagesError } = await supabase
      .from('admin_messages')
     .select('id, sender_id, content, created_at, mentioned_admin_id,       admins!admin_messages_sender_id_fkey    (name)')
      .order('created_at', { ascending: false })
      .limit(50)

     console.log('Chat preview messages:', messages, 'Error:', messagesError)

      if (messages && messages.length > 0) {
        setLastMessage({
          ...messages[0],
          sender_name: (messages[0] as any).admins?.name || 'Unknown',
        })

        const { data: reads } = await supabase
          .from('admin_message_reads')
          .select('message_id')
          .eq('admin_id', user.id)

        const readIds = new Set((reads || []).map((r) => r.message_id))

        const unread = messages.filter(
          (m) => m.sender_id !== user.id && !readIds.has(m.id)
        )

        setUnreadCount(unread.length)
        setWasTagged(unread.some((m) => m.mentioned_admin_id === user.id))
      }

      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('chat_preview_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_messages' },
        () => load()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
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
        <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mb-1">Chat</h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />

        <button
          onClick={() => router.push('/chat/room')}
          className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-[#0B1F3A]/8 dark:border-gray-700 flex items-center gap-3 text-left"
        >
          <div className="w-12 h-12 rounded-full bg-[#0B1F3A] dark:bg-[#F0EEE9] flex items-center justify-center flex-shrink-0">
            <MessagesSquare size={22} className="text-white dark:text-[#0B1F3A]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0B1F3A] dark:text-white">Admin Chat</p>
              {lastMessage && (
                <span className="text-xs text-[#5B6B82] dark:text-gray-400 flex-shrink-0 ml-2">
                  {formatTime(lastMessage.created_at)}
                </span>
              )}
            </div>
            {lastMessage ? (
              <p className="text-xs text-[#5B6B82] dark:text-gray-400 truncate mt-0.5">
                {lastMessage.sender_name}: {lastMessage.content}
              </p>
            ) : (
              <p className="text-xs text-[#5B6B82] dark:text-gray-400 mt-0.5">No messages yet</p>
            )}
          </div>

          {(unreadCount > 0 || wasTagged) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {wasTagged && <span className="text-xs text-green-600 dark:text-green-400 font-medium">@</span>}
              {unreadCount > 0 && (
                <span className="bg-green-600 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Bottom tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-[#0B1F3A]/8 dark:border-gray-700">
        <div className="max-w-md mx-auto flex justify-around py-2.5">
          <button onClick={() => router.push('/home')} className="flex flex-col items-center gap-1 px-4 py-1">
            <Home size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-4 py-1">
            <MessageCircle size={22} strokeWidth={2} className="text-[#0B1F3A] dark:text-[#C9A227]" />
            <span className="text-xs text-[#0B1F3A] dark:text-[#C9A227] font-medium">Chat</span>
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

