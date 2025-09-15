import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Completely disable all caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('Surrogate-Control', 'no-store')
  response.headers.set('Vary', '*')
  response.headers.set('ETag', '')
  response.headers.set('Last-Modified', '')
  
  // Disable browser caching
  response.headers.set('X-Accel-Expires', '0')
  response.headers.set('X-Cache-Status', 'MISS')
  
  // Add timestamp to force freshness
  response.headers.set('X-Timestamp', Date.now().toString())
  response.headers.set('X-Request-ID', Math.random().toString(36).substring(7))
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}