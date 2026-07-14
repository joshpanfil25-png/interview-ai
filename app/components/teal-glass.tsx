'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Shared "Teal Glass" rebrand primitives, reused across the Marketing,
 * Login, Get Started, Dashboard, and Profile screens. Recreated from the
 * design handoff's inline-style JSX references using this codebase's own
 * Tailwind-utility-classes-in-JSX convention.
 */

export function Glass({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-[rgba(255,255,255,0.5)] backdrop-blur-[26px] border border-[rgba(255,255,255,0.85)] shadow-[0_16px_40px_rgba(31,37,43,0.07),inset_0_1px_0_rgba(255,255,255,0.95)] box-border ${className}`}
    >
      {children}
    </div>
  )
}

export function GlassWordmark({ className = 'text-lg' }: { className?: string }) {
  return <span className={`rb-wordmark ${className}`}>Runback</span>
}

/**
 * Runback brand mark — the "rewind" double-chevron (◀◀, "run it back"), in
 * Carbon Teal via the brand token. Same shape as the favicon so the tab mark
 * and the nav mark stay identical. (The glassy 3D "R" arrow remains hero-only
 * decorative art.)
 */
export function RunbackLogoChip({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Runback"
      className={`shrink-0 fill-brand ${className}`}
    >
      <path d="M11 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 11 5.5z" />
      <path d="M22 5.5v13a1 1 0 0 1-1.6.8l-8-6.5a1 1 0 0 1 0-1.6l8-6.5A1 1 0 0 1 22 5.5z" />
    </svg>
  )
}

export function TealBlob({ className = '', delay }: { className?: string; delay?: string }) {
  return (
    <div
      className={`rb-blob-flow absolute pointer-events-none blur-[2px] ${className}`}
      style={delay ? { animationDelay: delay } : undefined}
    />
  )
}

export function Ring({ value, size = 60 }: { value: number; size?: number }) {
  const r = 25
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value)) / 100
  const dash = `${(pct * circ).toFixed(1)} ${((1 - pct) * circ).toFixed(1)}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 60 60" className="-rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(31,37,43,0.08)" strokeWidth="6" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="#0D5F63" strokeWidth="6" strokeLinecap="round" strokeDasharray={dash} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif font-bold text-sm text-ink">
        {value}
      </div>
    </div>
  )
}

export function PressButton({
  children,
  onClick,
  primary = false,
  type = 'button',
  disabled = false,
  href,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  href?: string
  className?: string
}) {
  const [pressed, setPressed] = useState(false)

  const base = primary
    ? 'bg-brand hover:bg-brand-hover text-white shadow-[0_8px_20px_rgba(13,95,99,0.25)] hover:shadow-[0_10px_26px_rgba(13,95,99,0.32)]'
    : 'bg-[rgba(255,255,255,0.6)] backdrop-blur-[10px] text-ink border border-[rgba(31,37,43,0.1)]'

  const classes = `inline-flex items-center justify-center gap-2 rounded-[10px] font-sans font-bold text-sm border-0 transition-transform duration-100 ease-out disabled:opacity-60 disabled:cursor-not-allowed ${pressed ? 'scale-[0.97]' : 'scale-100'} ${base} ${className}`

  const handlers = {
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
  }

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} {...handlers}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} {...handlers}>
      {children}
    </button>
  )
}

/** Shared frosted-glass top nav, used identically on Marketing and Profile. */
export function GlassNav({ children }: { children: React.ReactNode }) {
  return (
    <nav className="rb-glass-nav relative z-2 flex items-center justify-between gap-6 px-6 py-3.5 mx-5 mt-4 rounded-2xl">
      {children}
    </nav>
  )
}
