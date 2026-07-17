import { NextResponse } from 'next/server'

export async function POST() {
  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        start_audio_off: true,
        enable_prejoin_ui: true,
      },
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: 500 })
  }

  return NextResponse.json({ url: data.url, name: data.name })
}