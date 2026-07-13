'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadHistory } from '@/lib/history'
import type { HistoryEntry } from '@/lib/history'
import { Glass, GlassWordmark, Ring, RunbackLogoChip } from '@/app/components/teal-glass'

const SIDEBAR_LINKS = ['Overview', 'Resume', 'Interviews', 'Mock Sessions', 'Applications', 'Career Plan']

function SidebarLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] text-left transition-colors ${
        active ? 'bg-volt/35 text-brand font-bold' : 'text-ink font-medium hover:bg-[rgba(31,37,43,0.04)]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-sm ${active ? 'bg-brand' : 'bg-[rgba(31,37,43,0.2)]'}`} />
      {label}
    </button>
  )
}

export default function Dashboard() {
  const [active, setActive] = useState('Overview')
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)

  // Deferred one tick (not set synchronously in the effect body) so this
  // stays a subscribe-to-external-store read, matching lib/history.ts's
  // localStorage-hydration pattern used elsewhere in the app.
  useEffect(() => {
    const id = setTimeout(() => setHistory(loadHistory()), 0)
    return () => clearTimeout(id)
  }, [])

  const hasHistory = !!history && history.length > 0
  const sorted = hasHistory ? [...history!].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : []
  const latest = sorted[sorted.length - 1]
  const readiness = latest ? Math.round(latest.overallScore * 10) : 0
  const avgScore = hasHistory ? Math.round((sorted.reduce((sum, e) => sum + e.overallScore, 0) / sorted.length) * 10) : 0
  const bestThisWeek = (() => {
    if (!latest) return null
    const weekAgo = new Date(latest.date).getTime() - 7 * 24 * 60 * 60 * 1000
    const thisWeek = sorted.filter((e) => new Date(e.date).getTime() >= weekAgo)
    return thisWeek.length ? Math.max(...thisWeek.map((e) => Math.round(e.overallScore * 10))) : null
  })()

  return (
    <main className="relative min-h-screen flex bg-gradient-to-b from-white to-[#F1F4F6] animate-fade-in overflow-hidden">
      <div className="absolute w-[200px] h-[200px] rounded-full -top-15 -right-15 bg-[radial-gradient(circle,rgba(168,224,221,0.3),transparent_70%)] pointer-events-none" />

      {/* Sidebar */}
      <Glass className="hidden md:flex w-[220px] m-4 rounded-[18px] p-4 flex-col gap-1 relative z-2 shrink-0">
        <Link href="/" className="flex items-center gap-2 px-2 pb-4 pt-1">
          <RunbackLogoChip size={26} />
          <GlassWordmark className="text-base" />
        </Link>
        {SIDEBAR_LINKS.map((l) => (
          <SidebarLink key={l} label={l} active={active === l} onClick={() => setActive(l)} />
        ))}
        <div className="flex-1" />
        <Link
          href="/profile"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[rgba(31,37,43,0.08)] hover:bg-[rgba(31,37,43,0.04)] transition-colors"
        >
          <div className="w-[30px] h-[30px] rounded-full bg-volt flex items-center justify-center text-xs font-bold text-brand">?</div>
          <div>
            <div className="text-xs font-bold text-ink">Your Profile</div>
            <div className="text-[10px] text-ink/60">View profile</div>
          </div>
        </Link>
        <Glass className="rounded-[14px] p-3.5 bg-[rgba(168,224,221,0.3)] border-[rgba(168,224,221,0.5)] shadow-none opacity-70">
          <div className="text-xs font-bold text-brand">Upgrade to Pro</div>
          <div className="text-[11px] text-ink/60 mt-1">Coming soon — unlock AI coaching &amp; more.</div>
        </Glass>
      </Glass>

      {/* Main content */}
      <div className="flex-1 p-6 md:p-8 md:pl-0 flex flex-col gap-5 relative z-2 min-w-0">
        <div>
          <div className="font-serif text-xl font-bold text-ink">Welcome back</div>
          <div className="text-[13px] text-ink/70 mt-0.5">Let&apos;s make today a step closer to your dream job.</div>
        </div>

        {active !== 'Overview' ? (
          <Glass className="rounded-[18px] p-8 text-center">
            <p className="text-sm text-ink/70">The <span className="font-semibold text-ink">{active}</span> section isn&apos;t built yet — check back soon.</p>
          </Glass>
        ) : !hasHistory ? (
          <Glass className="rounded-[18px] p-10 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-ink/70 max-w-sm">You haven&apos;t run a mock interview yet. Once you do, your readiness score and progress will show up here.</p>
            <Link href="/get-started" className="bg-brand hover:bg-brand-hover text-white rounded-[10px] px-5 py-2.5 text-sm font-bold shadow-[0_8px_20px_rgba(13,95,99,0.25)] transition-all">
              Start your first mock
            </Link>
          </Glass>
        ) : (
          <>
            {/* Stat row — grounded in real session history */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Glass className="rounded-[18px] p-4 flex flex-col items-center text-center gap-2">
                <Ring value={readiness} />
                <div>
                  <div className="text-[11px] text-ink/70">Readiness</div>
                  <div className="text-[11px] text-brand font-bold">Latest session</div>
                </div>
              </Glass>
              <Glass className="rounded-[18px] p-4 flex flex-col items-center text-center gap-2">
                <Ring value={avgScore} />
                <div>
                  <div className="text-[11px] text-ink/70">Avg Score</div>
                  <div className="text-[11px] text-brand font-bold">{sorted.length} session{sorted.length !== 1 ? 's' : ''}</div>
                </div>
              </Glass>
              <Glass className="rounded-[18px] p-4">
                <div className="text-[11px] text-ink/70">Mock Interviews</div>
                <div className="font-serif text-2xl font-bold text-ink">{sorted.length}</div>
              </Glass>
              <Glass className="rounded-[18px] p-4">
                <div className="text-[11px] text-ink/70">Best This Week</div>
                <div className="font-serif text-2xl font-bold text-ink">{bestThisWeek !== null ? bestThisWeek : '—'}</div>
              </Glass>
            </div>

            {/* Progress + Next up */}
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
              <Glass className="rounded-[18px] p-5 flex flex-col gap-2.5">
                <div className="text-[13px] font-bold text-ink">Your Progress</div>
                {sorted.length > 1 ? (
                  <svg width="100%" height="90" viewBox="0 0 300 90" preserveAspectRatio="none">
                    <polyline
                      points={sorted.map((e, i) => `${(i / (sorted.length - 1)) * 300},${90 - (e.overallScore * 10 / 100) * 80}`).join(' ')}
                      fill="none"
                      stroke="#0D5F63"
                      strokeWidth="2.5"
                    />
                  </svg>
                ) : (
                  <p className="text-xs text-ink/50">Run a few more sessions to see your trend line.</p>
                )}
              </Glass>
              <Glass className="rounded-[18px] p-5 flex flex-col gap-2.5">
                <div className="text-[13px] font-bold text-ink">Next Up</div>
                <Link href="/get-started" className="text-xs text-ink/70 py-1.5 border-t border-[rgba(31,37,43,0.06)] hover:text-brand transition-colors">Practice a new mock interview</Link>
                {latest && (
                  <Link href={`/results/${latest.sessionId}`} className="text-xs text-ink/70 py-1.5 border-t border-[rgba(31,37,43,0.06)] hover:text-brand transition-colors">Review your last session&apos;s feedback</Link>
                )}
                <Link href="/get-started" className="text-xs text-ink/70 py-1.5 border-t border-[rgba(31,37,43,0.06)] hover:text-brand transition-colors">Update your resume</Link>
              </Glass>
            </div>

            {/* Bento: latest session + shortcuts */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Glass className="rounded-[18px] p-4.5 flex flex-col gap-2.5">
                <div className="text-[13px] font-bold text-ink">Mock Interview</div>
                <div className="flex items-center gap-2.5">
                  <Ring value={readiness} size={52} />
                  <span className="text-[11.5px] text-brand font-bold">
                    {readiness >= 80 ? 'Excellent result' : readiness >= 60 ? 'Solid result' : 'Keep practicing'}
                  </span>
                </div>
              </Glass>
              <Glass className="rounded-[18px] p-4.5 flex flex-col gap-2">
                <div className="text-[13px] font-bold text-ink">Resume Analysis</div>
                <p className="m-0 text-[11.5px] text-ink/70 leading-snug">Analyze your resume from the Get Started form for instant scoring.</p>
                <Link href="/get-started" className="text-[11.5px] text-brand font-bold">Analyze now ▸</Link>
              </Glass>
              <Glass className="rounded-[18px] p-4.5 flex flex-col gap-2">
                <div className="text-[13px] font-bold text-ink">LinkedIn Review</div>
                <p className="m-0 text-[11.5px] text-ink/70 leading-snug">Paste your profile text on the Get Started form for AI feedback.</p>
                <Link href="/get-started" className="text-[11.5px] text-brand font-bold">Review now ▸</Link>
              </Glass>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
