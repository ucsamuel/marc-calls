
'use client'

import { Suspense } from 'react'
import CallRoom from './CallRoom'

export default function CallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center text-white text-sm">Loading...</div>}>
      <CallRoom />
    </Suspense>
  )
}