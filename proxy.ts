import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabaseProxy'

/**
 * Next 16 Proxy (formerly "middleware"): keeps the Supabase auth session fresh.
 * Refresh only — no gating, no redirects. Guests pass through untouched.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files, which never need
     * a session refresh:
     * - _next/static, _next/image
     * - favicon and common image/asset extensions (incl. og-image.png,
     *   pdf.worker.min.mjs)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)',
  ],
}
