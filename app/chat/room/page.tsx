
'use client'

import { useReadReceipts } from '@/lib/useReadReceipts'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, MessageCircle, Users, User, Send, X, AtSign } from 'lucide-react'

type Admin = {
  id: string
  name: string
  photo_url: string
}

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  reply_to_id?: string | null
  reply_to_content?: string | null
  reply_to_sender_name?: string | null
  mentioned_admin_id?: string | null
  sender_name?: string
  sender_photo?: string
}

export default function ChatRoomPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState('')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const { markAsRead, getSeenBy } = useReadReceipts(
    currentUserId,
    messages.map((m) => m.id)
  )
  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [swipingId, setSwipingId] = useState<string | null>(null)
  const [tagIndex, setTagIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const adminsRef = useRef<Admin[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    adminsRef.current = admins
  }, [admins])

  useEffect(() => {
    messages.forEach((msg) => {
      markAsRead(msg.id, msg.sender_id)
    })
  }, [messages])

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
        .select('id, name, photo_url')

      setAdmins(allAdmins || [])
      adminsRef.current = allAdmins || []

      const { data: msgs } = await supabase
        .from('admin_messages')
        .select('id, sender_id, content, created_at, reply_to_id, reply_to_content, reply_to_sender_name, mentioned_admin_id')
        .order('created_at', { ascending: true })

      const enriched = (msgs || []).map((m) => {
        const sender = allAdmins?.find((a) => a.id === m.sender_id)
        return {
          ...m,
          sender_name: sender?.name || 'Unknown',
          sender_photo: sender?.photo_url,
        }
      })

      setMessages(enriched)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('admin_messages_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_messages' },
        (payload) => {
          const sender = adminsRef.current.find((a) => a.id === payload.new.sender_id)
          setMessages((prev) => [
            ...prev,
            {
              ...(payload.new as Message),
              sender_name: sender?.name || 'Unknown',
              sender_photo: sender?.photo_url,
            },
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const resolveMentionedId = (text: string): string | null => {
    const match = text.match(/@(\w+)/)
    if (!match) return null
    const typedName = match[1].toLowerCase()
    const found = admins.find((a) => a.name.split(' ')[0].toLowerCase() === typedName)
    return found?.id || null
  }

  const handleSend = async () => {
    if (!input.trim()) return

    // Being replied to counts as being tagged, even with no literal @mention.
    // An explicit @mention in the text takes priority if both are present.
    const typedMentionId = resolveMentionedId(input)
    const mentionedId =
      typedMentionId || (replyingTo && replyingTo.sender_id !== currentUserId ? replyingTo.sender_id : null)

    await supabase.from('admin_messages').insert({
      sender_id: currentUserId,
      content: input.trim(),
      reply_to_id: replyingTo?.id || null,
      reply_to_content: replyingTo?.content || null,
      reply_to_sender_name: replyingTo?.sender_name || null,
      mentioned_admin_id: mentionedId,
    })

    setInput('')
    setShowMentions(false)
    setReplyingTo(null)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleDelete = async (messageId: string) => {
    const confirmed = window.confirm('Delete this message? This cannot be undone.')
    if (!confirmed) return

    await supabase.from('admin_messages').delete().eq('id', messageId)
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    setShowMentions(value.endsWith('@'))

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }

  const insertMention = (name: string) => {
    setInput(input + name.split(' ')[0] + ' ')
    setShowMentions(false)
  }

  const startReply = (msg: Message) => {
    setReplyingTo(msg)
    // Just attaches the quoted context — no auto-inserted @name in the text itself
  }

  const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
    setTouchStartX(e.touches[0].clientX)
    setSwipingId(msg.id)
  }

  const handleTouchEnd = (e: React.TouchEvent, msg: Message) => {
    if (touchStartX === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(deltaX) > 60) {
      startReply(msg)
    }
    setTouchStartX(null)
    setSwipingId(null)
  }

  const renderContent = (text: string) => {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-[#C9A227] font-medium">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const taggedMessages = messages.filter((m) => m.mentioned_admin_id === currentUserId)

  const jumpToNextTag = () => {
    if (tagIndex >= taggedMessages.length) return
    const target = taggedMessages[tagIndex]
    messageRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTagIndex((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900">
        <p className="text-[#5B6B82] dark:text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <div className="max-w-md w-full mx-auto flex flex-col flex-1 px-5 pt-8 pb-24">

        <div className="flex items-center justify-between mb-1">
          <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white">Admin chat</h1>
          {tagIndex < taggedMessages.length && (
            <button
              onClick={jumpToNextTag}
              className="flex items-center gap-1 text-[#C9A227] text-sm font-medium"
            >
              <AtSign size={16} />
              <span>{taggedMessages.length - tagIndex}</span>
            </button>
          )}
        </div>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />
        <p className="text-xs text-[#5B6B82] dark:text-gray-400 mb-4 -mt-4">Swipe a message to reply</p>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[#5B6B82] dark:text-gray-400 text-center py-6">
              No messages yet — start the conversation.
            </p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div
                  key={msg.id}
                  ref={(el) => { messageRefs.current[msg.id] = el }}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} transition-transform ${
                    swipingId === msg.id ? 'scale-[0.99]' : ''
                  }`}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchEnd={(e) => handleTouchEnd(e, msg)}
                >
                  <img
                    src={msg.sender_photo}
                    alt={msg.sender_name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className={`max-w-[75%] min-w-0 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs text-[#5B6B82] dark:text-gray-400">
                        {isMe ? 'You' : msg.sender_name} · {formatTime(msg.created_at)}
                      </p>
                      {isMe && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="text-xs text-red-400 dark:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {isMe && getSeenBy(msg.id).length > 0 && (
                      <div className="flex items-center gap-1 mb-1">
                        <div className="flex -space-x-1.5">
                          {getSeenBy(msg.id).slice(0, 3).map((name, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full bg-[#0B1F3A]/20 dark:bg-white/20 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-medium text-[#0B1F3A] dark:text-white"
                            >
                              {name?.slice(0, 1).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-[#5B6B82] dark:text-gray-500">
                          {getSeenBy(msg.id).length === 1
                            ? `Seen by ${getSeenBy(msg.id)[0]}`
                            : getSeenBy(msg.id).length <= 3
                            ? `Seen by ${getSeenBy(msg.id).join(', ')}`
                            : `Seen by ${getSeenBy(msg.id).length} people`}
                        </span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-2 text-sm break-words whitespace-pre-wrap ${
                        isMe
                          ? 'bg-[#0B1F3A] dark:bg-white text-white dark:text-[#0B1F3A]'
                          : 'bg-white dark:bg-gray-800 text-[#0B1F3A] dark:text-white border border-[#0B1F3A]/8 dark:border-gray-700'
                      }`}
                    >
                      {msg.reply_to_content && (
                        <div
                          className={`text-xs rounded-lg px-2 py-1 mb-1.5 border-l-2 break-words ${
                            isMe
                              ? 'border-white/40 dark:border-[#0B1F3A]/40 bg-white/10 dark:bg-[#0B1F3A]/10'
                              : 'border-[#0B1F3A]/20 dark:border-white/20 bg-black/5 dark:bg-white/5'
                          }`}
                        >
                          <p className="font-medium opacity-80">{msg.reply_to_sender_name}</p>
                          <p className="opacity-70 truncate">{msg.reply_to_content}</p>
                        </div>
                      )}
                      {renderContent(msg.content)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="relative">
          {replyingTo && (
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-[#0B1F3A]/8 dark:border-gray-700 rounded-lg px-3 py-2 mb-2">
              <div className="text-xs overflow-hidden">
                <p className="text-[#0B1F3A] dark:text-white font-medium">
                  Replying to {replyingTo.sender_name}
                </p>
                <p className="text-[#5B6B82] dark:text-gray-400 truncate">{replyingTo.content}</p>
              </div>
              <button onClick={() => setReplyingTo(null)}>
                <X size={16} className="text-[#5B6B82] dark:text-gray-400 flex-shrink-0 ml-2" />
              </button>
            </div>
          )}

          {showMentions && (
            <div className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-800 rounded-lg border border-[#0B1F3A]/8 dark:border-gray-700 shadow-sm max-h-40 overflow-y-auto">
              {admins
                .filter((a) => a.id !== currentUserId)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => insertMention(a.name)}
                    className="w-full text-left px-4 py-2 text-sm text-[#0B1F3A] dark:text-white hover:bg-[#FAF9F6] dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <img src={a.photo_url} alt={a.name} className="w-6 h-6 rounded-full object-cover" />
                    {a.name}
                  </button>
                ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type a message... use @ to mention"
              rows={1}
              className="flex-1 max-h-[120px] px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white text-sm resize-none overflow-y-auto"
            />
            <button
              onClick={handleSend}
              className="w-12 h-12 rounded-full bg-[#0B1F3A] dark:bg-white flex items-center justify-center flex-shrink-0"
            >
              <Send size={18} className="text-white dark:text-[#0B1F3A]" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-[#0B1F3A]/8 dark:border-gray-700">
        <div className="max-w-md mx-auto flex justify-around py-2.5">
          <button onClick={() => router.push('/home')} className="flex flex-col items-center gap-1 px-4 py-1">
            <Home size={22} strokeWidth={1.8} className="text-[#5B6B82] dark:text-gray-400" />
            <span className="text-xs text-[#5B6B82] dark:text-gray-400">Home</span>
          </button>
          <button onClick={() => router.push('/chat')} className="flex flex-col items-center gap-1 px-4 py-1">
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