import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresh the Supabase auth session on each request so a signed-in user stays
 * signed in across navigation and refresh (standard @supabase/ssr pattern,
 * used from Next 16's `proxy` convention).
 *
 * IMPORTANT: this ONLY refreshes cookies. It never redirects and never gates a
 * route — guests (no cookie) pass straight through untouched, so the anonymous
 * flow is fully preserved.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Touch the user to trigger a token refresh when needed. No branching on the
  // result — we never redirect or block based on auth state.
  await supabase.auth.getUser()

  return response
}
