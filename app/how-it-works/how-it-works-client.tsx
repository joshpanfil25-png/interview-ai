'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NavAuth } from '@/components/auth/NavAuth'

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M11 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 11 5.5z" />
      <path d="M22 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 22 5.5z" />
    </svg>
  )
}

type Step = {
  title: string
  summary: string
  optional?: boolean
  you: string
  runback: string
  why: string
  coach?: string
}

const STEPS: Step[] = [
  {
    title: 'Set up your session',
    summary: 'Pick your interview type, focus, and difficulty — then name your target.',
    you: 'Choose from 40+ interview types — Finance, Consulting, Software Engineering, Nursing, grad-school admissions, even casual Coffee Chats. Set your Question Focus (Balanced, Behavioral-Heavy, or Technical-Heavy) and Difficulty (Easy, Medium, or Hard), then enter the company and role you’re going after — or the school and program, for admissions — plus your first name and email.',
    runback: 'Runback uses every one of those choices to build an interview for that exact room. A consulting case round shouldn’t feel like a sales interview, and an Easy warm-up shouldn’t feel like a senior-track grilling — so they don’t.',
    why: 'Generic prep gets generic results. When your reps are calibrated to the actual company, role, and level, the questions you practice are the kind you’ll actually hear.',
  },
  {
    title: 'Add your resume, if you’d like',
    summary: 'Upload a PDF or paste the text — your questions get built from your real experience.',
    optional: true,
    you: 'Drag in your resume as a PDF, or paste the text directly — or skip this step entirely. While you’re at it, you can get your resume scored on clarity, impact, relevance, and ATS-friendliness, plus a bullet-by-bullet rewrite guide.',
    runback: 'Your PDF is read right in your browser, and the text is used to ground your questions in your real experience — a named project, a listed skill, a past role. If you’re signed in, Runback also saves your resume to your account so it auto-fills next session; you can replace it anytime or delete it from your profile.',
    why: 'Real interviewers ask about your resume, not a template. Practicing questions built from your own story means nothing on that page can catch you off guard.',
  },
  {
    title: 'Get your six questions',
    summary: 'A realistic set written for your target — not pulled from a question bank.',
    you: 'Hit the button and take a breath. Your six questions are ready in about a minute.',
    runback: 'Runback writes six questions from scratch for your exact setup. The default mix is four behavioral, one role-specific, and one curveball — tilt the focus and you’ll get more behavioral or more technical instead. Every set is checked a second time for questions that are repetitive, off-level, or unrealistic before you see it.',
    why: 'That mix mirrors how real interviews actually flow. And the curveball teaches you something valuable — that you can handle a question you never saw coming.',
  },
  {
    title: 'Do the rep',
    summary: 'Answer out loud with a timer, your camera, and your filler words counted live.',
    you: 'Answer each question out loud — your browser transcribes as you speak — or type if you’d rather. You’ll see yourself on camera, a two-minute clock, and a live count of your filler words.',
    runback: 'Runback recreates the feel of the real thing: the clock, the camera, the sound of your own voice. The camera is only a mirror — nothing is ever recorded.',
    why: 'An answer that sounds perfect in your head often falls apart out loud. Practicing under a little pressure now is exactly what makes you calm under real pressure later.',
    coach: 'Coach’s note: speaking your answers matters more than you’d think. It builds the muscle memory that makes you sound natural when the stakes are real.',
  },
  {
    title: 'Get feedback while it’s fresh',
    summary: 'Every answer gets a score, one strength, and one fix — before the next question.',
    you: 'Submit your answer, read what worked and what to sharpen, then either run that question back or keep moving.',
    runback: 'Each answer is scored out of 10 with the single most effective thing you did and the single most important thing to fix — right after you finish, while you still remember exactly what you said.',
    why: 'Feedback in the moment is how skills actually stick. And Try Again means you can nail a question before moving on — no waiting for a rejection email to learn what went wrong.',
  },
  {
    title: 'See your whole performance clearly',
    summary: 'A full report: scores, STAR analysis, your blind spot, and exactly what to fix.',
    you: 'Finish your sixth question, then let Runback review the whole mock.',
    runback: 'Every answer is graded on clarity, confidence, structure, and relevance, and checked against the STAR method. You get your filler-word count and fluency score, a blind spot you probably didn’t know you had, how you stack up against a benchmark for your field, your three biggest mistakes, three key improvements, and an example of a stronger answer. The whole report lands in your inbox too.',
    why: 'You stop guessing. Instead of a vague feeling that it “went okay,” you know precisely what to work on before it ever costs you an offer.',
    coach: 'Coach’s note: STAR stands for Situation, Task, Action, Result — the structure interviewers listen for in behavioral answers. Your report shows exactly which parts you nailed and which you skipped.',
  },
  {
    title: 'Run it back',
    summary: 'Your scores are charted over time, so you can watch yourself get better.',
    you: 'Practice again — retry the same mock, or start a fresh one for the next company on your list.',
    runback: 'Your recent sessions are saved in your browser and charted on the home page so you can watch your scores climb. Sign in and every mock is also kept on your profile, across devices.',
    why: 'Confidence isn’t a personality trait — it’s evidence. A rising line on that chart is proof, in your own numbers, that you’re getting better. Walk into the real interview carrying that.',
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is it free?',
    a: 'Yes — Runback is free for students right now. There’s no payment step anywhere in the app.',
  },
  {
    q: 'Do I need an account?',
    a: 'No — you can run a full mock without signing up. Signing in with Google is optional: it saves your interview history to your profile across devices and remembers your resume so it auto-fills next time.',
  },
  {
    q: 'What happens to my resume?',
    a: 'Your PDF is read directly in your browser (or you can paste the text). The text is used to tailor your questions and, if you ask for it, grade your resume. If you’re signed in, it’s saved to your account so it auto-fills your next session — you can delete it from your profile anytime. If you’re not signed in, it isn’t saved to any account.',
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
    q: 'Are my mocks saved?',
    a: 'Your recent sessions — up to 20 — are saved in your browser and charted on the home page. Sign in and your mocks are also kept on your profile across devices. Your full results report is emailed to you after each session either way.',
  },
  {
    q: 'How is my answer scored?',
    a: 'Each answer is scored out of 10 on clarity, confidence, structure, and relevance, checked against the STAR method, and analyzed for filler words. You get per-question scores plus an overall score and grade.',
  },
  {
    q: 'Can I redo a question or a whole mock?',
    a: 'Yes to both. Try Again lets you re-answer any question right after seeing its feedback, and Retry Interview runs the whole mock again from your results page.',
  },
  {
    q: 'How long does a session take?',
    a: 'Six questions with a two-minute timer each — most sessions fit comfortably in about 15 minutes. Short enough to do between classes, long enough to actually get better.',
  },
]

const ctaClass =
  'inline-flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-hover text-blacktop font-semibold text-sm px-6 py-3 rounded-md ring-1 ring-inset ring-black/10 shadow-[0_8px_20px_rgba(13,95,99,0.25)] hover:shadow-[0_10px_26px_rgba(13,95,99,0.32)] transition-all'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-ink-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function HowItWorksClient() {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([0]))
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleStep = (i: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Header — matches /profile */}
      <header className="border-b border-line">
        <nav className="max-w-[1000px] mx-auto w-full flex items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-brand shadow-[0_0_24px_rgba(13,95,99,0.35)]">
              <LogoMark className="w-5 h-5 text-blacktop" />
            </div>
            <span className="font-display text-[22px] font-black text-cream">runback</span>
          </Link>
          <NavAuth />
        </nav>
      </header>

      <main className="flex-1 max-w-[760px] mx-auto w-full px-6 py-12 space-y-14">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 bg-[rgba(31,37,43,0.05)] border border-line rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-volt" />
            <span className="text-xs text-ink-muted">How it works</span>
          </div>

          <h1 className="font-display text-[34px] sm:text-[48px] font-black leading-[1.0] tracking-tight text-cream mb-5">
            THE INTERVIEW<br />
            <span className="text-brand">BEFORE</span> THE INTERVIEW.
          </h1>

          <p className="text-ink-muted leading-relaxed max-w-[520px] mx-auto mb-8">
            Walking into an interview cold is scary — so don&rsquo;t. Runback gives you a place to
            run the whole thing, out loud, with honest feedback after every answer. By the time the
            real one comes around, it won&rsquo;t be your first.
          </p>

          {/* "Ahead of 90%" encouragement */}
          <div className="relative bg-surface border border-line rounded-2xl p-6 overflow-hidden text-left mb-8">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#0D5F63,#A8E0DD)' }} />
            <p className="font-display font-black text-lg text-cream tracking-tight mb-1.5">
              You&rsquo;re already ahead of 90% of people.
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">
              Most candidates walk in and hope it goes well. You&rsquo;re here, choosing to prepare
              on purpose. That one decision puts you ahead of almost everyone else applying — and
              you haven&rsquo;t even started yet. Be proud of that.
            </p>
          </div>

          <Link href="/" className={ctaClass}>
            Start practicing
            <LogoMark className="w-3.5 h-3.5" />
          </Link>
          <p className="text-xs text-ink-muted/60 mt-3">
            Free for students&nbsp;&nbsp;·&nbsp;&nbsp;No account required&nbsp;&nbsp;·&nbsp;&nbsp;About 15 minutes
          </p>
        </section>

        {/* ── Scoreboard ───────────────────────────────────────── */}
        <section aria-label="A session at a glance">
          <div className="flex border border-line rounded-2xl overflow-hidden w-full">
            <div className="flex-1 border-r border-line px-3 sm:px-5 py-4 text-center">
              <p className="font-display font-black text-2xl sm:text-3xl text-volt">6</p>
              <p className="text-xs text-ink-muted mt-1">questions per mock</p>
            </div>
            <div className="flex-1 border-r border-line px-3 sm:px-5 py-4 text-center">
              <p className="font-display font-black text-2xl sm:text-3xl text-cream">2:00</p>
              <p className="text-xs text-ink-muted mt-1">on the clock per answer</p>
            </div>
            <div className="flex-1 px-3 sm:px-5 py-4 text-center">
              <p className="font-display font-black text-2xl sm:text-3xl text-brand">40+</p>
              <p className="text-xs text-ink-muted mt-1">interview types</p>
            </div>
          </div>
        </section>

        {/* ── Step-by-step walkthrough ─────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="font-display font-black text-2xl text-cream tracking-tight mb-2">
              Your mock, step by step
            </h2>
            <p className="text-sm text-ink-muted max-w-[480px] mx-auto">
              Seven steps, no surprises. Here&rsquo;s exactly what happens when you start a session
              — and why every step makes you better.
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
                    <span aria-hidden className="absolute left-[17px] top-11 bottom-0 w-px bg-[rgba(31,37,43,0.12)]" />
                  )}
                  {/* Step number node */}
                  <div
                    className={`relative z-[1] shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm transition-colors duration-200 ${
                      isOpen
                        ? 'bg-brand text-blacktop shadow-[0_0_16px_rgba(13,95,99,0.3)]'
                        : 'bg-surface border border-line text-ink-muted'
                    }`}
                  >
                    {i + 1}
                  </div>

                  {/* Step card */}
                  <div className="flex-1 min-w-0 bg-surface border border-line rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleStep(i)}
                      aria-expanded={isOpen}
                      aria-controls={bodyId}
                      className="w-full flex items-center gap-3 px-4 py-3.5 sm:px-5 hover:bg-[rgba(31,37,43,0.04)] transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-cream">{step.title}</h3>
                          {step.optional && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(31,37,43,0.05)] text-ink-muted border border-line">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">{step.summary}</p>
                      </div>
                      <Chevron open={isOpen} />
                    </button>

                    {isOpen && (
                      <div id={bodyId} className="border-t border-line bg-surface-inset px-4 py-4 sm:px-5 flex flex-col gap-4">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                            What you do
                          </p>
                          <p className="text-sm text-ink/80 leading-relaxed">{step.you}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-volt" />
                            What Runback does
                          </p>
                          <p className="text-sm text-ink/80 leading-relaxed">{step.runback}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Why this helps you
                          </p>
                          <p className="text-sm text-ink/80 leading-relaxed">{step.why}</p>
                        </div>
                        {step.coach && (
                          <div className="rounded-md px-3 py-2.5 text-xs bg-brand/[0.08] border border-brand/25 text-brand leading-relaxed">
                            {step.coach}
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

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="font-display font-black text-2xl text-cream tracking-tight mb-2">
              Questions you might be wondering about
            </h2>
            <p className="text-sm text-ink-muted">
              Straight answers, so nothing stands between you and your first rep.
            </p>
          </div>

          <div className="border border-[rgba(31,37,43,0.08)] rounded-lg overflow-hidden divide-y divide-[rgba(31,37,43,0.06)]">
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
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 bg-surface hover:bg-[rgba(31,37,43,0.04)] transition-colors text-left"
                  >
                    <h3 className="text-sm font-medium text-ink">{faq.q}</h3>
                    <Chevron open={isOpen} />
                  </button>
                  {isOpen && (
                    <div id={bodyId} className="bg-surface-inset px-4 py-4 sm:px-5">
                      <p className="text-sm text-ink-muted leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Closing: skill, not talent ───────────────────────── */}
        <section>
          <div className="relative bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#0D5F63,#A8E0DD)' }} />
            <div className="px-6 py-8 sm:px-10 sm:py-10 text-center">
              <h2 className="font-display font-black text-2xl text-cream tracking-tight mb-4">
                Nobody is born good at interviews.
              </h2>
              <p className="text-ink-muted leading-relaxed max-w-[520px] mx-auto mb-3">
                The people who seem effortless in interviews aren&rsquo;t naturals — they&rsquo;re
                rehearsed. Interviewing is a skill, exactly like a sport or an instrument: awkward
                the first time, noticeably better the tenth. Every session is a rep, and every rep
                makes the real thing feel less like a test and more like a conversation
                you&rsquo;ve already had.
              </p>
              <p className="text-ink/80 font-medium max-w-[520px] mx-auto mb-7">
                You don&rsquo;t need to be impressive today. You just need to start — and you
                already have.
              </p>
              <Link href="/" className={ctaClass}>
                Start practicing
                <LogoMark className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pb-4 text-center">
          <p className="text-xs text-ink-muted/60">© 2026 Runback&nbsp;&nbsp;·&nbsp;&nbsp;Built for students, by students</p>
        </footer>
      </main>
    </div>
  )
}
