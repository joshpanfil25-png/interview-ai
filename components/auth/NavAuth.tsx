'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/lib/useUser'
import { signOut } from '@/lib/authActions'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

/**
 * Nav auth control (Phase 2). Optional — never gates anything.
 * - loading  → renders nothing (avoids a flash of the wrong state)
 * - guest    → compact "Sign in" Google button
 * - signed in→ name + dropdown with email and "Sign out"
 */
export function NavAuth() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (loading) return null

  if (!user) {
    return <GoogleSignInButton label="Sign in" compact />
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string }
  const name = meta.full_name || meta.name || user.email || 'Account'
  const first = name.split(' ')[0]
  const initial = (name[0] || '?').toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-line-hover rounded-lg pl-1.5 pr-2.5 py-1.5 text-sm text-cream hover:border-brand transition-colors"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand text-blacktop text-xs font-bold">
          {initial}
        </span>
        <span className="max-w-[120px] truncate">{first}</span>
        <svg className={`w-3.5 h-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-surface shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-20">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-xs text-ink-muted">Signed in as</p>
            <p className="text-sm text-cream truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); signOut() }}
            className="w-full text-left px-4 py-2.5 text-sm text-cream hover:bg-white/[0.04] transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
