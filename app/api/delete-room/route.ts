import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { roomName } = await request.json()

  if (!roomName) {
    return NextResponse.json({ error: 'Missing roomName' }, { status: 400 })
  }

  const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
  })

  if (!response.ok) {
    const data = await response.json()
    return NextResponse.json({ error: data }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}