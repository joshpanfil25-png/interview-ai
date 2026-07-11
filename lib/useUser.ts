'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'

/**
 * Lightweight auth-state hook (Phase 1 plumbing).
 *
 * Any client component can call `useUser()` to read the current login state:
 *   const { user, loading } = useUser()
 *
 * It NEVER forces login, redirects, or gates anything — it only reports state.
 * `user` is null for guests (the default for everyone until a later phase adds
 * a sign-in UI). Self-contained: no provider or layout wrapper required; it
 * uses the memoized singleton browser client so all callers share one session.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user ?? null)
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
