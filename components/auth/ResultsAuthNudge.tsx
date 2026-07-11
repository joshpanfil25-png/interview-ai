'use client'

import { useUser } from '@/lib/useUser'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

/**
 * Optional "save your progress" nudge on the results page (Phase 2).
 *
 * Renders NOTHING while loading or when signed in. For guests it shows a
 * tasteful card with a Google sign-in button. It never blocks or gates the
 * results — it's just an optional card in the results stack. After sign-in the
 * user is returned to this same results page (next = current path).
 */
export function ResultsAuthNudge() {
  const { user, loading } = useUser()

  if (loading || user) return null

  return (
    <div className="relative bg-surface border border-line rounded-2xl p-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#FF5A1F,#D9FF3F)' }} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-lg text-cream tracking-tight">
            Save your results &amp; track your progress
          </p>
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">
            Sign in to keep every mock and watch your scores climb over time.
          </p>
        </div>
        <div className="shrink-0">
          <GoogleSignInButton label="Continue with Google" />
        </div>
      </div>
    </div>
  )
}
