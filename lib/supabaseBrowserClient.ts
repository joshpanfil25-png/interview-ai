import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Auth-aware browser Supabase client (Phase 1 plumbing).
 *
 * Cookie-based session client for the App Router, kept SEPARATE from the
 * existing anon client in `lib/supabase.ts` — the interview/guest flow still
 * uses that one and is intentionally untouched. Nothing here forces login.
 *
 * Memoized so only one GoTrue instance exists in the browser (avoids the
 * "Multiple GoTrueClient instances" warning and duplicate token refreshes).
 */
let _client: SupabaseClient | undefined

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}
