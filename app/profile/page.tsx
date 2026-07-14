'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/useUser'
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { NavAuth } from '@/components/auth/NavAuth'
import { Glass, GlassWordmark, RunbackLogoChip } from '@/app/components/teal-glass'

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
  // Phase 4 — the user's saved resume text (null = none / not loaded yet).
  const [savedResume, setSavedResume] = useState<string | null>(null)
  const [clearingResume, setClearingResume] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Signed out (or signed out mid-session) — clear any prior list so the
      // guest prompt shows. No redirect, no crash.
      setSessions(null)
      setSavedResume(null)
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

      // Saved resume (Phase 4) — best-effort. A missing resume_text column
      // (pre-migration) surfaces as an error, which we treat as "no saved
      // resume" so the section renders cleanly.
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('resume_text')
        .eq('id', uid)
        .single()
      if (!active) return
      setSavedResume(profErr ? null : ((prof?.resume_text as string | null) ?? null))
    }

    load()
    return () => {
      active = false
    }
  }, [user, authLoading])

  const isLoading = authLoading || (!!user && sessions === null && !loadError)

  // Delete the saved resume (explicit user action, own row only).
  async function handleClearSavedResume() {
    if (!user || clearingResume) return
    setClearingResume(true)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from('profiles').update({ resume_text: null }).eq('id', user.id)
    if (!error) setSavedResume(null)
    setClearingResume(false)
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in bg-gradient-to-b from-white to-[#F1F4F6]">
      {/* Header */}
      <header className="relative z-2">
        <nav className="rb-glass-nav max-w-[1000px] mx-auto w-full flex items-center justify-between px-6 py-3.5 mt-4 rounded-2xl">
          <Link href="/" className="flex items-center gap-2.5">
            <RunbackLogoChip size={32} />
            <GlassWordmark className="text-lg" />
          </Link>
          <NavAuth />
        </nav>
      </header>

      <main className="flex-1 max-w-[1000px] mx-auto w-full px-6 py-10">
        {/* ===== Your Interviews ===== */}
        <section>
          <h1 className="font-serif font-bold text-3xl text-ink tracking-tight">Your Profile</h1>
          <p className="text-sm text-ink/60 mt-1">Every rep you&apos;ve logged, most recent first.</p>

          <div className="mt-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !user ? (
              // Guest — sign-in prompt (no hard block, no forced redirect)
              <Glass className="rounded-[20px] p-8 max-w-xl">
                <p className="font-serif font-bold text-lg text-ink tracking-tight">Sign in to see your history</p>
                <p className="text-sm text-ink/60 mt-1.5 leading-relaxed">
                  Your past mocks and scores live in your account. Sign in to pick up where you left off.
                </p>
                <div className="mt-5">
                  <GoogleSignInButton label="Continue with Google" next="/profile" />
                </div>
              </Glass>
            ) : loadError ? (
              <Glass className="rounded-[20px] p-6 max-w-xl">
                <p className="text-sm text-red-600">{loadError}</p>
              </Glass>
            ) : sessions && sessions.length === 0 ? (
              // Empty state
              <Glass className="rounded-[20px] p-10 text-center max-w-xl">
                <p className="font-serif font-bold text-xl text-ink tracking-tight">No mocks yet — run your first rep</p>
                <p className="text-sm text-ink/60 mt-1.5">Your interviews will show up here once you finish one.</p>
                <Link
                  href="/get-started"
                  className="inline-flex items-center gap-2 mt-6 bg-brand hover:bg-brand-hover text-white font-semibold px-4 py-2 rounded-md text-sm shadow-[0_8px_20px_rgba(13,95,99,0.25)] transition-all"
                >
                  Start a mock
                </Link>
              </Glass>
            ) : (
              // List
              <ul className="flex flex-col gap-3">
                {(sessions ?? []).map((s) => {
                  const score = s.score == null ? null : Number(s.score)
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/results/${s.id}`}
                        className="group flex items-center gap-4 rounded-xl px-5 py-4 transition-colors bg-[rgba(255,255,255,0.5)] backdrop-blur-[26px] border border-[rgba(255,255,255,0.85)] hover:border-brand shadow-[0_16px_40px_rgba(31,37,43,0.07)]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-ink font-semibold truncate">
                            {s.company} <span className="text-ink/60 font-normal">· {s.role}</span>
                          </p>
                          <p className="text-xs text-ink/50 mt-0.5">{formatDate(s.created_at)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {score != null && Number.isFinite(score) ? (
                            <span className="font-serif font-bold text-2xl text-brand tabular-nums">
                              {score}
                              <span className="text-sm text-ink/50 font-sans font-medium">/10</span>
                            </span>
                          ) : (
                            <span className="text-sm text-ink/50">—</span>
                          )}
                        </div>
                        <svg
                          className="shrink-0 w-4 h-4 text-ink/40 group-hover:text-brand transition-colors"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ===== Saved Resume (Phase 4) ===== */}
        {user && !authLoading && (
          <section className="mt-12">
            <h2 className="font-serif font-bold text-xl text-ink tracking-tight">Saved Resume</h2>
            <p className="text-sm text-ink/60 mt-1">Auto-filled into new mocks so you don&apos;t re-upload each time.</p>
            <Glass className="mt-5 rounded-[20px] p-6 max-w-2xl">
              {savedResume && savedResume.trim().length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Resume saved</span>
                  </div>
                  <p className="text-xs text-ink/60 leading-relaxed whitespace-pre-wrap">
                    {savedResume.slice(0, 200).trim()}{savedResume.length > 200 ? '…' : ''}
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleClearSavedResume}
                      disabled={clearingResume}
                      className="text-sm text-ink/60 hover:text-red-700 underline decoration-ink/20 hover:decoration-red-500/50 transition-colors disabled:opacity-50"
                    >
                      {clearingResume ? 'Clearing…' : 'Clear saved resume'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink/60">
                  No saved resume yet — upload one during your next mock and it&apos;ll be saved here automatically.
                </p>
              )}
            </Glass>
          </section>
        )}
      </main>
    </div>
  )
}
