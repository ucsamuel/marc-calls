import { NextRequest, NextResponse } from 'next/server'

const requestLog = new Map<string, number[]>()

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 10

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/join/') || path.startsWith('/api/create-room')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()

    const timestamps = requestLog.get(ip) || []
    const recent = timestamps.filter((t) => now - t < WINDOW_MS)

    if (recent.length >= MAX_REQUESTS) {
      return new NextResponse('Too many requests. Please slow down.', { status: 429 })
    }

    recent.push(now)
    requestLog.set(ip, recent)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/join/:path*', '/api/create-room'],
}