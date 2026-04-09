'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { loadHistory } from '@/lib/history'
import type { HistoryEntry } from '@/lib/history'
import type { ResumeGrade } from '@/app/api/grade-resume/route'
import type { ResumeRewriteGuide } from '@/app/api/rewrite-resume/route'

const INTERVIEW_TYPES = [
  'General',
  'Finance',
  'Consulting',
  'Tech',
  'Investment Banking',
  'Private Equity',
  'Real Estate',
  'Marketing',
  'Sales',
  'Healthcare',
  'Med School',
  'PA School',
  'Law School',
  'MBA',
  'Accounting',
  'Operations',
  'Human Resources',
  'Nonprofit',
  'Government',
  'Coffee Chat',
]

export default function Home() {
  const router = useRouter()
  const [interviewType, setInterviewType] = useState('General')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setHistory(loadHistory().slice(0, 5))
  }, [])

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
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    setFileName(file.name)
    setError('')
    // Reset analysis state when a new file is loaded
    setResumeGrade(null)
    setGradeOpen(false)
    setGradeError('')
    setRewriteGuide(null)
    setRewriteOpen(false)
    setRewriteError('')
    try {
      const text = await extractTextFromPdf(file)
      setResumeText(text)
    } catch (err) {
      console.error('PDF extraction error:', err)
      setError('Failed to extract text from PDF. Please try another file.')
    }
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
    if (!company.trim() || !role.trim()) {
      setError('Please fill in the company and role fields.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const sessionId = uuidv4()
      localStorage.setItem('sessionId', sessionId)
      localStorage.setItem(`session_meta_${sessionId}`, JSON.stringify({ company, role, interviewType }))

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role, resumeText, linkedinUrl, sessionId, interviewType }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate questions')
      }

      router.push(`/interview/${sessionId}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 py-12 px-6">
      <div className="w-full max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.96.96 0 01-.65.244H7.28a.96.96 0 01-.65-.244l-.348-.347z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Interview AI</h1>
          <p className="text-gray-500 mt-2 text-sm tracking-wide">Practice any interview, get brutal AI feedback, and actually improve.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Interview Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Interview Type</label>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInterviewType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    interviewType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Software Engineer"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Resume Upload */}
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-300">
              Resume <span className="text-gray-500 font-normal">(optional)</span>
            </label>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500">Drag & drop your resume PDF here</p>
                  <p className="text-xs text-gray-600 mt-1">or click to browse</p>
                </>
              )}
            </div>

            {/* Resume tools — appear once a file is loaded */}
            {resumeText && (
              <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">

                {/* ── Grade panel ─────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => resumeGrade ? setGradeOpen((o) => !o) : handleGradeResume()}
                  disabled={isGrading}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800/80 transition-colors disabled:cursor-wait text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center shrink-0">
                      {isGrading ? (
                        <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {isGrading ? 'Analyzing…' : resumeGrade ? 'Resume Score' : 'Analyze Resume'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {!isGrading && !resumeGrade && 'Free instant feedback · ~5 sec'}
                        {resumeGrade && !isGrading && `Overall ${resumeGrade.scores.overall}/10`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {resumeGrade && (
                      <span className={`text-lg font-bold tabular-nums ${resumeGrade.scores.overall >= 8 ? 'text-green-400' : resumeGrade.scores.overall >= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {resumeGrade.scores.overall}
                      </span>
                    )}
                    {resumeGrade && (
                      <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Grade expanded body */}
                {resumeGrade && gradeOpen && (
                  <div className="bg-gray-950 px-4 py-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2.5">
                      {([
                        { label: 'Clarity & Formatting', val: resumeGrade.scores.clarity },
                        { label: 'Bullet Point Impact',  val: resumeGrade.scores.impact },
                        { label: 'Relevance to Role',    val: resumeGrade.scores.relevance },
                        { label: 'ATS Friendliness',     val: resumeGrade.scores.ats },
                      ] as const).map(({ label, val }) => {
                        const bar  = val >= 8 ? 'bg-green-500'  : val >= 6 ? 'bg-yellow-500'  : 'bg-red-500'
                        const text = val >= 8 ? 'text-green-400': val >= 6 ? 'text-yellow-400' : 'text-red-400'
                        return (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-400">{label}</span>
                              <span className={`text-xs font-semibold tabular-nums ${text}`}>{val}/10</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${val * 10}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="border-t border-gray-800/60 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">3 Quick Wins</p>
                      <div className="flex flex-col gap-2">
                        {resumeGrade.quickWins.filter(Boolean).map((win, i) => (
                          <div key={i} className="flex gap-2.5">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <p className="text-sm text-gray-300 leading-relaxed">{win}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {gradeError && <p className="text-xs text-red-400">{gradeError}</p>}
                  </div>
                )}
                {gradeError && !resumeGrade && (
                  <div className="bg-gray-950 px-4 py-3">
                    <p className="text-xs text-red-400">{gradeError}</p>
                  </div>
                )}

                {/* ── Rewrite guide panel (only after grading) ── */}
                {resumeGrade && (
                  <>
                    <button
                      type="button"
                      onClick={() => rewriteGuide ? setRewriteOpen((o) => !o) : handleRewriteResume()}
                      disabled={isRewriting}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800/80 transition-colors disabled:cursor-wait text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0">
                          {isRewriting ? (
                            <svg className="animate-spin w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {isRewriting ? 'Building rewrite guide…' : rewriteGuide ? 'Resume Rewrite Guide' : 'Get Improved Resume'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {!isRewriting && !rewriteGuide && 'Bullet-by-bullet editing checklist · ~10 sec'}
                            {rewriteGuide && !isRewriting && `${rewriteGuide.rewrites.length} bullets to improve`}
                          </p>
                        </div>
                      </div>
                      {rewriteGuide && (
                        <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${rewriteOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {/* Rewrite guide body */}
                    {rewriteGuide && rewriteOpen && (
                      <div className="bg-gray-950 px-4 py-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resume Rewrite Guide</p>
                          <p className="text-xs text-gray-600">{rewriteGuide.rewrites.length} changes</p>
                        </div>

                        <div className="flex flex-col gap-3">
                          {rewriteGuide.rewrites.map((item, i) => {
                            const reasonColors: Record<string, string> = {
                              'add metrics':      'bg-blue-500/15 text-blue-400 border-blue-500/25',
                              'stronger verb':    'bg-purple-500/15 text-purple-400 border-purple-500/25',
                              'clearer impact':   'bg-amber-500/15 text-amber-400 border-amber-500/25',
                              'remove filler':    'bg-red-500/15 text-red-400 border-red-500/25',
                              'combine & sharpen':'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                            }
                            const pill = reasonColors[item.reason] ?? 'bg-gray-700 text-gray-400 border-gray-600'
                            return (
                              <div key={i} className="rounded-xl border border-gray-800 overflow-hidden">
                                {/* Reason tag */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
                                  <span className="text-xs text-gray-600 tabular-nums">#{i + 1}</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${pill}`}>
                                    {item.reason}
                                  </span>
                                </div>
                                {/* Before / After */}
                                <div className="grid grid-cols-1 divide-y divide-gray-800">
                                  <div className="px-3 py-2.5 bg-red-500/5">
                                    <p className="text-xs font-semibold text-red-500/70 uppercase tracking-wider mb-1">Before</p>
                                    <p className="text-sm text-gray-400 leading-relaxed line-through decoration-red-500/40">{item.original}</p>
                                  </div>
                                  <div className="px-3 py-2.5 bg-emerald-500/5">
                                    <p className="text-xs font-semibold text-emerald-500/70 uppercase tracking-wider mb-1">After</p>
                                    <p className="text-sm text-gray-200 leading-relaxed">{item.improved}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                          Apply these edits directly in your resume. Placeholders like [X%] should be replaced with your actual numbers.
                        </p>
                        {rewriteError && <p className="text-xs text-red-400 mt-1">{rewriteError}</p>}
                      </div>
                    )}
                    {rewriteError && !rewriteGuide && (
                      <div className="bg-gray-950 px-4 py-3">
                        <p className="text-xs text-red-400">{rewriteError}</p>
                      </div>
                    )}
                  </>
                )}

              </div>
            )}
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              LinkedIn URL <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
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
              'Generate Interview'
            )}
          </button>
        </form>

          {/* Past Interviews */}
          {history && history.length > 0 && (() => {
            // Sort oldest → newest for the chart
            const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            const n = sorted.length

            // SVG layout constants
            const VW = 480
            const VH = 160
            const PL = 38  // left padding (y-axis labels)
            const PR = 12  // right
            const PT = 16  // top
            const PB = 30  // bottom (x-axis labels)
            const plotW = VW - PL - PR
            const plotH = VH - PT - PB

            // Coordinate helpers — scores are 0-10, display as 0-100
            const xFor = (i: number) => n === 1 ? PL + plotW / 2 : PL + (i / (n - 1)) * plotW
            const yFor = (score: number) => PT + (1 - (score * 10) / 100) * plotH

            const points = sorted.map((e, i) => ({ x: xFor(i), y: yFor(e.overallScore), score: Math.round(e.overallScore * 10), entry: e }))

            // Line path
            const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

            // Filled area under line (close back to baseline)
            const areaPath = n > 1
              ? `${linePath} L ${points[n-1].x.toFixed(1)} ${(PT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PT + plotH).toFixed(1)} Z`
              : ''

            const gridScores = [0, 25, 50, 75, 100]

            const fmtDate = (iso: string) => {
              const d = new Date(iso)
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }

            return (
              <div className="mt-10 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Score Progression</h2>
                  <span className="text-xs text-gray-600">{n} session{n !== 1 ? 's' : ''}</span>
                </div>

                {/* Chart */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <svg
                    viewBox={`0 0 ${VW} ${VH}`}
                    className="w-full"
                    style={{ height: 160 }}
                    aria-label="Score progression chart"
                  >
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines + y-axis labels */}
                    {gridScores.map(s => {
                      const y = PT + (1 - s / 100) * plotH
                      return (
                        <g key={s}>
                          <line x1={PL} y1={y} x2={VW - PR} y2={y} stroke="#1f2937" strokeWidth="1" />
                          <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill="#4b5563">{s}</text>
                        </g>
                      )
                    })}

                    {/* Area fill (multi-point only) */}
                    {n > 1 && <path d={areaPath} fill="url(#scoreGrad)" />}

                    {/* Line (multi-point only) */}
                    {n > 1 && (
                      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {/* Points, score labels, x-axis date labels */}
                    {points.map((p, i) => {
                      const scoreColor = p.score >= 80 ? '#4ade80' : p.score >= 60 ? '#facc15' : '#f87171'
                      const labelY = p.y - 9
                      const dateLabel = fmtDate(p.entry.date)
                      // Clamp x-labels so they don't overflow
                      const labelAnchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
                      return (
                        <g key={p.entry.sessionId}>
                          {/* Score label above point */}
                          <text x={p.x} y={labelY} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={scoreColor}>
                            {p.score}
                          </text>
                          {/* Point circle */}
                          <circle cx={p.x} cy={p.y} r="4" fill="#111827" stroke="#6366f1" strokeWidth="2" />
                          <circle cx={p.x} cy={p.y} r="2" fill={scoreColor} />
                          {/* X-axis date label */}
                          <text x={p.x} y={VH - 4} textAnchor={labelAnchor} fontSize="9" fill="#6b7280">
                            {dateLabel}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                {/* Session list */}
                <div className="flex flex-col gap-3">
                  {history.map((entry) => {
                    const dateStr = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const scoreColor = entry.overallScore >= 8 ? 'text-green-400' : entry.overallScore >= 6 ? 'text-yellow-400' : 'text-red-400'
                    const dims = [
                      { label: 'Clarity',    val: entry.scores.clarity },
                      { label: 'Confidence', val: entry.scores.confidence },
                      { label: 'Structure',  val: entry.scores.structure },
                      { label: 'Relevance',  val: entry.scores.relevance },
                    ]
                    return (
                      <div
                        key={entry.sessionId}
                        onClick={() => router.push(`/results/${entry.sessionId}`)}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:border-gray-700 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-white truncate">{entry.company}</p>
                              <span className="text-gray-600 text-sm">·</span>
                              <p className="text-sm text-gray-400 truncate">{entry.role}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                                {entry.interviewType}
                              </span>
                              <span className="text-xs text-gray-600">{dateStr}</span>
                              {entry.fillerCount > 0 && (
                                <span className="text-xs text-yellow-700/80">{entry.fillerCount} filler{entry.fillerCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-baseline gap-0.5">
                              <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{entry.overallScore}</span>
                              <span className="text-xs text-gray-600">/10</span>
                            </div>
                            <span className="text-xs text-gray-600 group-hover:text-gray-500 transition-colors">View →</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {dims.map(({ label, val }) => {
                            const barColor = val >= 8 ? 'bg-green-500' : val >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                            return (
                              <div key={label}>
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-gray-600">{label}</span>
                                  <span className="text-gray-500 tabular-nums">{val}</span>
                                </div>
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${val * 10}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
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
