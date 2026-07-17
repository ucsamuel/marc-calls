'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ReadInfo = {
  message_id: string
  admin_id: string
  admin_name?: string
}

export function useReadReceipts(currentUserId: string, messageIds: string[]) {
  const [reads, setReads] = useState<ReadInfo[]>([])

  const markAsRead = async (messageId: string, senderId: string) => {
    if (senderId === currentUserId) return

    const alreadyRead = reads.some(
      (r) => r.message_id === messageId && r.admin_id === currentUserId
    )
    if (alreadyRead) return

    await supabase.from('admin_message_reads').insert({
      message_id: messageId,
      admin_id: currentUserId,
    })
  }

  useEffect(() => {
    if (messageIds.length === 0) return

    const loadReads = async () => {
      const { data } = await supabase
        .from('admin_message_reads')
        .select('message_id, admin_id, admins(name)')
        .in('message_id', messageIds)

      const enriched = (data || []).map((r: any) => ({
        message_id: r.message_id,
        admin_id: r.admin_id,
        admin_name: r.admins?.name,
      }))
      setReads(enriched)
    }

    loadReads()

    const channel = supabase
      .channel('message_reads_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_message_reads' },
        () => loadReads()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [messageIds.join(',')])

  const getSeenBy = (messageId: string) => {
    return reads.filter((r) => r.message_id === messageId).map((r) => r.admin_name)
  }

  return { markAsRead, getSeenBy }
}