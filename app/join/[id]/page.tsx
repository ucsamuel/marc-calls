
import { createClient } from '@supabase/supabase-js'
import JoinPageClient from './JoinPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: call } = await supabase
    .from('calls')
    .select('status, admins(name)')
    .eq('id', id)
    .single()

  const isLive = call?.status === 'live'
  const hostName = (call?.admins as any)?.name

  return {
    title: isLive ? 'MARC.AG is live' : 'MARC.AG prayer call',
    description: isLive
      ? `${hostName || 'A host'} is speaking — tap to join`
      : 'Tap to join when the call begins',
  }
}

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinPageClient callId={id} />
}