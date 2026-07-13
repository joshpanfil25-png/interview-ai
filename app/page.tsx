'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Glass, GlassWordmark, PressButton, RunbackLogoChip, TealBlob } from '@/app/components/teal-glass'
import { NavAuth } from '@/components/auth/NavAuth'

// Nav shows only tabs that route to a live page today. The design-handoff
// placeholders (Mock Interview, Practice, Readiness Report) had no real pages
// and are removed until they're real features — add them back here when they
// ship. There is no separate "Resources" page: that label was an alias for
// /how-it-works, so it's folded into the single "How it works" tab. The Get
// Started / Sign in CTAs live in the nav's right section, not this list.
const NAV_LINKS: { label: string; href?: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Your Profile', href: '/profile' },
]

export default function Marketing() {
  const [activeLink, setActiveLink] = useState('Home')
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="relative min-h-screen overflow-x-hidden animate-fade-in bg-gradient-to-b from-white to-[#F1F4F6] text-ink">
      {/* Nav — an actual glass panel, tying the chrome to the same material as the cards */}
      <nav className="relative z-20 flex items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 py-3.5 mx-5 mt-4 rounded-2xl bg-[rgba(255,255,255,0.55)] backdrop-blur-[22px] border border-[rgba(255,255,255,0.8)] shadow-[0_12px_30px_rgba(31,37,43,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMenuOpen(false)}>
          <RunbackLogoChip size={34} />
          <GlassWordmark className="text-lg" />
        </Link>
        <div className="hidden md:flex gap-3.5 min-w-0 flex-1 overflow-hidden justify-center">
          {NAV_LINKS.map((l) => {
            const active = activeLink === l.label
            const content = (
              <span
                className={`text-[12.5px] whitespace-nowrap pb-[3px] border-b-2 transition-colors duration-150 ${
                  active ? 'text-brand font-bold border-brand' : 'text-ink font-medium border-transparent'
                }`}
              >
                {l.label}
              </span>
            )
            return l.href ? (
              <Link key={l.label} href={l.href} onClick={() => setActiveLink(l.label)}>
                {content}
              </Link>
            ) : (
              <button key={l.label} type="button" onClick={() => setActiveLink(l.label)}>
                {content}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 sm:gap-3 items-center shrink-0">
          {/* Sign in lives on the bar at md+, and inside the mobile menu below md */}
          <div className="hidden md:block">
            <NavAuth />
          </div>
          <PressButton primary href="/get-started" className="px-3.5 py-2 sm:px-4.5 sm:py-2.5">Get Started</PressButton>
          {/* Hamburger — small screens only */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-[rgba(31,37,43,0.12)] text-ink hover:bg-[rgba(31,37,43,0.04)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18 18 6" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown menu — the collapsed nav links + sign in */}
        {menuOpen && (
          <div className="md:hidden absolute top-full right-0 mt-2 w-56 rounded-2xl bg-[rgba(255,255,255,0.92)] backdrop-blur-[22px] border border-[rgba(255,255,255,0.85)] shadow-[0_16px_40px_rgba(31,37,43,0.12)] p-2 animate-fade-in">
            {NAV_LINKS.map((l) =>
              l.href ? (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => { setActiveLink(l.label); setMenuOpen(false) }}
                  className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeLink === l.label ? 'text-brand font-bold bg-brand/[0.06]' : 'text-ink font-medium hover:bg-[rgba(31,37,43,0.04)]'
                  }`}
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => { setActiveLink(l.label); setMenuOpen(false) }}
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-ink font-medium hover:bg-[rgba(31,37,43,0.04)] transition-colors"
                >
                  {l.label}
                </button>
              )
            )}
            <div className="h-px my-2 bg-[rgba(31,37,43,0.08)]" />
            <div className="px-1 pb-1">
              <NavAuth />
            </div>
          </div>
        )}
      </nav>

      {/* Hero — asymmetric split, left-aligned copy, mark bleeding off the right edge */}
      <section className="relative z-2 grid lg:grid-cols-[1.1fr_0.9fr] items-center gap-5 px-6 lg:pl-10 lg:pr-0 pt-10 pb-14 max-w-[1160px] mx-auto">
        <div className="flex flex-col gap-5 max-w-[480px]">
          <div className="rb-rise-in flex items-center gap-2.5" style={{ animationDelay: '0.05s' }}>
            <div className="w-6.5 h-[1.5px] bg-brand" />
            <span className="font-mono text-[11.5px] font-semibold tracking-[0.12em] uppercase text-brand">AI career prep for students</span>
          </div>
          <h1 className="rb-rise-in font-serif tracking-tight m-0" style={{ animationDelay: '0.15s' }}>
            <span className="block font-medium text-[30px] text-ink leading-tight">Practice smarter.</span>
            <span className="block font-bold text-[44px] sm:text-[64px] text-ink leading-[0.98] mt-1">
              Interview<br />better<span className="text-brand">.</span>
            </span>
          </h1>
          <p className="rb-rise-in text-ink/70 text-base leading-relaxed max-w-[380px]" style={{ animationDelay: '0.25s' }}>
            Runback helps students practice real-world skills, get AI feedback, and land the jobs they want.
          </p>
          <div className="rb-rise-in flex items-center gap-5 mt-1" style={{ animationDelay: '0.35s' }}>
            <PressButton primary href="/get-started" className="px-6 py-3.5">Get Started — It&apos;s Free</PressButton>
            <a href="#how-it-works" className="text-sm font-semibold text-ink border-b border-ink pb-0.5 hover:text-brand hover:border-brand transition-colors">
              See how it works
            </a>
          </div>
        </div>

        {/* mark expanded and given more surrounding glass — the hero's one focal decorative moment */}
        <div className="rb-rise-in relative h-[300px] sm:h-[460px] flex items-center justify-end lg:-mr-10" style={{ animationDelay: '0.2s' }}>
          <TealBlob className="w-[280px] h-[280px] sm:w-[440px] sm:h-[440px] right-0 bg-gradient-to-br from-[rgba(168,224,221,0.4)] to-[rgba(13,95,99,0.06)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teal-glass/logo/runback-glass-monogram.png"
            alt="Runback glass mark"
            className="relative w-[260px] sm:w-[480px] max-w-none object-contain"
          />
        </div>
      </section>

      {/* Feature strip — asymmetric bento, not a uniform 3-up grid */}
      <section id="how-it-works" className="relative z-2 grid sm:grid-cols-[1.4fr_1fr] grid-rows-[auto_auto] gap-4 px-6 pb-10 max-w-[920px] mx-auto">
        <Glass className="row-span-2 rounded-[18px] p-6 flex flex-col justify-between gap-3.5 cursor-pointer hover:-translate-y-[3px] transition-transform">
          <div>
            <div className="w-[34px] h-[34px] rounded-[9px] bg-brand" />
            <div className="font-serif font-bold text-[17px] mt-3.5">Mock Interviews</div>
            <div className="text-[13px] text-ink/70 leading-relaxed mt-1.5 max-w-[260px]">Practice real-world questions with an AI interviewer that adapts to your target role.</div>
          </div>
          <div className="h-px bg-[rgba(31,37,43,0.08)]" />
          <Link href="/how-it-works" className="text-xs text-brand font-bold">See how it works ▸</Link>
        </Glass>
        <Glass className="rounded-[18px] p-5 flex flex-col gap-1.5 cursor-pointer hover:-translate-y-[3px] transition-transform">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-volt/60" />
          <div className="text-sm font-bold">AI Resume Review</div>
          <div className="text-[12.5px] text-ink/70 leading-relaxed">Instant, actionable feedback on your resume.</div>
        </Glass>
        <div className="rounded-[20px] p-5 bg-brand text-white flex flex-col gap-1.5 cursor-pointer hover:-translate-y-[3px] transition-transform">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-white/25" />
          <div className="text-sm font-bold">Track & Improve</div>
          <div className="text-[12.5px] text-white/80 leading-relaxed">Watch your readiness score climb over time.</div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-2 mx-6 mb-16 max-w-[920px] sm:mx-auto rounded-[22px] bg-gradient-to-r from-brand to-brand-hover px-7 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
        <div>
          <div className="font-serif font-bold text-xl">Your future starts with practice.</div>
          <div className="text-[13px] opacity-85 mt-1">Join thousands of students building confidence with Runback.</div>
        </div>
        <Link href="/get-started" className="bg-white text-brand rounded-[10px] px-5 py-3 text-[13px] font-bold shrink-0">
          Get Started — It&apos;s Free →
        </Link>
      </section>

      <footer className="relative z-2 pb-8 text-center">
        <p className="text-xs text-ink/50">© 2026 Runback&nbsp;&nbsp;·&nbsp;&nbsp;Built for students, by students</p>
      </footer>
    </main>
  )
}
