'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { loadHistory } from '@/lib/history'
import type { HistoryEntry } from '@/lib/history'
import type { ResumeGrade } from '@/app/api/grade-resume/route'
import type { ResumeRewriteGuide } from '@/app/api/rewrite-resume/route'
import type { LinkedInReview } from '@/app/api/review-linkedin/route'
import { NavAuth } from '@/components/auth/NavAuth'
import { useUser } from '@/lib/useUser'
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'
import { Glass, GlassWordmark, RunbackLogoChip, TealBlob } from '@/app/components/teal-glass'

// Order groups related verticals so the (now long) dropdown stays scannable.
// Every entry here must have a matching key in `verticalGuidance` in
// app/api/generate-questions/route.ts, and school-admissions entries must also
// be listed in SCHOOL_VERTICALS below (and in the route).
const INTERVIEW_TYPES = [
  'General',
  // Business, finance & professional services
  'Finance',
  'Investment Banking',
  'Private Equity',
  'Actuarial / Quant',
  'Consulting',
  'Accounting',
  'Audit',
  'Real Estate',
  // Product, engineering, data & design
  'Tech',
  'Software Engineering',
  'Engineering (Non-Software)',
  'Product Management',
  'Project / Program Management',
  'Data / Analytics',
  'Design (UX / Product)',
  'Cybersecurity',
  // Go-to-market, people & operations
  'Marketing',
  'Sales',
  'Customer Success',
  'Media / Journalism / PR',
  'Human Resources',
  'Operations',
  // Public sector, mission & service
  'Government',
  'Nonprofit',
  'Law / Legal',
  'Healthcare',
  'Nursing',
  'Medical Residency / Fellowship',
  'Social Work / Counseling',
  'Teaching / Education',
  'Aviation / Pilot',
  'Skilled Trades',
  'Retail / Hospitality',
  'Hospitality & Culinary Management',
  'Criminal Justice / Law Enforcement',
  // Arts, environment & the built world
  'Architecture / Urban Planning',
  'Fine & Performing Arts',
  'Environmental & Sustainability',
  // Founders & academia
  'Startup / Founder / VC',
  'Academia / Faculty',
  // School admissions (swaps Company/Role labels to School/Program)
  'Pre-Med / Health Professional School',
  'Pharmacy / Dental / Vet / PT School',
  'Pre-Law / Law School',
  'Business School / MBA',
  'Graduate School (General)',
  'Coffee Chat',
]

// Verticals that are school admissions interviews, not job interviews —
// swaps the Company/Role labels to School/Program. Keep in sync with
// SCHOOL_VERTICALS in app/api/generate-questions/route.ts.
const SCHOOL_VERTICALS = new Set([
  'Pre-Med / Health Professional School',
  'Pre-Law / Law School',
  'Graduate School (General)',
  'Business School / MBA',
  'Pharmacy / Dental / Vet / PT School',
])

const QUESTION_FOCUS_OPTIONS = ['Balanced', 'Behavioral-Heavy', 'Technical-Heavy'] as const
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'] as const

// Minimum number of extracted characters we treat as a usable resume. Below
// this we assume extraction failed (e.g. a scanned / image-only PDF with no
// text layer, or stray page-number noise) rather than a real resume.
// Tunable — revisit against real user data if we see false positives/negatives.
const MIN_RESUME_CHARS = 40

function hasUsableText(text: string): boolean {
  return text.trim().length >= MIN_RESUME_CHARS
}

const fieldClass =
  'w-full bg-[rgba(255,255,255,0.7)] border border-[rgba(31,37,43,0.14)] rounded-[10px] px-3.5 py-2.5 text-[14.5px] text-ink placeholder-[rgba(10,10,10,0.4)] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors'

export default function GetStarted() {
  const router = useRouter()
  const { user } = useUser()
  const [interviewType, setInterviewType] = useState('General')
  const [questionFocus, setQuestionFocus] = useState<(typeof QUESTION_FOCUS_OPTIONS)[number]>('Balanced')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>('Medium')
  const isSchoolVertical = SCHOOL_VERTICALS.has(interviewType)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [fileName, setFileName] = useState('')
  // Resume parse feedback, kept separate from the form-validation `error` line.
  const [resumeNotice, setResumeNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showManualPaste, setShowManualPaste] = useState(false)
  // Phase 4: true when the resume field was auto-filled from the logged-in
  // user's saved resume (drives the "Using your saved resume" indicator). Any
  // upload/paste/clear flips it off — they've overridden for this session.
  const [usingSavedResume, setUsingSavedResume] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Guards the one-shot saved-resume auto-fill: once the user uploads, pastes,
  // or clears, we never overwrite their choice with the saved resume.
  const resumeTouchedRef = useRef(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)

  // Resume grader state
  const [resumeGrade, setResumeGrade] = useState<ResumeGrade | null>(null)
  const [isGrading, setIsGrading] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [gradeError, setGradeError] = useState('')

  // Resume rewrite guide state
  const [rewriteGuide, setRewriteGuide] = useState<ResumeRewriteGuide | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewriteOpen, setRewriteOpen] = useState(false)
  const [rewriteError, setRewriteError] = useState('')

  // LinkedIn review state
  const [linkedinText, setLinkedinText] = useState('')
  const [linkedinReview, setLinkedinReview] = useState<LinkedInReview | null>(null)
  const [isReviewingLinkedin, setIsReviewingLinkedin] = useState(false)
  const [linkedinReviewOpen, setLinkedinReviewOpen] = useState(false)
  const [linkedinReviewError, setLinkedinReviewError] = useState('')

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setHistory(loadHistory().slice(0, 5))
  }, [])

  // Phase 4 — auto-fill a logged-in user's saved resume. Only prefills an
  // untouched field (nothing uploaded/pasted/cleared yet), so it never clobbers
  // an in-progress upload. Guests and users without a saved resume are
  // unaffected. Resilient to the resume_text column not existing yet
  // (pre-migration): any error is treated as "no saved resume".
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('resume_text')
          .eq('id', user.id)
          .single()
        if (!active || error) return
        const saved = data?.resume_text
        if (!saved || !hasUsableText(saved)) return
        if (resumeTouchedRef.current) return // user already provided/cleared one
        setResumeText(saved)
        setUsingSavedResume(true)
      } catch {
        /* no saved resume / column missing — leave the empty flow untouched */
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist')
    // Use the worker file copied to /public — avoids CDN version mismatch
    // pdfjs-dist 5.x ships only .mjs workers, so we reference the local copy
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdf = await loadingTask.promise
    let text = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      text += pageText + '\n'
    }

    return text.trim()
  }

  const handleFile = async (file: File) => {
    // Any upload overrides an auto-filled saved resume for this session.
    resumeTouchedRef.current = true
    setUsingSavedResume(false)
    if (file.type !== 'application/pdf') {
      setResumeNotice({ type: 'error', msg: 'That file isn’t a PDF. Upload a PDF resume, or paste your resume text instead.' })
      setShowManualPaste(true)
      return
    }
    // Clear prior resume + analysis state before parsing the new file so no
    // stale success/checkmark survives a failed parse.
    setResumeText('')
    setFileName('')
    setResumeNotice(null)
    resetAnalysisState()
    try {
      const text = await extractTextFromPdf(file)
      if (!hasUsableText(text)) {
        // pdfjs succeeded but found no usable text — almost always a scanned /
        // image-based PDF with no text layer. Do NOT store the junk, and do NOT
        // show a success checkmark.
        setResumeNotice({
          type: 'error',
          msg: 'We couldn’t read any text from this PDF — it looks scanned or image-based. Paste your resume text below instead.',
        })
        setShowManualPaste(true)
        return
      }
      setFileName(file.name)
      setResumeText(text)
      setResumeNotice({ type: 'success', msg: 'Resume loaded — we’ll tailor your questions to it.' })
    } catch (err) {
      console.error('PDF extraction error:', err)
      setResumeNotice({
        type: 'error',
        msg: 'We couldn’t read this PDF — it may be corrupted or password-protected. Paste your resume text below instead.',
      })
      setShowManualPaste(true)
    }
  }

  // Reset resume-analysis (grade + rewrite) state whenever the resume changes.
  const resetAnalysisState = () => {
    setResumeGrade(null)
    setGradeOpen(false)
    setGradeError('')
    setRewriteGuide(null)
    setRewriteOpen(false)
    setRewriteError('')
  }

  // Manual paste — converges on the same resumeText + usable-text check as PDF.
  const handleManualResumeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    resumeTouchedRef.current = true
    setUsingSavedResume(false)
    setResumeText(text)
    setFileName('') // typed text supersedes any uploaded file
    resetAnalysisState()
    if (hasUsableText(text)) {
      setResumeNotice({ type: 'success', msg: 'Resume text added — we’ll tailor your questions to it.' })
    } else {
      // Don't nag mid-type; the submit guard enforces usability on submit.
      setResumeNotice(null)
    }
  }

  // Clear resume entirely — lets the user proceed with no resume after a failed
  // parse. Session-level only: this does NOT delete a saved resume (submitting
  // with an empty field skips the save-upsert below). The saved copy is removed
  // only from /profile.
  const clearResume = () => {
    resumeTouchedRef.current = true
    setUsingSavedResume(false)
    setResumeText('')
    setFileName('')
    setResumeNotice(null)
    setShowManualPaste(false)
    resetAnalysisState()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGradeResume = async () => {
    if (!resumeText || isGrading) return
    setIsGrading(true)
    setGradeError('')
    try {
      const res = await fetch('/api/grade-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, role, company, interviewType }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to grade resume')
      }
      const grade: ResumeGrade = await res.json()
      setResumeGrade(grade)
      setGradeOpen(true)
    } catch (err: any) {
      setGradeError(err.message || 'Something went wrong')
    } finally {
      setIsGrading(false)
    }
  }

  const handleRewriteResume = async () => {
    if (!resumeText || isRewriting) return
    setIsRewriting(true)
    setRewriteError('')
    try {
      const res = await fetch('/api/rewrite-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, role, company }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate rewrite guide')
      }
      const guide: ResumeRewriteGuide = await res.json()
      setRewriteGuide(guide)
      setRewriteOpen(true)
    } catch (err: any) {
      setRewriteError(err.message || 'Something went wrong')
    } finally {
      setIsRewriting(false)
    }
  }

  const handleReviewLinkedin = async () => {
    if (!linkedinText || isReviewingLinkedin) return
    setIsReviewingLinkedin(true)
    setLinkedinReviewError('')
    try {
      const res = await fetch('/api/review-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinText, role, company, interviewType }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to review LinkedIn profile')
      }
      const review: LinkedInReview = await res.json()
      setLinkedinReview(review)
      setLinkedinReviewOpen(true)
    } catch (err: any) {
      setLinkedinReviewError(err.message || 'Something went wrong')
    } finally {
      setIsReviewingLinkedin(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !email.trim() || !company.trim() || !role.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    // A resume is optional, but if the user attempted to provide one (failed
    // parse still showing, or unusable pasted text) don't silently send empty
    // context to question generation — make them fix it or clear it.
    const resumeAttempted = resumeNotice?.type === 'error' || resumeText.trim().length > 0
    if (resumeAttempted && !hasUsableText(resumeText)) {
      setError('We couldn’t read your resume. Paste your resume text, or clear it to continue without one.')
      setShowManualPaste(true)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const sessionId = uuidv4()
      localStorage.setItem('sessionId', sessionId)
      localStorage.setItem(
        `session_meta_${sessionId}`,
        JSON.stringify({ company, role, interviewType, questionFocus, difficulty, firstName, email })
      )

      // Phase 4 — persist this resume to the logged-in user's profile so it
      // auto-fills next time. Guests (user null) write nothing. The submit guard
      // above already ensured resumeText is empty or usable, and hasUsableText
      // re-checks here so an empty field never overwrites a saved resume.
      // Fire-and-forget: never blocks starting the mock, errors swallowed.
      if (user && hasUsableText(resumeText)) {
        getSupabaseBrowserClient()
          .from('profiles')
          .upsert({ id: user.id, resume_text: resumeText }, { onConflict: 'id' })
          .then(() => {}, () => {})
      }

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role, resumeText, linkedinUrl, sessionId, interviewType, questionFocus, difficulty }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate questions')
      }

      // Fire-and-forget analytics — never block navigation
      fetch('/api/log-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          interviewType,
          questionFocus,
          difficulty,
          company: company.trim(),
          role: role.trim(),
        }),
      }).catch(() => {})

      router.push(`/interview/${sessionId}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen animate-fade-in overflow-x-hidden bg-gradient-to-b from-white to-[#F1F4F6]">
      <TealBlob className="w-[380px] h-[380px] -top-36 -right-40 bg-gradient-to-br from-[rgba(168,224,221,0.3)] to-[rgba(13,95,99,0.05)]" />

      <div className="relative z-2 max-w-[640px] mx-auto px-6 py-10 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <RunbackLogoChip size={32} />
            <GlassWordmark className="text-lg" />
          </Link>
          <NavAuth />
        </div>

        <div>
          <h1 className="font-serif text-[26px] font-bold text-ink">Set up your session</h1>
          <p className="mt-1.5 text-sm text-ink/70 leading-relaxed">Six tailored questions, built for this exact target — takes about a minute.</p>
        </div>

        <Glass className="rounded-[20px] p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Interview Type */}
            <div>
              <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Interview Type</label>
              <div className="relative">
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className={`${fieldClass} appearance-none cursor-pointer pr-10`}
                >
                  {INTERVIEW_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Question Focus + Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Question Focus</label>
                <div className="relative">
                  <select
                    value={questionFocus}
                    onChange={(e) => setQuestionFocus(e.target.value as (typeof QUESTION_FOCUS_OPTIONS)[number])}
                    className={`${fieldClass} appearance-none cursor-pointer pr-10`}
                  >
                    {QUESTION_FOCUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Difficulty</label>
                <div className="relative">
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as (typeof DIFFICULTY_OPTIONS)[number])}
                    className={`${fieldClass} appearance-none cursor-pointer pr-10`}
                  >
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* First Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  First Name <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Alex"
                  required
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  Email <span className="text-brand">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Company + Role (relabeled to School + Program for admissions verticals) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  {isSchoolVertical ? 'Target School' : 'Company'} <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={isSchoolVertical ? 'e.g. Johns Hopkins' : 'e.g. Google'}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  {isSchoolVertical ? 'Program / Degree' : 'Role'} <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={isSchoolVertical ? 'e.g. MD Program' : 'e.g. Software Engineer'}
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Resume Upload */}
            <div className="flex flex-col gap-2">
              <label className="block text-[12.5px] font-semibold text-ink">
                Resume <span className="text-ink/50 font-normal">(optional)</span>
              </label>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-brand/60 bg-brand/[0.06]'
                    : 'border-[rgba(31,37,43,0.2)] bg-[rgba(255,255,255,0.4)] hover:border-[rgba(31,37,43,0.32)]'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2 text-brand">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">{fileName}</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-ink/30 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-ink/60">Drag & drop your resume PDF here</p>
                    <p className="text-xs text-ink/40 mt-1">or click to browse</p>
                  </>
                )}
              </div>

              {/* Phase 4 — saved-resume indicator (logged-in users with a saved resume) */}
              {usingSavedResume && (
                <div className="flex items-start gap-3 rounded-md px-3 py-2.5 text-xs bg-brand/[0.08] border border-brand/25 text-brand">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="leading-relaxed flex-1">
                    Using your saved resume. Upload or paste a different one to replace it, or clear it for this session.
                  </span>
                  <button
                    type="button"
                    onClick={clearResume}
                    className="shrink-0 underline decoration-brand/40 hover:decoration-brand text-brand/90 hover:text-brand transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Resume parse notice — distinct from the form-validation error line */}
              {resumeNotice && (
                <div
                  className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-xs ${
                    resumeNotice.type === 'error'
                      ? 'bg-red-500/[0.06] border border-red-500/20 text-red-700'
                      : 'bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-700'
                  }`}
                >
                  <span className="leading-relaxed flex-1">{resumeNotice.msg}</span>
                  {resumeNotice.type === 'error' && (
                    <button
                      type="button"
                      onClick={clearResume}
                      className="shrink-0 underline decoration-red-400/40 hover:decoration-red-500 text-red-700/80 hover:text-red-800 transition-colors"
                    >
                      Continue without
                    </button>
                  )}
                </div>
              )}

              {/* Manual paste fallback — always available via toggle, auto-revealed on parse failure */}
              {!showManualPaste ? (
                <button
                  type="button"
                  onClick={() => setShowManualPaste(true)}
                  className="self-start text-xs text-ink/50 hover:text-brand underline decoration-ink/20 hover:decoration-brand transition-colors"
                >
                  Or paste it manually instead
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-ink/50">Paste your resume text</label>
                  <textarea
                    value={fileName ? '' : resumeText}
                    onChange={handleManualResumeChange}
                    rows={6}
                    placeholder="Paste the full text of your resume here…"
                    className={`${fieldClass} resize-y`}
                  />
                </div>
              )}

              {/* Resume tools — appear only once we have usable resume text */}
              {hasUsableText(resumeText) && (
                <div className="border border-[rgba(31,37,43,0.08)] rounded-xl overflow-hidden divide-y divide-[rgba(31,37,43,0.06)]">

                  {/* ── Grade panel ─────────────────────────────── */}
                  <button
                    type="button"
                    onClick={() => resumeGrade ? setGradeOpen((o) => !o) : handleGradeResume()}
                    disabled={isGrading}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.75)] transition-colors disabled:cursor-wait text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-brand/15 flex items-center justify-center shrink-0">
                        {isGrading ? (
                          <svg className="animate-spin w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {isGrading ? 'Analyzing…' : resumeGrade ? 'Resume Score' : 'Analyze Resume'}
                        </p>
                        <p className="text-xs text-ink/50">
                          {!isGrading && !resumeGrade && 'Free instant feedback · ~5 sec'}
                          {resumeGrade && !isGrading && `Overall ${resumeGrade.scores.overall}/10`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {resumeGrade && (
                        <span className={`text-lg font-bold tabular-nums ${resumeGrade.scores.overall >= 8 ? 'text-green-600' : resumeGrade.scores.overall >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {resumeGrade.scores.overall}
                        </span>
                      )}
                      {resumeGrade && (
                        <svg className={`w-4 h-4 text-ink/40 transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Grade expanded body */}
                  {resumeGrade && gradeOpen && (
                    <div className="bg-[rgba(255,255,255,0.35)] px-4 py-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2.5">
                        {([
                          { label: 'Clarity & Formatting', val: resumeGrade.scores.clarity },
                          { label: 'Bullet Point Impact',  val: resumeGrade.scores.impact },
                          { label: 'Relevance to Role',    val: resumeGrade.scores.relevance },
                          { label: 'ATS Friendliness',     val: resumeGrade.scores.ats },
                        ] as const).map(({ label, val }) => {
                          const text = val >= 8 ? 'text-green-600': val >= 6 ? 'text-yellow-600' : 'text-red-600'
                          return (
                            <div key={label}>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-ink/60">{label}</span>
                                <span className={`text-xs font-semibold tabular-nums ${text}`}>{val}/10</span>
                              </div>
                              <div className="h-1.5 bg-[rgba(31,37,43,0.08)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${val * 10}%`, background: val >= 8 ? '#22c55e' : val >= 6 ? '#eab308' : '#ef4444' }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-[rgba(31,37,43,0.08)] pt-3">
                        <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2.5">3 Quick Wins</p>
                        <div className="flex flex-col gap-2">
                          {resumeGrade.quickWins.filter(Boolean).map((win, i) => (
                            <div key={i} className="flex gap-2.5">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-brand/15 text-brand text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                              <p className="text-sm text-ink/80 leading-relaxed">{win}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {gradeError && <p className="text-xs text-red-600">{gradeError}</p>}
                    </div>
                  )}
                  {gradeError && !resumeGrade && (
                    <div className="bg-[rgba(255,255,255,0.35)] px-4 py-3">
                      <p className="text-xs text-red-600">{gradeError}</p>
                    </div>
                  )}

                  {/* ── Rewrite guide panel (only after grading) ── */}
                  {resumeGrade && (
                    <>
                      <button
                        type="button"
                        onClick={() => rewriteGuide ? setRewriteOpen((o) => !o) : handleRewriteResume()}
                        disabled={isRewriting}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.75)] transition-colors disabled:cursor-wait text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                            {isRewriting ? (
                              <svg className="animate-spin w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {isRewriting ? 'Building rewrite guide…' : rewriteGuide ? 'Resume Rewrite Guide' : 'Get Improved Resume'}
                            </p>
                            <p className="text-xs text-ink/50">
                              {!isRewriting && !rewriteGuide && 'Bullet-by-bullet editing checklist · ~10 sec'}
                              {rewriteGuide && !isRewriting && `${rewriteGuide.rewrites.length} bullets to improve`}
                            </p>
                          </div>
                        </div>
                        {rewriteGuide && (
                          <svg className={`w-4 h-4 text-ink/40 shrink-0 transition-transform duration-200 ${rewriteOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>

                      {/* Rewrite guide body */}
                      {rewriteGuide && rewriteOpen && (
                        <div className="bg-[rgba(255,255,255,0.35)] px-4 py-4 flex flex-col gap-1">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Resume Rewrite Guide</p>
                            <p className="text-xs text-ink/50">{rewriteGuide.rewrites.length} changes</p>
                          </div>

                          <div className="flex flex-col gap-3">
                            {rewriteGuide.rewrites.map((item, i) => {
                              const reasonColors: Record<string, string> = {
                                'add metrics':      'bg-blue-500/10 text-blue-700 border-blue-500/25',
                                'stronger verb':    'bg-purple-500/10 text-purple-700 border-purple-500/25',
                                'clearer impact':   'bg-amber-500/10 text-amber-700 border-amber-500/25',
                                'remove filler':    'bg-red-500/10 text-red-700 border-red-500/25',
                                'combine & sharpen':'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
                              }
                              const pill = reasonColors[item.reason] ?? 'bg-[rgba(31,37,43,0.06)] text-ink/60 border-[rgba(31,37,43,0.15)]'
                              return (
                                <div key={i} className="rounded-lg border border-[rgba(31,37,43,0.08)] overflow-hidden">
                                  {/* Reason tag */}
                                  <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,255,255,0.4)] border-b border-[rgba(31,37,43,0.08)]">
                                    <span className="text-xs text-ink/40 tabular-nums">#{i + 1}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${pill}`}>
                                      {item.reason}
                                    </span>
                                  </div>
                                  {/* Before / After */}
                                  <div className="grid grid-cols-1 divide-y divide-[rgba(31,37,43,0.06)]">
                                    <div className="px-3 py-2.5 bg-red-500/5">
                                      <p className="text-xs font-semibold text-red-700/70 uppercase tracking-wider mb-1">Before</p>
                                      <p className="text-sm text-ink/60 leading-relaxed line-through decoration-red-500/40">{item.original}</p>
                                    </div>
                                    <div className="px-3 py-2.5 bg-emerald-500/5">
                                      <p className="text-xs font-semibold text-emerald-700/70 uppercase tracking-wider mb-1">After</p>
                                      <p className="text-sm text-ink leading-relaxed">{item.improved}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <p className="text-xs text-ink/40 mt-2 leading-relaxed">
                            Apply these edits directly in your resume. Placeholders like [X%] should be replaced with your actual numbers.
                          </p>
                          {rewriteError && <p className="text-xs text-red-600 mt-1">{rewriteError}</p>}
                        </div>
                      )}
                      {rewriteError && !rewriteGuide && (
                        <div className="bg-[rgba(255,255,255,0.35)] px-4 py-3">
                          <p className="text-xs text-red-600">{rewriteError}</p>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                LinkedIn URL <span className="text-ink/50 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className={fieldClass}
              />
            </div>

            {/* LinkedIn profile review — pasted text, since we can't fetch a LinkedIn URL server-side */}
            <div>
              <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                LinkedIn Profile Text <span className="text-ink/50 font-normal">(optional — paste your headline, about, and experience for AI feedback)</span>
              </label>
              <textarea
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                placeholder="Paste your LinkedIn headline, About section, and experience bullets here…"
                rows={4}
                className={`${fieldClass} resize-y`}
              />
              {linkedinText && (
                <div className="mt-2 border border-[rgba(31,37,43,0.08)] rounded-xl overflow-hidden divide-y divide-[rgba(31,37,43,0.06)]">
                  <button
                    type="button"
                    onClick={() => linkedinReview ? setLinkedinReviewOpen((o) => !o) : handleReviewLinkedin()}
                    disabled={isReviewingLinkedin}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.75)] transition-colors disabled:cursor-wait text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-brand/15 flex items-center justify-center shrink-0">
                        {isReviewingLinkedin ? (
                          <svg className="animate-spin w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                            <circle cx="4" cy="4" r="2" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {isReviewingLinkedin ? 'Analyzing…' : linkedinReview ? 'LinkedIn Score' : 'Review LinkedIn Profile'}
                        </p>
                        <p className="text-xs text-ink/50">
                          {!isReviewingLinkedin && !linkedinReview && 'Free instant feedback · ~5 sec'}
                          {linkedinReview && !isReviewingLinkedin && `Overall ${linkedinReview.scores.overall}/10`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {linkedinReview && (
                        <span className={`text-lg font-bold tabular-nums ${linkedinReview.scores.overall >= 8 ? 'text-green-600' : linkedinReview.scores.overall >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {linkedinReview.scores.overall}
                        </span>
                      )}
                      {linkedinReview && (
                        <svg className={`w-4 h-4 text-ink/40 transition-transform duration-200 ${linkedinReviewOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {linkedinReview && linkedinReviewOpen && (
                    <div className="bg-[rgba(255,255,255,0.35)] px-4 py-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2.5">
                        {([
                          { label: 'Headline',          val: linkedinReview.scores.headline },
                          { label: 'About Section',     val: linkedinReview.scores.about },
                          { label: 'Experience Bullets',val: linkedinReview.scores.experience },
                          { label: 'Keyword Relevance', val: linkedinReview.scores.keywords },
                        ] as const).map(({ label, val }) => {
                          const text = val >= 8 ? 'text-green-600': val >= 6 ? 'text-yellow-600' : 'text-red-600'
                          return (
                            <div key={label}>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-ink/60">{label}</span>
                                <span className={`text-xs font-semibold tabular-nums ${text}`}>{val}/10</span>
                              </div>
                              <div className="h-1.5 bg-[rgba(31,37,43,0.08)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${val * 10}%`, background: val >= 8 ? '#22c55e' : val >= 6 ? '#eab308' : '#ef4444' }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-[rgba(31,37,43,0.08)] pt-3">
                        <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2.5">3 Quick Wins</p>
                        <div className="flex flex-col gap-2">
                          {linkedinReview.quickWins.filter(Boolean).map((win, i) => (
                            <div key={i} className="flex gap-2.5">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-brand/15 text-brand text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                              <p className="text-sm text-ink/80 leading-relaxed">{win}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {linkedinReviewError && <p className="text-xs text-red-600">{linkedinReviewError}</p>}
                    </div>
                  )}
                  {linkedinReviewError && !linkedinReview && (
                    <div className="bg-[rgba(255,255,255,0.35)] px-4 py-3">
                      <p className="text-xs text-red-600">{linkedinReviewError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-500/[0.06] border border-red-500/20 rounded-md px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full bg-brand hover:bg-brand-hover disabled:bg-brand-hover/40 disabled:cursor-not-allowed text-white font-bold text-[15px] py-3.5 rounded-[10px] shadow-[0_8px_20px_rgba(13,95,99,0.25)] hover:shadow-[0_10px_26px_rgba(13,95,99,0.32)] transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating Interview...
                </>
              ) : (
                'Generate my interview'
              )}
            </button>
          </form>
        </Glass>

        {/* Past Interviews (local, this-device history) */}
        {history && history.length > 0 && (() => {
          const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          const n = sorted.length
          const VW = 480, VH = 160, PL = 38, PR = 12, PT = 16, PB = 30
          const plotW = VW - PL - PR
          const plotH = VH - PT - PB
          const xFor = (i: number) => n === 1 ? PL + plotW / 2 : PL + (i / (n - 1)) * plotW
          const yFor = (score: number) => PT + (1 - (score * 10) / 100) * plotH
          const points = sorted.map((e, i) => ({ x: xFor(i), y: yFor(e.overallScore), score: Math.round(e.overallScore * 10), entry: e }))
          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
          const areaPath = n > 1
            ? `${linePath} L ${points[n-1].x.toFixed(1)} ${(PT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PT + plotH).toFixed(1)} Z`
            : ''
          const gridScores = [0, 25, 50, 75, 100]
          const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

          return (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink/60 uppercase tracking-wider">Score Progression</h2>
                <span className="text-xs text-ink/40">{n} session{n !== 1 ? 's' : ''}</span>
              </div>

              <Glass className="rounded-xl p-4">
                <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: 160 }} aria-label="Score progression chart">
                  {gridScores.map(s => {
                    const y = PT + (1 - s / 100) * plotH
                    return (
                      <g key={s}>
                        <line x1={PL} y1={y} x2={VW - PR} y2={y} stroke="rgba(31,37,43,0.1)" strokeWidth="1" />
                        <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill="rgba(31,37,43,0.4)">{s}</text>
                      </g>
                    )
                  })}
                  {n > 1 && <path d={areaPath} fill="#0D5F63" fillOpacity="0.08" />}
                  {n > 1 && <path d={linePath} fill="none" stroke="#0D5F63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {points.map((p, i) => {
                    const scoreColor = p.score >= 80 ? '#16a34a' : p.score >= 60 ? '#ca8a04' : '#dc2626'
                    const labelAnchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
                    return (
                      <g key={p.entry.sessionId}>
                        <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={scoreColor}>{p.score}</text>
                        <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#0D5F63" strokeWidth="2" />
                        <circle cx={p.x} cy={p.y} r="2" fill={scoreColor} />
                        <text x={p.x} y={VH - 4} textAnchor={labelAnchor} fontSize="9" fill="rgba(31,37,43,0.5)">{fmtDate(p.entry.date)}</text>
                      </g>
                    )
                  })}
                </svg>
              </Glass>

              <div className="flex flex-col gap-3">
                {history.map((entry) => {
                  const scoreColor = entry.overallScore >= 8 ? 'text-green-600' : entry.overallScore >= 6 ? 'text-yellow-600' : 'text-red-600'
                  const dims = [
                    { label: 'Clarity',    val: entry.scores.clarity },
                    { label: 'Confidence', val: entry.scores.confidence },
                    { label: 'Structure',  val: entry.scores.structure },
                    { label: 'Relevance',  val: entry.scores.relevance },
                  ]
                  return (
                    <Glass
                      key={entry.sessionId}
                      className="rounded-xl p-4 cursor-pointer hover:bg-[rgba(255,255,255,0.7)] transition-colors"
                    >
                      <div onClick={() => router.push(`/results/${entry.sessionId}`)}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-ink truncate">{entry.company}</p>
                              <span className="text-ink/40 text-sm">·</span>
                              <p className="text-sm text-ink/60 truncate">{entry.role}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                                {entry.interviewType}
                              </span>
                              <span className="text-xs text-ink/40">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              {entry.fillerCount > 0 && (
                                <span className="text-xs text-yellow-700/80">{entry.fillerCount} filler{entry.fillerCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-baseline gap-0.5">
                              <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{entry.overallScore}</span>
                              <span className="text-xs text-ink/40">/10</span>
                            </div>
                            <span className="text-xs text-ink/40">View →</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {dims.map(({ label, val }) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-ink/40">{label}</span>
                                <span className="text-ink/50 tabular-nums">{val}</span>
                              </div>
                              <div className="h-1 bg-[rgba(31,37,43,0.08)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${val * 10}%`, background: val >= 8 ? '#22c55e' : val >= 6 ? '#eab308' : '#ef4444' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Glass>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </main>
  )
}
