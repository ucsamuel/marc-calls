import { supabase } from './supabase'

type Listener = (ids: Set<string>) => void

let channel: ReturnType<typeof supabase.channel> | null = null
let onlineIds = new Set<string>()
const listeners: Listener[] = []

export function initPresence(userId: string) {
  if (channel) return // already initialized

  channel = supabase.channel('admin-presence', {
    config: { presence: { key: userId } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState()
      onlineIds = new Set(Object.keys(state))
      listeners.forEach((l) => l(onlineIds))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel!.track({ online_at: new Date().toISOString() })
      }
    })
}

export function subscribeToPresence(listener: Listener) {
  listeners.push(listener)
  listener(onlineIds)
  return () => {
    const i = listeners.indexOf(listener)
    if (i > -1) listeners.splice(i, 1)
  }
}