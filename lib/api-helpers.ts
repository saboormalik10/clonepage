import { NextResponse } from 'next/server'

/**
 * Creates a NextResponse with cache-busting headers and CORS headers to ensure fresh data
 */
export function createFreshResponse(data: any, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

