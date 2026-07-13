'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadHistory } from '@/lib/history'
import type { HistoryEntry } from '@/lib/history'
import { Glass, GlassWordmark, RunbackLogoChip } from '@/app/components/teal-glass'

const TARGET_READINESS = 90

// Real projection from the user's own session history — last up-to-4
// sessions, points/week from the score delta over elapsed time. Falls back
// to an honest "not enough data" message instead of the design spec's
// hardcoded demo numbers (CURRENT_READINESS=78 / WEEKLY_RATE=8) since we
// have no LinkedIn OAuth or persisted user profile to back a real identity.
function computeReadinessProjection(history: HistoryEntry[]) {
  if (history.length < 2) return null
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const recent = sorted.slice(-4)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const current = Math.round(last.overallScore * 10)
  const elapsedDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
  if (elapsedDays < 1) return { current, weeklyRate: null }
  const weeklyRate = ((last.overallScore - first.overallScore) * 10) / (elapsedDays / 7)
  return { current, weeklyRate: Math.round(weeklyRate * 10) / 10 }
}

export default function Profile() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)

  // Deferred one tick (not set synchronously in the effect body) so this
  // stays a subscribe-to-external-store read, matching lib/history.ts's
  // localStorage-hydration pattern used elsewhere in the app.
  useEffect(() => {
    const id = setTimeout(() => setHistory(loadHistory()), 0)
    return () => clearTimeout(id)
  }, [])

  const projection = history ? computeReadinessProjection(history) : null
  const daysLeft = projection && projection.weeklyRate && projection.weeklyRate > 0
    ? Math.round(((TARGET_READINESS - projection.current) / projection.weeklyRate) * 7)
    : null

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-white to-[#F1F4F6] animate-fade-in">
      <nav className="flex items-center justify-between px-6.5 py-3.5 mx-5 mt-4 rounded-2xl bg-[rgba(255,255,255,0.55)] backdrop-blur-[22px] border border-[rgba(255,255,255,0.8)] shadow-[0_12px_30px_rgba(31,37,43,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <RunbackLogoChip size={30} />
          <GlassWordmark className="text-lg" />
        </Link>
        <Link href="/dashboard" className="text-[13px] text-ink/70 hover:text-brand transition-colors">← Back</Link>
      </nav>

      <div className="max-w-[900px] mx-auto px-6 pt-2 pb-12 flex flex-col gap-5">

        {/* Identity card — no auth/profile data model exists yet, so this is
            an honest generic placeholder rather than a fabricated identity */}
        <Glass className="rounded-[18px] p-6 flex gap-4.5 items-center">
          <div className="w-[76px] h-[76px] shrink-0 rounded-full bg-[rgba(31,37,43,0.06)] border border-dashed border-[rgba(31,37,43,0.2)] flex items-center justify-center text-[11px] text-ink/40 text-center leading-tight">
            Add photo
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-xl font-bold text-ink">Your Profile</div>
            <div className="text-[13px] text-ink/60 mt-0.5">
              <Link href="/login" className="underline hover:text-brand transition-colors">Sign in</Link> to add your name, school, and major
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="inline-flex items-center gap-1.5 bg-[rgba(10,102,194,0.06)] border border-[rgba(10,102,194,0.2)] rounded-full px-2.5 py-1 opacity-70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/teal-glass/icons/linkedin.svg" alt="LinkedIn" className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold text-[#0A66C2]">Not connected</span>
              </div>
              <span className="text-xs text-ink/40" title="LinkedIn OAuth isn't built yet">Connect — coming soon</span>
            </div>
          </div>
        </Glass>

        {/* Readiness timeline — real, or an honest fallback */}
        <Glass className="rounded-[18px] p-6 flex flex-col gap-3.5">
          <div className="flex justify-between items-baseline">
            <div className="text-[15px] font-bold text-ink">Interview Readiness Timeline</div>
            <span className="text-xs text-ink/60">Based on your last {Math.min(4, history?.length ?? 0)} sessions</span>
          </div>

          {!projection ? (
            <p className="text-sm text-ink/60">Run at least two mock interviews to see your readiness trend here.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[34px] font-bold text-brand">{projection.current}</span>
                <span className="text-sm text-ink/60">/ {TARGET_READINESS} target</span>
                {projection.weeklyRate !== null && (
                  <span className="ml-auto text-[13px] font-bold text-brand">
                    {projection.weeklyRate >= 0 ? '+' : ''}{projection.weeklyRate} pts/week
                  </span>
                )}
              </div>
              <div className="relative h-2.5 bg-[rgba(31,37,43,0.08)] rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-brand rounded-full"
                  style={{ width: `${Math.min(100, (projection.current / TARGET_READINESS) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-ink/60">
                <span>Today</span>
                <span>Interview-ready</span>
              </div>
              <Glass className="rounded-xl px-4 py-3 bg-volt/30 border-[rgba(168,224,221,0.5)] shadow-none">
                {daysLeft !== null ? (
                  <>
                    <span className="text-[13px] font-bold text-brand">At your current pace, you&apos;ll be interview-ready in ~{daysLeft} days</span>
                    <span className="text-[13px] text-ink/70"> — keep practicing 2–3x a week to stay on track.</span>
                  </>
                ) : projection.current >= TARGET_READINESS ? (
                  <span className="text-[13px] font-bold text-brand">You&apos;re already at or above your readiness target 🎉</span>
                ) : (
                  <span className="text-[13px] text-ink/70">Keep practicing to establish a weekly trend — we&apos;ll estimate your readiness date once we have one.</span>
                )}
              </Glass>
            </>
          )}
        </Glass>

        {/* Session history — real data from lib/history.ts */}
        <div>
          <div className="text-[15px] font-bold text-ink mb-2.5">Recent Sessions</div>
          {!history || history.length === 0 ? (
            <Glass className="rounded-[18px] p-6 text-center">
              <p className="text-sm text-ink/60">No sessions yet.</p>
              <Link href="/get-started" className="inline-block mt-3 bg-brand hover:bg-brand-hover text-white rounded-[10px] px-5 py-2.5 text-sm font-bold shadow-[0_8px_20px_rgba(13,95,99,0.25)] transition-all">
                Start your first mock
              </Link>
            </Glass>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.map((s) => (
                <Link
                  key={s.sessionId}
                  href={`/results/${s.sessionId}`}
                  className="block"
                >
                  <Glass className="rounded-[18px] px-4.5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-[rgba(255,255,255,0.7)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-ink truncate">
                        {s.company} <span className="text-ink/60 font-normal">· {s.role}</span>
                      </div>
                      <div className="text-xs text-ink/50 mt-0.5">
                        {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="font-serif text-xl font-bold text-brand shrink-0">
                      {Math.round(s.overallScore * 10)}<span className="text-xs text-ink/50 font-sans font-medium">/100</span>
                    </div>
                  </Glass>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
