'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { loadHistory } from '@/lib/history'
import type { HistoryEntry } from '@/lib/history'

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
    try {
      const text = await extractTextFromPdf(file)
      setResumeText(text)
    } catch (err) {
      console.error('PDF extraction error:', err)
      setError('Failed to extract text from PDF. Please try another file.')
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
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Resume <span className="text-gray-500 font-normal">(optional)</span>
            </label>
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="hidden"
              />
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
          {history && history.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Past Interviews</h2>
                <span className="text-xs text-gray-600">{history.length} session{history.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-col gap-3">
                {history.map((entry) => {
                  const date = new Date(entry.date)
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const scoreColor = entry.overallScore >= 8 ? 'text-green-400' : entry.overallScore >= 6 ? 'text-yellow-400' : 'text-red-400'
                  const dims = [
                    { label: 'Clarity',     val: entry.scores.clarity },
                    { label: 'Confidence',  val: entry.scores.confidence },
                    { label: 'Structure',   val: entry.scores.structure },
                    { label: 'Relevance',   val: entry.scores.relevance },
                  ]
                  return (
                    <div
                      key={entry.sessionId}
                      onClick={() => router.push(`/results/${entry.sessionId}`)}
                      className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:border-gray-700 transition-colors group"
                    >
                      {/* Top row */}
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
                              <span className="text-xs text-yellow-700/80">
                                {entry.fillerCount} filler{entry.fillerCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Score */}
                        <div className="flex flex-col items-end shrink-0">
                          <div className="flex items-baseline gap-0.5">
                            <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{entry.overallScore}</span>
                            <span className="text-xs text-gray-600">/10</span>
                          </div>
                          <span className="text-xs text-gray-600 group-hover:text-gray-500 transition-colors">View →</span>
                        </div>
                      </div>

                      {/* Score bars */}
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
          )}
      </div>
    </main>
  )
}
