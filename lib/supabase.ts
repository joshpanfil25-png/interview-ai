import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Normalize an env var value: treat empty/whitespace-only values as missing and trim
 *  stray whitespace/newlines (a common copy-paste mistake in the Vercel dashboard
 *  that surfaces later as "TypeError: fetch failed").
 *
 *  Takes the value (not the name) so callers can pass a *static* `process.env.FOO`
 *  member expression. Next.js only inlines `NEXT_PUBLIC_*` into the browser bundle
 *  when it sees a literal `process.env.NEXT_PUBLIC_...` reference; a dynamic
 *  `process.env[name]` lookup is NOT inlined and reads as undefined in the browser. */
function cleanEnv(v: string | undefined): string | undefined {
  const trimmed = v?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Create a Supabase client. Call this **inside a request handler**, never at module
 * top level, so no client (and no network config) is constructed during `next build`.
 *
 * Note: `NEXT_PUBLIC_*` values are inlined at *build* time. If you change them in
 * Vercel you must trigger a fresh deploy for API routes to pick up the new value.
 */
export function getSupabaseClient(): SupabaseClient {
  // Prefer the public names this app uses; fall back to server-only names if present.
  // These MUST be static `process.env.FOO` references so Next.js inlines the
  // NEXT_PUBLIC_* values into the browser bundle (see cleanEnv doc comment).
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? cleanEnv(process.env.SUPABASE_URL)
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? cleanEnv(process.env.SUPABASE_ANON_KEY)

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (missing.length > 0) {
    const msg =
      `[supabase] Missing required env var(s): ${missing.join(', ')}. ` +
      `Set them in Vercel → Project → Settings → Environment Variables (scope: Production) ` +
      `and redeploy; for local dev add them to .env.local.`
    console.error(msg)
    throw new Error(msg)
  }

  // Surface a malformed URL early. A wrong project ref, a deleted project, or trailing
  // whitespace all manifest at fetch time as the opaque "TypeError: fetch failed".
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)\/?$/i.test(url!)) {
    console.warn(
      `[supabase] NEXT_PUBLIC_SUPABASE_URL="${url}" does not look like a standard ` +
      `Supabase URL (expected https://<project-ref>.supabase.co). If the host is wrong ` +
      `or the project no longer exists, requests will fail with "TypeError: fetch failed".`
    )
  }

  return createClient(url!, key!)
}

/**
 * Lazy proxy kept for client components (browser) that import `{ supabase }`.
 * The real client is created on first property access — never at import/build time.
 * Methods are bound to the real client so `this` resolves correctly.
 */
let _browserClient: SupabaseClient | null = null
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_browserClient) _browserClient = getSupabaseClient()
    const value = Reflect.get(_browserClient as object, prop)
    return typeof value === 'function' ? value.bind(_browserClient) : value
  },
})

export type Session = {
  id: string
  company: string
  role: string
  linkedin_url?: string
  created_at: string
}

export type Question = {
  id: string
  session_id: string
  question_text: string
  question_type: 'behavioral' | 'role-specific' | 'curveball'
  order_index: number
}

export type Answer = {
  id: string
  session_id: string
  question_id: string
  answer_text: string
  created_at: string
}
