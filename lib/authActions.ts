'use client'

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'

/**
 * Auth actions (Phase 2). Optional everywhere — nothing here is ever forced.
 */

/**
 * Start Google OAuth. Redirects to the /auth/callback route, which exchanges
 * the code and returns the user to `next` (defaults to wherever they are now).
 *
 * `window.location.origin` resolves to https://runback.app in production and
 * http://localhost:3000 in dev automatically, so the redirect works in both
 * without env plumbing.
 */
export async function signInWithGoogle(next?: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const target = next ?? window.location.pathname + window.location.search
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`

  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

/** Sign the current user out and refresh so UI reflects the guest state. */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  await supabase.auth.signOut()
}
