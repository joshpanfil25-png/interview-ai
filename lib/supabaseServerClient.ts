import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Auth-aware server Supabase client (Phase 1 plumbing).
 *
 * Reads/writes the Supabase session cookies so server code (e.g. the OAuth
 * callback route) can establish and refresh a session. Separate from the
 * existing `getSupabaseClient()` in `lib/supabase.ts`, which the interview
 * flow keeps using unchanged.
 *
 * Must be called inside a request scope (Route Handler / Server Component /
 * Server Action) because `cookies()` is request-bound. In Next 16 `cookies()`
 * is async, so this returns a Promise.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore when a middleware/route refreshes the
            // session instead. (No middleware in Phase 1; harmless here.)
          }
        },
      },
    },
  )
}
