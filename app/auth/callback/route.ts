import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'

/**
 * OAuth callback for the Supabase Google sign-in flow (Phase 1 plumbing).
 *
 * Supabase redirects here with a `?code=...` after the provider consent. We
 * exchange it for a session (sets the auth cookies via the server client),
 * then redirect back into the app.
 *
 * Production-safe redirect: on Vercel the request `origin` is an internal
 * URL, so we honor `x-forwarded-host` to land the user back on
 * https://runback.app instead of localhost. Ensure the Supabase dashboard
 * Redirect URLs include both https://runback.app/auth/callback and
 * http://localhost:3000/auth/callback.
 *
 * Note: no login UI triggers this yet (that arrives in a later phase); the
 * route exists so the OAuth round-trip is wired and testable.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Where to send the user after sign-in. Defaults to home; only allow
  // same-origin relative paths to avoid open-redirects.
  const nextParam = searchParams.get('next') ?? '/'
  const next = nextParam.startsWith('/') ? nextParam : '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // No code or exchange failed — return home with a flag (no dedicated error
  // UI in Phase 1). The landing page ignores unknown query params.
  return NextResponse.redirect(`${origin}/?auth_error=1`)
}
