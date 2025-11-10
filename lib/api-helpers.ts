import { NextResponse } from 'next/server'

/**
 * Creates a NextResponse with cache-busting headers to ensure fresh data
 */
export function createFreshResponse(data: any) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}

/**
 * Route segment config to disable Next.js caching
 */
export const routeConfig = {
  dynamic: 'force-dynamic' as const,
  revalidate: 0
}

