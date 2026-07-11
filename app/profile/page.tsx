'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/lib/useUser'
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { NavAuth } from '@/components/auth/NavAuth'

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M11 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 11 5.5z" />
      <path d="M22 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 22 5.5z" />
    </svg>
  )
}

type SessionRow = {
  id: string
  company: string
  role: string
  created_at: string
  score: number | string | null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useUser()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Signed out (or signed out mid-session) — clear any prior list so the
      // guest prompt shows. No redirect, no crash.
      setSessions(null)
      setLoadError('')
      return
    }

    const uid = user.id
    let active = true
    setLoadError('')

    async function load() {
      const supabase = getSupabaseBrowserClient()
      // Hydrate the auth session so the JWT is attached and auth.uid() resolves.
      await supabase.auth.getSession()
      // RLS also exposes guest (null-owned) rows to everyone, so filter to THIS
      // user's own sessions explicitly. Reads only.
      const { data, error } = await supabase
        .from('sessions')
        .select('id, company, role, created_at, score')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setLoadError('Could not load your interviews. Please refresh to try again.')
        setSessions([])
      } else {
        setSessions((data ?? []) as SessionRow[])
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user, authLoading])

  const isLoading = authLoading || (!!user && sessions === null && !loadError)

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <header className="border-b border-line">
        <nav className="max-w-[1000px] mx-auto w-full flex items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand shadow-[0_0_24px_rgba(255,90,31,0.45)]">
              <LogoMark className="w-5 h-5 text-blacktop" />
            </div>
            <span className="font-display text-[22px] font-black text-cream">runback</span>
          </a>
          <NavAuth />
        </nav>
      </header>

      <main className="flex-1 max-w-[1000px] mx-auto w-full px-6 py-10">
        {/* ===== Your Interviews ===== */}
        <section>
          <h1 className="font-display font-black text-3xl text-cream tracking-tight">Your Profile</h1>
          <p className="text-sm text-ink-muted mt-1">Every rep you&apos;ve logged, most recent first.</p>

          <div className="mt-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !user ? (
              // Guest — sign-in prompt (no hard block, no forced redirect)
              <div className="relative bg-surface border border-line rounded-2xl p-8 overflow-hidden max-w-xl">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#FF5A1F,#D9FF3F)' }} />
                <p className="font-display font-black text-lg text-cream tracking-tight">Sign in to see your history</p>
                <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
                  Your past mocks and scores live in your account. Sign in to pick up where you left off.
                </p>
                <div className="mt-5">
                  <GoogleSignInButton label="Continue with Google" next="/profile" />
                </div>
              </div>
            ) : loadError ? (
              <div className="bg-surface border border-line rounded-2xl p-6 max-w-xl">
                <p className="text-sm text-red-400">{loadError}</p>
              </div>
            ) : sessions && sessions.length === 0 ? (
              // Empty state
              <div className="bg-surface border border-line rounded-2xl p-10 text-center max-w-xl">
                <p className="font-display font-black text-xl text-cream tracking-tight">No mocks yet — run your first rep</p>
                <p className="text-sm text-ink-muted mt-1.5">Your interviews will show up here once you finish one.</p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 mt-6 bg-brand hover:bg-brand-hover text-blacktop font-semibold px-4 py-2 rounded-md text-sm transition-colors"
                >
                  Start a mock
                </a>
              </div>
            ) : (
              // List
              <ul className="flex flex-col gap-3">
                {(sessions ?? []).map((s) => {
                  const score = s.score == null ? null : Number(s.score)
                  return (
                    <li key={s.id}>
                      <a
                        href={`/results/${s.id}`}
                        className="group flex items-center gap-4 bg-surface border border-line hover:border-brand rounded-xl px-5 py-4 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-cream font-semibold truncate">
                            {s.company} <span className="text-ink-muted font-normal">· {s.role}</span>
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">{formatDate(s.created_at)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {score != null && Number.isFinite(score) ? (
                            <span className="font-display font-black text-2xl text-volt tabular-nums">
                              {score}
                              <span className="text-sm text-ink-muted font-medium">/10</span>
                            </span>
                          ) : (
                            <span className="text-sm text-ink-muted">—</span>
                          )}
                        </div>
                        <svg
                          className="shrink-0 w-4 h-4 text-ink-muted group-hover:text-brand transition-colors"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/*
          ===== Phase 4 placeholder: Saved Resume =====
          A future "Saved Resume" section slots in here as its own <section>
          once resume persistence lands. Intentionally omitted in Phase 3 (no
          resume code yet) — the page is structured so it drops in without a
          redesign.
        */}
      </main>
    </div>
  )
}
