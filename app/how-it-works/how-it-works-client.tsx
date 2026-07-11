'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  )
}

// Heroicon-style outline paths (same set used across the app)
const ICONS = {
  briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  question: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  mic: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  lightning: 'M13 10V3L4 14h7v7l9-11h-7z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  trendUp: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  chevronDown: 'M19 9l-7 7-7-7',
  arrowRight: 'M13 7l5 5m0 0l-5 5m5-5H6',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

type Step = {
  icon: string
  tile: string       // icon tile colors
  title: string
  summary: string
  optional?: boolean
  you: string
  ai: string
  why: string
  coach?: string
}

const STEPS: Step[] = [
  {
    icon: ICONS.briefcase,
    tile: 'bg-indigo-500/15 text-indigo-400',
    title: 'Tell us where you’re headed',
    summary: 'Pick your interview type and name the company and role you want.',
    you: 'Choose your interview type — Finance, Consulting, Tech, and 14 more, including casual Coffee Chats — then enter the company and role you’re going after, along with your first name and email.',
    ai: 'Interview AI uses those details to build an interview for that exact room. A consulting interview shouldn’t feel like a sales interview, and yours won’t.',
    why: 'Generic prep gets generic results. When you rehearse for the actual company and role, the questions you practice are the kind you’ll actually hear.',
  },
  {
    icon: ICONS.document,
    tile: 'bg-emerald-500/15 text-emerald-400',
    title: 'Add your resume, if you’d like',
    summary: 'Drop in a PDF and your questions get built around your real experience.',
    optional: true,
    you: 'Drag in your resume as a PDF — or skip this step entirely. If you upload one, you can also get it scored on clarity, impact, relevance, and ATS-friendliness, plus a bullet-by-bullet rewrite guide.',
    ai: 'Your resume is read right in your browser — the file never leaves your device, only the text is used — and your real experience gets woven into the questions you’ll face.',
    why: 'Real interviewers ask about your resume, not a template. Practicing questions built from your own story means nothing on that page can catch you off guard.',
  },
  {
    icon: ICONS.question,
    tile: 'bg-purple-500/15 text-purple-400',
    title: 'Meet your six questions',
    summary: 'Four behavioral, one role-specific, and one curveball — written just for you.',
    you: 'Hit Generate Interview and take a breath. Your questions are ready in a few seconds.',
    ai: 'Claude writes six questions tailored to you: four behavioral questions, one technical question specific to your target role, and one curveball to keep you on your toes.',
    why: 'That mix mirrors how real interviews actually flow. And the curveball teaches you something valuable — that you can handle a question you never saw coming.',
  },
  {
    icon: ICONS.mic,
    tile: 'bg-blue-500/15 text-blue-400',
    title: 'Answer like it’s the real thing',
    summary: 'Speak your answers out loud with a timer, your camera, and live filler-word tracking.',
    you: 'Answer each question out loud — your browser transcribes as you speak — or type if you’d rather. You’ll see yourself on camera, a two-minute timer, and your filler words counted as you go.',
    ai: 'Interview AI recreates the feel of the real thing: the clock, the camera, the sound of your own voice. The camera is only a mirror — nothing is ever recorded.',
    why: 'An answer that sounds perfect in your head often falls apart out loud. Practicing under a little pressure now is exactly what makes you calm under real pressure later.',
    coach: 'Coach’s note: speaking your answers matters more than you’d think. It builds the muscle memory that makes you sound natural when the stakes are real.',
  },
  {
    icon: ICONS.lightning,
    tile: 'bg-amber-500/15 text-amber-400',
    title: 'Get feedback while it’s fresh',
    summary: 'Every answer gets a score, one strength, and one fix — before the next question.',
    you: 'Submit your answer, read what worked and what to sharpen, then either try the question again or keep moving.',
    ai: 'Each answer is scored out of 10 with the single most effective thing you did and the single most important thing to fix — right after you finish, while you still remember exactly what you said.',
    why: 'Feedback in the moment is how skills actually stick. And Try Again means you can nail a question before moving on — no waiting for a rejection email to learn what went wrong.',
  },
  {
    icon: ICONS.chart,
    tile: 'bg-green-500/15 text-green-400',
    title: 'See your whole performance clearly',
    summary: 'A full report: scores, STAR analysis, your blind spot, and exactly what to fix.',
    you: 'Finish your sixth question, then let Interview AI review the whole interview.',
    ai: 'Every answer is graded on clarity, confidence, structure, and relevance, and checked against the STAR method. You get your filler-word count, a blind spot you probably didn’t know you had, your three biggest mistakes, three key improvements, and an example of a stronger answer. The whole report lands in your inbox too.',
    why: 'You stop guessing. Instead of a vague feeling that it “went okay,” you know precisely what to work on before it ever costs you an offer.',
    coach: 'Coach’s note: STAR stands for Situation, Task, Action, Result — the structure interviewers listen for in behavioral answers. Your report shows exactly which parts you nailed and which you skipped.',
  },
  {
    icon: ICONS.trendUp,
    tile: 'bg-indigo-500/15 text-indigo-400',
    title: 'Come back and beat your score',
    summary: 'Your scores are charted over time, so you can watch yourself get better.',
    you: 'Practice again — retry the same interview, or start a fresh one for the next company on your list.',
    ai: 'Your recent sessions are saved in your browser, and your scores are charted over time so you can see clarity, confidence, structure, and relevance climb.',
    why: 'Confidence isn’t a personality trait — it’s evidence. A rising line on that chart is proof, in your own numbers, that you’re getting better. Walk into the real interview carrying that.',
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is it free?',
    a: 'Yes — completely free right now. No credit card, no trial, no catch. Just practice.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There’s no sign-up at all. Your first name and email are only used to personalize your session and send your results report.',
  },
  {
    q: 'What happens to my resume?',
    a: 'It’s read directly in your browser — the PDF itself is never uploaded or stored. Only the extracted text is used to tailor your questions and, if you ask for it, grade your resume.',
  },
  {
    q: 'Do I have to answer out loud?',
    a: 'No. You can speak your answers (your browser transcribes them live) or type them — whichever feels right. Voice needs a browser with speech recognition, and typing always works.',
  },
  {
    q: 'Is my camera recording me?',
    a: 'No. The camera is a mirror so you can practice your presence — the video never leaves your device and is never recorded.',
  },
  {
    q: 'Are my interviews saved?',
    a: 'Your recent sessions — up to 20 — are saved in your browser so you can track your progress, and your full results report is emailed to you after each interview.',
  },
  {
    q: 'How is my answer scored?',
    a: 'Each answer is scored out of 10 on clarity, confidence, structure, and relevance, checked against the STAR method, and analyzed for filler words. You get per-question scores plus an overall score and grade.',
  },
  {
    q: 'Can I redo a question or an interview?',
    a: 'Yes to both. Try Again lets you re-answer any question right after seeing its feedback, and Retry Interview runs the whole interview again from your results page.',
  },
  {
    q: 'How long does it take?',
    a: 'Six questions with a two-minute timer each — most sessions fit comfortably in about 15 minutes. Short enough to do between classes, long enough to actually get better.',
  },
]

const startButtonClass =
  'inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/25'

export default function HowItWorksClient() {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([0]))
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const heroCtaRef = useRef<HTMLDivElement>(null)

  const toggleStep = (i: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // Reveal the sticky CTA only after the hero CTA scrolls out of view
  useEffect(() => {
    const target = heroCtaRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Top bar */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <LogoMark className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">Interview AI</span>
        </Link>
        <span className="text-sm text-gray-500">How It Works</span>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-28 space-y-16">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 mb-5">
            <Icon d={ICONS.info} className="w-3.5 h-3.5" />
            How it works
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight mb-4">
            Your first interview shouldn&rsquo;t be the real one.
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-xl mx-auto mb-8">
            Walking into an interview cold is scary — so don&rsquo;t. Interview AI gives you a place
            to run the whole thing, out loud, with honest feedback after every answer. By the time
            the real interview comes around, it won&rsquo;t be your first.
          </p>

          {/* "Ahead of 90%" callout */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gray-900/60 backdrop-blur-sm shadow-lg shadow-black/20 text-left mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative px-6 py-5 flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Icon d={ICONS.trendUp} className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">
                  You&rsquo;re already ahead of 90% of people.
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Most candidates walk in and hope it goes well. You&rsquo;re here, choosing to
                  prepare on purpose. That one decision puts you ahead of almost everyone else
                  applying — and you haven&rsquo;t even started yet. Be proud of that.
                </p>
              </div>
            </div>
          </div>

          <div ref={heroCtaRef} className="flex flex-col items-center gap-3">
            <Link href="/" className={startButtonClass}>
              Start Practicing
              <Icon d={ICONS.arrowRight} className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-600">
              Free&nbsp;&nbsp;·&nbsp;&nbsp;No account needed&nbsp;&nbsp;·&nbsp;&nbsp;About 15 minutes
            </p>
          </div>
        </section>

        {/* ── At-a-glance stats ─────────────────────────────────── */}
        <section aria-label="Interview at a glance" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: '6', label: 'questions, tailored to you' },
            { value: '2:00', label: 'on the clock per answer' },
            { value: '17', label: 'interview types to choose from' },
            { value: '4', label: 'dimensions scored per answer' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 text-center shadow-lg shadow-black/20">
              <p className="text-2xl font-bold text-indigo-400 tabular-nums mb-1">{value}</p>
              <p className="text-xs text-gray-500 leading-snug">{label}</p>
            </div>
          ))}
        </section>

        {/* ── Step-by-step walkthrough ──────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Your practice interview, step by step
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Seven steps, no surprises. Here&rsquo;s exactly what happens when you hit Start
              Practicing — and why every step makes you better.
            </p>
          </div>

          <ol className="space-y-0">
            {STEPS.map((step, i) => {
              const isOpen = openSteps.has(i)
              const bodyId = `step-body-${i}`
              return (
                <li key={step.title} className="relative flex gap-4 pb-4 last:pb-0">
                  {/* Timeline connector */}
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="absolute left-[19px] top-12 bottom-0 w-px bg-gray-800" />
                  )}
                  {/* Step number node */}
                  <div
                    className={`relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200 ${
                      isOpen
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-gray-900 border border-gray-700/60 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </div>

                  {/* Step card */}
                  <div className="flex-1 min-w-0 bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
                    <button
                      type="button"
                      onClick={() => toggleStep(i)}
                      aria-expanded={isOpen}
                      aria-controls={bodyId}
                      className="w-full flex items-center gap-3 px-4 py-3.5 sm:px-5 hover:bg-gray-800/40 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${step.tile}`}>
                        <Icon d={step.icon} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                          {step.optional && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{step.summary}</p>
                      </div>
                      <Icon
                        d={ICONS.chevronDown}
                        className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div id={bodyId} className="border-t border-gray-700/50 bg-gray-950/60 px-4 py-4 sm:px-5 flex flex-col gap-4">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            What you do
                          </p>
                          <p className="text-sm text-gray-300 leading-relaxed">{step.you}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            What Interview AI does
                          </p>
                          <p className="text-sm text-gray-300 leading-relaxed">{step.ai}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Why this helps you
                          </p>
                          <p className="text-sm text-gray-300 leading-relaxed">{step.why}</p>
                        </div>
                        {step.coach && (
                          <div className="flex gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-3 py-2">
                            <Icon d={ICONS.info} className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-indigo-300 leading-relaxed">{step.coach}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Questions you might be wondering about
            </h2>
            <p className="text-gray-500 text-sm">
              Straight answers, so nothing stands between you and your first practice run.
            </p>
          </div>

          <div className="border border-gray-700/50 rounded-2xl overflow-hidden divide-y divide-gray-700/50 shadow-lg shadow-black/20">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i
              const bodyId = `faq-body-${i}`
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 bg-gray-900/80 hover:bg-gray-800/70 transition-colors text-left"
                  >
                    <h3 className="text-sm font-medium text-gray-200">{faq.q}</h3>
                    <Icon
                      d={ICONS.chevronDown}
                      className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div id={bodyId} className="bg-gray-950 px-4 py-4 sm:px-5">
                      <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Closing: skill, not talent ────────────────────────── */}
        <section>
          <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gray-900/60 backdrop-blur-sm shadow-xl shadow-black/30">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-green-500/5 pointer-events-none" />
            <div className="relative px-6 py-8 sm:px-10 sm:py-10 text-center">
              {/* Rising-score illustration */}
              <svg viewBox="0 0 200 60" className="w-40 mx-auto mb-6" aria-hidden="true">
                <polyline
                  points="10,50 55,42 100,30 145,20 190,8"
                  fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                />
                {[
                  { x: 10, y: 50 }, { x: 55, y: 42 }, { x: 100, y: 30 }, { x: 145, y: 20 },
                ].map((p) => (
                  <g key={p.x}>
                    <circle cx={p.x} cy={p.y} r="4.5" fill="#111827" stroke="#6366f1" strokeWidth="2" />
                    <circle cx={p.x} cy={p.y} r="2" fill="#818cf8" />
                  </g>
                ))}
                <circle cx="190" cy="8" r="5.5" fill="#111827" stroke="#4ade80" strokeWidth="2" />
                <circle cx="190" cy="8" r="2.5" fill="#4ade80" />
              </svg>

              <h2 className="text-2xl font-bold text-white tracking-tight mb-4">
                Nobody is born good at interviews.
              </h2>
              <p className="text-gray-400 leading-relaxed max-w-xl mx-auto mb-3">
                The people who seem effortless in interviews aren&rsquo;t naturals — they&rsquo;re
                rehearsed. Interviewing is a skill, exactly like a sport or an instrument: awkward
                the first time, noticeably better the tenth. Every session you run here is a rep,
                and every rep makes the real thing feel less like a test and more like a
                conversation you&rsquo;ve already had.
              </p>
              <p className="text-gray-300 font-medium max-w-xl mx-auto">
                You don&rsquo;t need to be impressive today. You just need to start — and you
                already have.
              </p>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section className="text-center">
          <h2 className="text-xl font-bold text-white tracking-tight mb-2">
            Your first practice interview is waiting.
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Fifteen minutes from now, you&rsquo;ll know exactly where you stand.
          </p>
          <Link href="/" className={startButtonClass}>
            Start Practicing
            <Icon d={ICONS.arrowRight} className="w-4 h-4" />
          </Link>
        </section>

        {/* Footer */}
        <footer className="pt-4 text-center">
          <p className="text-xs text-gray-700">
            © 2026 Interview AI&nbsp;&nbsp;·&nbsp;&nbsp;Built for students, by students&nbsp;&nbsp;·&nbsp;&nbsp;
            <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
          </p>
        </footer>
      </main>

      {/* ── Sticky CTA bar ──────────────────────────────────────── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-300 motion-reduce:transition-none ${
          showSticky ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gray-950/90 backdrop-blur-md border-t border-white/[0.06] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400 hidden sm:block">
              Ready when you are — your first session takes about 15 minutes.
            </p>
            <Link href="/" className={`${startButtonClass} w-full sm:w-auto py-2.5 text-sm`}>
              Start Practicing
              <Icon d={ICONS.arrowRight} className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
