'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GlassWordmark, PressButton, RunbackLogoChip } from '@/app/components/teal-glass'
import { NavAuth } from '@/components/auth/NavAuth'

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Your Profile', href: '/profile' },
]

type IconName = 'home' | 'practice' | 'resume' | 'progress' | 'spark' | 'arrow'

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    practice: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8" /></>,
    resume: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    progress: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    spark: <><path d="m12 2 1.6 5.1L19 9l-5.4 1.9L12 16l-1.6-5.1L5 9l5.4-1.9z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function PracticeWorkspace() {
  return (
    <div className="rb-rise-in relative mx-auto w-full max-w-[590px] lg:mr-0" style={{ animationDelay: '0.2s' }}>
      <div className="rb-hero-glow absolute -inset-12 -z-10" />
      {/* Keep the original glossy Runback mark as the bridge between the
          clean landing page and the denser practice cockpit. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/teal-glass/logo/runback-glass-monogram.png"
        alt="Runback glass mark"
        className="pointer-events-none absolute -left-14 -top-20 z-0 hidden w-[185px] rotate-[-10deg] object-contain drop-shadow-[0_20px_28px_rgba(13,95,99,0.18)] lg:block"
      />

      <div className="rb-cockpit relative z-[1] overflow-hidden rounded-[28px] p-3 sm:p-4">
        <div className="flex items-center justify-between border-b border-ink/[0.07] px-1 pb-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-brand/35" />
            <span className="h-2 w-2 rounded-full bg-volt" />
            <span className="h-2 w-2 rounded-full bg-brand" />
          </div>
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45">Runback practice workspace</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand font-sans text-[9px] font-bold text-white">C</span>
        </div>

        <div className="grid grid-cols-[42px_1fr] gap-2.5 pt-3 sm:grid-cols-[52px_1fr] sm:gap-3.5">
          <aside className="rb-mini-rail flex flex-col items-center justify-between rounded-[18px] px-2 py-3">
            <div className="flex flex-col items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white shadow-[0_7px_18px_rgba(13,95,99,0.22)]"><RunbackLogoChip size={16} className="fill-white" /></span>
              {(['home', 'practice', 'resume', 'progress'] as IconName[]).map((item, index) => (
                <span key={item} className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors ${index === 1 ? 'bg-brand/[0.09] text-brand' : 'text-ink/40'}`}>
                  <Icon name={item} className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_0_4px_rgba(13,95,99,0.08)]" />
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-2 px-0.5">
              <div>
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-brand">Session in progress</p>
                <h2 className="mt-0.5 font-serif text-[15px] font-bold text-ink sm:text-[18px]">Product strategy practice</h2>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full border border-brand/10 bg-white/55 px-2.5 py-1 font-sans text-[9px] font-semibold text-brand sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4FA67A]" /> AI coach live
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.55fr_0.85fr]">
              <div className="rb-dashboard-card relative min-h-[206px] overflow-hidden rounded-[20px] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-sans text-[9px] font-medium text-ink/45">Interview readiness</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-serif text-[28px] font-bold leading-none text-ink">82</span>
                      <span className="font-sans text-[9px] font-bold text-[#2E8B66]">+12%</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand/[0.07] px-2 py-1 font-sans text-[8px] font-semibold text-brand">Last 4 sessions</span>
                </div>

                <div className="absolute inset-x-3 bottom-3 h-[112px]">
                  <div className="absolute inset-0 grid grid-rows-3">
                    <span className="border-b border-dashed border-ink/[0.07]" />
                    <span className="border-b border-dashed border-ink/[0.07]" />
                    <span />
                  </div>
                  <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="relative h-full w-full" aria-label="Readiness score improving across four practice sessions">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4FA6A0" stopOpacity="0.26" />
                        <stop offset="100%" stopColor="#4FA6A0" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 93 C28 86, 47 73, 75 78 S118 61, 145 67 S188 45, 216 50 S260 23, 300 17 L300 110 L0 110Z" fill="url(#chartFill)" />
                    <path d="M0 93 C28 86, 47 73, 75 78 S118 61, 145 67 S188 45, 216 50 S260 23, 300 17" fill="none" stroke="#0D5F63" strokeWidth="3" strokeLinecap="round" />
                    {[['0','93'],['75','78'],['145','67'],['216','50'],['300','17']].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3.5" fill="white" stroke="#0D5F63" strokeWidth="2" />)}
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-1">
                <div className="rb-dashboard-card rounded-[18px] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[9px] text-ink/45">Questions</span>
                    <span className="font-sans text-[9px] font-bold text-brand">4 / 6</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand/[0.08]"><div className="h-full w-2/3 rounded-full bg-brand" /></div>
                  <p className="mt-2.5 font-serif text-[12px] font-bold text-ink">Strong momentum</p>
                </div>
                <div className="relative overflow-hidden rounded-[18px] bg-brand p-3.5 text-white shadow-[0_14px_30px_rgba(13,95,99,0.2)]">
                  <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-volt/20 blur-xl" />
                  <div className="relative flex items-center justify-between">
                    <span className="font-sans text-[9px] text-white/65">AI feedback</span>
                    <Icon name="spark" className="h-3.5 w-3.5 text-volt" />
                  </div>
                  <p className="relative mt-2 font-serif text-[13px] font-bold leading-snug">Your examples feel specific and credible.</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-[16px] border border-white/70 bg-white/40 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
              <div className="min-w-0">
                <p className="font-sans text-[8px] font-semibold uppercase tracking-[0.12em] text-ink/40">Current prompt</p>
                <p className="truncate font-serif text-[11px] font-semibold text-ink sm:text-[12px]">Tell me about a time you influenced without authority.</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"><Icon name="arrow" className="h-3.5 w-3.5" /></span>
            </div>
          </div>
        </div>
      </div>

      <div className="rb-float absolute -right-2 -top-7 hidden items-center gap-3 rounded-[18px] border border-white/80 bg-white/55 px-3.5 py-3 shadow-[0_16px_35px_rgba(31,37,43,0.11)] backdrop-blur-[24px] sm:flex">
        <div className="relative flex h-11 w-11 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(13,95,99,.1)" strokeWidth="4" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#0D5F63" strokeWidth="4" strokeLinecap="round" strokeDasharray="88 114" />
          </svg>
          <span className="font-serif text-[11px] font-bold text-brand">78%</span>
        </div>
        <div><p className="font-sans text-[8px] uppercase tracking-[0.12em] text-ink/40">Answer clarity</p><p className="mt-0.5 font-serif text-[12px] font-bold">Looking sharp</p></div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, eyebrow, title, copy, href, tone = 'light', className = '' }: {
  icon: IconName
  eyebrow: string
  title: string
  copy: string
  href: string
  tone?: 'light' | 'teal' | 'mist'
  className?: string
}) {
  const dark = tone === 'teal'
  return (
    <Link href={href} className={`rb-feature-card ${dark ? 'rb-feature-card-teal text-white' : tone === 'mist' ? 'rb-feature-card-mist text-ink' : 'text-ink'} group relative overflow-hidden rounded-[24px] p-5 sm:p-6 ${className}`}>
      {dark && <span className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-volt/20 blur-2xl" />}
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/65 bg-white/60 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <Icon name={icon} className="h-[17px] w-[17px]" />
      </div>
      <div className="relative mt-8 sm:mt-10">
        <p className={`font-sans text-[9px] font-semibold uppercase tracking-[0.15em] ${dark ? 'text-volt' : 'text-brand'}`}>{eyebrow}</p>
        <h3 className="mt-1.5 font-serif text-xl font-bold">{title}</h3>
        <p className={`mt-2 max-w-[330px] font-sans text-[12.5px] leading-relaxed ${dark ? 'text-white/70' : 'text-ink/60'}`}>{copy}</p>
      </div>
      <span className={`absolute bottom-5 right-5 flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 ${dark ? 'bg-white/12 text-white' : 'bg-brand/[0.08] text-brand'}`}>
        <Icon name="arrow" className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

export default function Marketing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="rb-marketing-shell relative min-h-screen overflow-hidden text-ink">
      <div className="rb-noise pointer-events-none absolute inset-0 z-0 opacity-35" />
      <div className="pointer-events-none absolute -left-36 top-[260px] h-[560px] w-[560px] rounded-full bg-volt/45 blur-[90px]" />
      <div className="pointer-events-none absolute -right-44 top-[160px] h-[520px] w-[520px] rounded-full bg-brand/15 blur-[110px]" />
      <div className="pointer-events-none absolute left-[42%] top-[660px] h-[440px] w-[440px] rounded-full bg-[#e9b96e]/22 blur-[110px]" />
      <div className="pointer-events-none absolute -left-32 top-[1210px] h-[520px] w-[520px] rounded-full bg-brand/15 blur-[120px]" />

      <nav className="rb-glass-nav relative z-20 mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:mx-5 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <RunbackLogoChip size={34} />
          <GlassWordmark className="text-lg" />
        </Link>
        <div className="hidden min-w-0 flex-1 justify-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className={`border-b-2 pb-[3px] font-sans text-[12px] font-semibold transition-colors ${link.href === '/' ? 'border-brand text-brand' : 'border-transparent text-ink/65 hover:text-brand'}`}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden md:block"><NavAuth /></div>
          <PressButton primary href="/get-started" className="px-3.5 py-2 sm:px-4.5 sm:py-2.5">Get Started</PressButton>
          <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/10 text-ink transition-colors hover:bg-ink/[0.04] md:hidden">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{menuOpen ? <path strokeLinecap="round" d="M6 6l12 12M6 18 18 6" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/85 bg-white/90 p-2 shadow-[0_16px_40px_rgba(31,37,43,0.12)] backdrop-blur-[22px] md:hidden">
            {NAV_LINKS.map((link) => <Link key={link.label} href={link.href} onClick={() => setMenuOpen(false)} className={`block rounded-lg px-3 py-2.5 font-sans text-sm font-semibold ${link.href === '/' ? 'bg-brand/[0.06] text-brand' : 'text-ink/70 hover:bg-ink/[0.04]'}`}>{link.label}</Link>)}
            <div className="my-2 h-px bg-ink/[0.08]" />
            <div className="px-1 pb-1"><NavAuth /></div>
          </div>
        )}
      </nav>

      <section className="rb-hero-shell relative z-[2] mx-3 mt-5 grid max-w-[1320px] items-center gap-12 rounded-[30px] px-5 pb-12 pt-11 sm:mx-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:px-12 lg:pb-16 lg:pt-16 xl:mx-auto">
        <div className="rb-copy-pane flex max-w-[520px] flex-col gap-5 rounded-[26px] p-5 sm:p-6 lg:pl-7">
          <div className="rb-rise-in flex items-center gap-2.5" style={{ animationDelay: '0.05s' }}>
            <div className="h-[1.5px] w-7 bg-brand" />
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand">AI career prep for students</span>
          </div>
          <h1 className="rb-rise-in m-0 font-serif tracking-tight" style={{ animationDelay: '0.12s' }}>
            <span className="block text-[29px] font-medium leading-tight text-ink sm:text-[34px]">Practice smarter.</span>
            <span className="mt-1 block text-[52px] font-bold leading-[0.93] text-ink sm:text-[72px] lg:text-[76px]">Interview<br />better<span className="text-brand">.</span></span>
          </h1>
          <p className="rb-rise-in max-w-[430px] font-sans text-[15px] leading-[1.75] text-ink/62" style={{ animationDelay: '0.2s' }}>
            Build confidence with realistic AI interviews, instant coaching, and a clear view of how you&apos;re improving.
          </p>
          <div className="rb-rise-in flex flex-wrap items-center gap-5 pt-1" style={{ animationDelay: '0.28s' }}>
            <PressButton primary href="/get-started" className="px-6 py-3.5">Get Started — It&apos;s Free</PressButton>
            <Link href="#how-it-works" className="flex items-center gap-2 border-b border-ink pb-0.5 font-sans text-[13px] font-bold text-ink transition-colors hover:border-brand hover:text-brand">See how it works <Icon name="arrow" className="h-3 w-3" /></Link>
          </div>
          <div className="rb-rise-in mt-3 flex items-center gap-5 border-t border-ink/[0.08] pt-4 sm:gap-7" style={{ animationDelay: '0.36s' }}>
            {[['10 min', 'to start'], ['24/7', 'AI feedback'], ['1 place', 'to track growth']].map(([value, label]) => (
              <div key={value}><p className="font-serif text-[17px] font-bold text-ink">{value}</p><p className="mt-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-ink/42">{label}</p></div>
            ))}
          </div>
        </div>

        <PracticeWorkspace />
      </section>

      <section className="relative z-[3] mx-auto -mt-5 max-w-[1100px] px-6 pb-8">
        <div className="rb-signal-strip grid overflow-hidden rounded-[20px] sm:grid-cols-3">
          {[
            ['01', 'Practice', 'Role-specific questions that adapt to you'],
            ['02', 'Get coached', 'Clear feedback while the moment is fresh'],
            ['03', 'Run it back', 'See the progress and sharpen your story'],
          ].map(([number, title, copy], index) => (
            <div key={number} className={`flex gap-4 px-5 py-5 sm:px-6 ${index ? 'border-t border-white/70 sm:border-l sm:border-t-0' : ''}`}>
              <span className="font-sans text-[10px] font-bold text-brand/45">{number}</span>
              <div><p className="font-serif text-[15px] font-bold">{title}</p><p className="mt-1 font-sans text-[11px] leading-relaxed text-ink/50">{copy}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="rb-section-glass relative z-[2] mx-3 my-16 max-w-[1160px] scroll-mt-8 rounded-[32px] px-6 py-14 sm:mx-5 sm:px-9 sm:py-16 xl:mx-auto">
        <div className="mb-9 grid items-end gap-5 md:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand">One connected practice loop</p>
            <h2 className="mt-3 max-w-[600px] font-serif text-[36px] font-bold leading-[1.04] tracking-tight text-ink sm:text-[48px]">Everything you need to show up ready.</h2>
          </div>
          <p className="max-w-[420px] font-sans text-sm leading-relaxed text-ink/55 md:justify-self-end">No scattered notes or vague scores. Runback turns every practice session into a clear next step.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <FeatureCard icon="practice" eyebrow="Practice" title="Mock interviews" copy="Real-world questions with an AI interviewer that adapts to your target role and experience." href="/get-started" className="min-h-[285px] lg:col-span-2 lg:row-span-2 lg:min-h-[430px]" />
          <FeatureCard icon="resume" eyebrow="Polish" title="Resume review" copy="Turn generic bullets into sharper proof of impact." href="/get-started" tone="mist" className="min-h-[240px]" />
          <FeatureCard icon="progress" eyebrow="Improve" title="Readiness tracking" copy="See the skills getting stronger after every run." href="/profile" tone="teal" className="min-h-[240px]" />
          <Link href="/how-it-works" className="rb-feature-card group relative flex min-h-[180px] items-center justify-between overflow-hidden rounded-[24px] bg-white/52 p-5 text-ink lg:col-span-2">
            <div><p className="font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-brand">Your next move</p><h3 className="mt-1.5 max-w-[340px] font-serif text-xl font-bold">A focused action plan after every session.</h3></div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform duration-300 group-hover:translate-x-1"><Icon name="arrow" className="h-4 w-4" /></span>
          </Link>
        </div>
      </section>

      <section className="rb-cta-glass relative z-[2] mx-6 mb-16 max-w-[1100px] overflow-hidden rounded-[28px] px-6 py-8 text-white sm:mx-auto sm:px-9 sm:py-10">
        <div className="absolute -right-12 -top-28 h-72 w-72 rounded-full bg-volt/18 blur-[50px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/teal-glass/logo/runback-glass-monogram.png" alt="" className="pointer-events-none absolute -bottom-20 right-[12%] hidden w-[280px] rotate-[-8deg] opacity-20 sm:block" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div><p className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-volt">Ready when you are</p><h2 className="mt-2 max-w-[540px] font-serif text-2xl font-bold sm:text-[32px]">Your future starts with one good practice run.</h2><p className="mt-2 font-sans text-[12.5px] text-white/68">Start free. Get feedback in minutes.</p></div>
          <Link href="/get-started" className="flex shrink-0 items-center gap-2 rounded-[12px] bg-white px-5 py-3.5 font-sans text-[13px] font-bold text-brand shadow-[0_10px_24px_rgba(0,0,0,0.12)]">Start practicing <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      <footer className="relative z-[2] pb-9 text-center"><p className="font-sans text-[11px] text-ink/40">© 2026 Runback&nbsp;&nbsp;·&nbsp;&nbsp;Built for students, by students</p></footer>
    </main>
  )
}
