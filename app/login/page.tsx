'use client'

import { Glass, GlassWordmark, TealBlob } from '@/app/components/teal-glass'

// No Google OAuth exists in this codebase yet (no components/auth, no
// lib/authActions) — the button below is an honest non-functional
// placeholder for that not-yet-built feature, not a fake sign-in flow.
export default function Login() {
  return (
    <main className="relative min-h-screen overflow-hidden animate-fade-in bg-gradient-to-b from-white to-[#F1F4F6] flex items-center justify-center px-6">
      <TealBlob className="w-[420px] h-[420px] -top-30 -right-35 bg-gradient-to-br from-[rgba(168,224,221,0.35)] to-[rgba(13,95,99,0.05)]" />
      <TealBlob className="w-[300px] h-[300px] -bottom-25 -left-25 bg-gradient-to-br from-[rgba(13,95,99,0.06)] to-[rgba(168,224,221,0.2)]" delay="3s" />

      <Glass className="rb-rise-in relative z-2 w-[400px] max-w-full rounded-[20px] p-10 flex flex-col items-center gap-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/teal-glass/logo/runback-glass-monogram.png"
          alt="Runback"
          className="rb-float w-24 object-contain"
        />
        <div>
          <div className="font-serif text-[22px] font-bold text-ink">
            Sign in to <GlassWordmark className="text-[22px]" />
          </div>
          <p className="mt-2 text-sm text-ink/70 leading-relaxed">
            Keep your mock interview history and resume synced across every session.
          </p>
        </div>

        <button
          type="button"
          disabled
          title="Google sign-in isn't wired up yet — coming soon"
          className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1f1f1f] border border-[rgba(31,37,43,0.14)] rounded-[10px] px-4.5 py-3.5 text-[15px] font-semibold shadow-[0_4px_12px_rgba(31,37,43,0.06)] opacity-60 cursor-not-allowed"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/teal-glass/icons/google-g.svg" alt="" className="w-[18px] h-[18px]" />
          Continue with Google — coming soon
        </button>

        <div className="flex items-center gap-2.5 w-full">
          <div className="flex-1 h-px bg-[rgba(31,37,43,0.1)]" />
          <span className="text-xs text-ink/60">or</span>
          <div className="flex-1 h-px bg-[rgba(31,37,43,0.1)]" />
        </div>

        <a
          href="/get-started"
          className="w-full bg-brand hover:bg-brand-hover text-white rounded-[10px] px-4.5 py-3.5 text-[15px] font-bold shadow-[0_8px_20px_rgba(13,95,99,0.25)] hover:shadow-[0_10px_26px_rgba(13,95,99,0.32)] transition-all"
        >
          Continue as guest — start a mock
        </a>

        <p className="m-0 text-xs text-ink/60">
          No account required to practice. Sign in only to save your history and resume across devices.
        </p>
      </Glass>
    </main>
  )
}
