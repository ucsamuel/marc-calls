'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { initPresence } from '@/lib/presence'

export default function PresenceInitializer() {
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (!userId) return
    initPresence(userId)
  }, [userId])

  return null
}