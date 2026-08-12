
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
  const hasEnded = call?.status === 'ended'
  const hostName = (call?.admins as any)?.name

  let title = 'MARC.AG prayer call'
  let description = 'Tap to view details and join when it begins'
  let image = '/og-image.png'

  if (isLive) {
    title = 'MARC.AG is live'
    description = `${hostName || 'A host'} is speaking — tap to join`
    image = '/og-image-live.png'
  } else if (hasEnded) {
    title = 'This call has ended'
    description = 'Look out for the next session'
    image = '/og-image-ended.png'
  }

  return {
    title,
    description,
    openGraph: {
      images: [image],
    },
  }
}


export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinPageClient callId={id} />
}