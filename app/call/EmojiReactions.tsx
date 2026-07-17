
'use client'

import { useState, useEffect } from 'react'
import { DailyCall } from '@daily-co/daily-js'

const EMOJIS = ['👍', '❤️', '🙏', '😂']

type FloatingEmoji = {
  id: number
  emoji: string
  left: number
}

export default function EmojiReactions({ call }: { call: DailyCall | null }) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([])

  useEffect(() => {
    if (!call) return

    const handler = (ev: any) => {
      if (ev.data?.type === 'reaction') {
        spawnEmoji(ev.data.emoji)
      }
    }

    call.on('app-message', handler)
    return () => {
      call.off('app-message', handler)
    }
  }, [call])

  const spawnEmoji = (emoji: string) => {
    const id = Date.now() + Math.random()
    const left = 10 + Math.random() * 70
    setFloating((prev) => [...prev, { id, emoji, left }])
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id))
    }, 2500)
  }

  const sendReaction = (emoji: string) => {
    if (!call) return
    call.sendAppMessage({ type: 'reaction', emoji }, '*')
    spawnEmoji(emoji)
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-24 text-2xl animate-[floatUp_2.5s_ease-out_forwards]"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pb-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-2xl active:scale-90 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>

      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-300px);
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}