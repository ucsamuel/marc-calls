'use client'

import { useEffect, useState } from 'react'
import { subscribeToPresence } from './presence'

export function usePresence() {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const unsubscribe = subscribeToPresence(setOnlineIds)
    return unsubscribe
  }, [])

  return onlineIds
}