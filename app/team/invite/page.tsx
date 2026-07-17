'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, MessageCircle, Users, User } from 'lucide-react'

export default function InvitePage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const token = crypto.randomUUID()

    await supabase.from('admin_invites').insert({
      token,
      created_by: user?.id,
    })

    setLink(`${window.location.origin}/signup?invite=${token}`)
    setGenerating(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 pb-24">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-serif text-xl text-[#0B1F3A] dark:text-white mb-1">Add an admin</h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mb-6" />

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-[#0B1F3A]/8 dark:border-gray-700">
          <p className="text-sm text-[#5B6B82] dark:text-gray-400 mb-4">
            Generate a one-time invite link for the person you'd like to add. It can only be used once.
          </p>

          {!link ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium disabled:opacity-60"
            >
              {generating ? 'Generating...' : 'Generate invite link'}
            </button>
          ) : (
            <>
              <p className="text-sm text-[#0B1F3A] dark:text-white font-medium break-all mb-4">
                {link}
              </p>
              <button
                onClick={handleCopy}
                className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium"
              >
                {copied ? 'Copied!' : 'Copy invite link'}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => router.push('/team')}
          className="w-full h-12 mt-4 rounded-lg border border-[#0B1F3A]/20 dark:border-gray-600 text-[#0B1F3A] dark:text-white font-medium"
        >
          Back to Team
        </button>
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