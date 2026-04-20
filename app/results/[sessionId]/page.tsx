'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { EvaluationResult, StarRating, StarAnalysis } from '@/app/api/evaluate/route'
import { supabase } from '@/lib/supabase'
import { countFillersPerAnswer, rankFillers, fluencyScore, wordCount } from '@/lib/fillerWords'
import { saveHistoryEntry } from '@/lib/history'

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [sessionData, setSessionData] = useState<{ company: string; role: string } | null>(null)
  const [interviewType, setInterviewType] = useState('General')
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')
  const [autoEmailStatus, setAutoEmailStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const autoEmailSentRef = useRef(false)

  useEffect(() => {
    async function evaluate() {
      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Evaluation failed')
        }
        const data: EvaluationResult = await res.json()
        setResult(data)
      } catch (err: any) {
        setError(err.message || 'Failed to evaluate interview')
      } finally {
        setIsLoading(false)
      }
    }
    evaluate()
  }, [sessionId])

  useEffect(() => {
    supabase
      .from('sessions')
      .select('company, role')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => { if (data) setSessionData(data) })
  }, [sessionId])

  // Save to localStorage history once evaluation + session data are both ready
  useEffect(() => {
    if (!result || !sessionData) return

    const answers = result.evaluations.map((e) => e.answer)
    const perAnswer = countFillersPerAnswer(answers)
    const totalFillers = perAnswer.reduce((s, f) => s + f.total, 0)

    // Average each dimension across all questions
    const count = result.evaluations.length || 1
    const avgScores = result.evaluations.reduce(
      (acc, ev) => ({
        clarity:    acc.clarity    + ev.scores.clarity    / count,
        confidence: acc.confidence + ev.scores.confidence / count,
        structure:  acc.structure  + ev.scores.structure  / count,
        relevance:  acc.relevance  + ev.scores.relevance  / count,
      }),
      { clarity: 0, confidence: 0, structure: 0, relevance: 0 }
    )

    // Interview type was stored in session meta at form-submit time
    let interviewType = 'General'
    try {
      const metaRaw = localStorage.getItem(`session_meta_${sessionId}`)
      if (metaRaw) interviewType = JSON.parse(metaRaw).interviewType ?? 'General'
    } catch { /* ignore */ }
    setInterviewType(interviewType)

    saveHistoryEntry({
      sessionId,
      date: new Date().toISOString(),
      company: sessionData.company,
      role: sessionData.role,
      interviewType,
      overallScore: result.overallScore,
      scores: {
        clarity:    Math.round(avgScores.clarity    * 10) / 10,
        confidence: Math.round(avgScores.confidence * 10) / 10,
        structure:  Math.round(avgScores.structure  * 10) / 10,
        relevance:  Math.round(avgScores.relevance  * 10) / 10,
      },
      fillerCount: totalFillers,
    })
  }, [result, sessionData, sessionId])

  // Auto-send email once evaluation + session data are ready
  useEffect(() => {
    if (!result || !sessionData || autoEmailSentRef.current) return
    autoEmailSentRef.current = true

    try {
      const metaRaw = localStorage.getItem(`session_meta_${sessionId}`)
      if (!metaRaw) return
      const meta = JSON.parse(metaRaw)
      const toEmail = meta.email?.trim()
      if (!toEmail) return

      const answers = result.evaluations.map((e) => e.answer)
      const perAnswer = countFillersPerAnswer(answers)
      const totalFillers = perAnswer.reduce((s, f) => s + f.total, 0)

      fetch('/api/email-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          firstName: meta.firstName || '',
          company: sessionData.company,
          role: sessionData.role,
          result,
          fillerCount: totalFillers,
          blindSpot: result.blindSpot,
        }),
      })
        .then((r) => r.ok ? setAutoEmailStatus('sent') : setAutoEmailStatus('error'))
        .catch(() => setAutoEmailStatus('error'))
    } catch {
      // ignore — never block the results page
    }
  }, [result, sessionData, sessionId])

  const starRatingStyle = (rating: StarRating) => {
    if (rating === 'present') return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' }
    if (rating === 'weak')    return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-400' }
    return                           { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/25',    dot: 'bg-red-400' }
  }

  const starRatingLabel = (rating: StarRating) => {
    if (rating === 'present') return 'Present'
    if (rating === 'weak')    return 'Weak'
    return 'Missing'
  }

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const scoreBarGradient = (score: number) =>
    score >= 8 ? 'linear-gradient(to right,#15803d,#4ade80)'
    : score >= 6 ? 'linear-gradient(to right,#a16207,#facc15)'
    : 'linear-gradient(to right,#b91c1c,#f87171)'

  const overallGrade = (score: number) => {
    if (score >= 9) return { grade: 'A+', label: 'Outstanding' }
    if (score >= 8) return { grade: 'A', label: 'Excellent' }
    if (score >= 7) return { grade: 'B', label: 'Good' }
    if (score >= 6) return { grade: 'C', label: 'Fair' }
    return { grade: 'D', label: 'Needs Work' }
  }

  // ── Filler word analysis (client-side, no extra API call) ──────
  const fillerData = useMemo(() => {
    if (!result) return null
    const answers = result.evaluations.map((e) => e.answer)
    const perAnswer = countFillersPerAnswer(answers)
    const ranked = rankFillers(perAnswer)
    const totalFillers = perAnswer.reduce((s, f) => s + f.total, 0)
    const totalWords = answers.reduce((s, a) => s + wordCount(a), 0)
    const score = fluencyScore(totalFillers, totalWords)
    const maxPerAnswer = Math.max(1, ...perAnswer.map((f) => f.total))
    return { perAnswer, ranked, totalFillers, totalWords, score, maxPerAnswer }
  }, [result])

  const getBenchmark = (type: string, company: string): { score: number; label: string; sessions: string } => {
    const co = company.toLowerCase()

    // Named-company overrides (substring match)
    const elite: [string[], { score: number; label: string; sessions: string }][] = [
      [['goldman','morgan stanley','jp morgan','blackstone','kkr','carlyle','apollo','citadel','two sigma','bridgewater','point72','millennium'],
       { score: 88, label: 'Top-tier finance firms', sessions: '3–4 sessions' }],
      [['mckinsey','bain','bcg','oliver wyman','roland berger'],
       { score: 87, label: 'MBB candidates', sessions: '3–4 sessions' }],
      [['deloitte','pwc','kpmg','ey ','ernst & young','accenture'],
       { score: 82, label: 'Big 4 / consulting candidates', sessions: '2–3 sessions' }],
      [['google','meta','apple','microsoft','amazon','netflix','openai','anthropic','stripe','airbnb','uber','palantir','snowflake'],
       { score: 83, label: 'Top-tier tech candidates', sessions: '2–3 sessions' }],
      [['harvard','yale','stanford','columbia','upenn','duke','dartmouth','brown','johns hopkins','mayo','wharton'],
       { score: 86, label: 'Target-school applicants', sessions: '3–4 sessions' }],
      [['skadden','kirkland','cravath','wachtell','sullivan','latham','simpson'],
       { score: 85, label: 'BigLaw candidates', sessions: '3–4 sessions' }],
    ]
    for (const [names, bench] of elite) {
      if (names.some(n => co.includes(n))) return bench
    }

    // Vertical benchmarks
    const byType: Record<string, { score: number; label: string; sessions: string }> = {
      'Investment Banking':  { score: 85, label: 'IB candidates',              sessions: '3–4 sessions' },
      'Private Equity':      { score: 86, label: 'PE candidates',              sessions: '3–4 sessions' },
      'Consulting':          { score: 83, label: 'Consulting candidates',      sessions: '2–3 sessions' },
      'Finance':             { score: 80, label: 'Finance candidates',         sessions: '2–3 sessions' },
      'Tech':                { score: 78, label: 'Tech candidates',            sessions: '2–3 sessions' },
      'Healthcare':          { score: 76, label: 'Healthcare candidates',      sessions: '2 sessions'   },
      'Real Estate':         { score: 75, label: 'Real estate candidates',     sessions: '2 sessions'   },
      'Marketing':           { score: 74, label: 'Marketing candidates',       sessions: '2 sessions'   },
      'Sales':               { score: 72, label: 'Sales candidates',           sessions: '1–2 sessions' },
      'Accounting':          { score: 74, label: 'Accounting candidates',      sessions: '2 sessions'   },
      'Audit':               { score: 75, label: 'Audit candidates',           sessions: '2 sessions'   },
      'Operations':          { score: 72, label: 'Operations candidates',      sessions: '1–2 sessions' },
      'Human Resources':     { score: 72, label: 'HR candidates',              sessions: '1–2 sessions' },
      'Nonprofit':           { score: 70, label: 'Nonprofit candidates',       sessions: '1–2 sessions' },
      'Government':          { score: 70, label: 'Government candidates',      sessions: '1–2 sessions' },
      'Coffee Chat':         { score: 68, label: 'Confident networkers',       sessions: '1 session'    },
      'General':             { score: 72, label: 'Successful candidates',      sessions: '1–2 sessions' },
    }
    return byType[type] ?? byType['General']
  }

  const sendEmail = async () => {
    if (!emailAddress.trim() || !result || !sessionData) return
    setEmailStatus('sending')
    setEmailError('')
    try {
      let firstName = ''
      try {
        const m = localStorage.getItem(`session_meta_${sessionId}`)
        if (m) firstName = JSON.parse(m).firstName || ''
      } catch {}
      const res = await fetch('/api/email-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddress.trim(),
          firstName,
          company: sessionData.company,
          role: sessionData.role,
          result,
          fillerCount: fillerData?.totalFillers ?? 0,
          blindSpot: result.blindSpot,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send email')
      }
      setEmailStatus('sent')
    } catch (err: any) {
      setEmailError(err.message || 'Something went wrong')
      setEmailStatus('error')
    }
  }

  const generateShareCard = () => {
    if (!result || !sessionData) return
    setIsGenerating(true)

    try {
      const W = 1200
      const H = 630
      const DPR = 2

      const canvas = document.createElement('canvas')
      canvas.width = W * DPR
      canvas.height = H * DPR
      const ctx = canvas.getContext('2d')!
      ctx.scale(DPR, DPR)

      // ── Helper: wrap text to fit maxW ──────────────────
      function wrapText(text: string, font: string, maxW: number): string[] {
        ctx.font = font
        const words = text.split(' ')
        const lines: string[] = []
        let line = ''
        for (const word of words) {
          const test = line ? `${line} ${word}` : word
          if (ctx.measureText(test).width > maxW && line) {
            lines.push(line)
            line = word
          } else {
            line = test
          }
        }
        if (line) lines.push(line)
        return lines
      }

      // ── Background gradient ────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#0e0e1c')
      bg.addColorStop(1, '#05050d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // ── Indigo top accent bar ──────────────────────────
      ctx.fillStyle = '#6366f1'
      ctx.fillRect(0, 0, W, 4)

      // ── Score colour ───────────────────────────────────
      const score = result.overallScore
      const scoreStr = score.toString()
      const scoreHex = score >= 8 ? '#4ade80' : score >= 6 ? '#facc15' : '#f87171'
      const { grade, label } = overallGrade(score)

      // ── Radial glow behind score ───────────────────────
      const glow = ctx.createRadialGradient(290, 290, 0, 290, 290, 230)
      glow.addColorStop(0, scoreHex + '28')
      glow.addColorStop(0.6, scoreHex + '08')
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)

      // ── LEFT PANEL (center x = 290) ────────────────────
      const LCX = 290

      // "OVERALL SCORE" label
      ctx.fillStyle = '#4b5563'
      ctx.font = '500 11px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('OVERALL SCORE', LCX, 108)

      // Score + "/10" measured and centred together
      const SCORE_FONT = 'bold 118px system-ui, -apple-system, sans-serif'
      const SUFFIX_FONT = '300 36px system-ui, -apple-system, sans-serif'
      ctx.font = SCORE_FONT
      const scoreW = ctx.measureText(scoreStr).width
      ctx.font = SUFFIX_FONT
      const suffixW = ctx.measureText('/10').width
      const numStart = LCX - (scoreW + 10 + suffixW) / 2

      ctx.font = SCORE_FONT
      ctx.fillStyle = scoreHex
      ctx.textAlign = 'left'
      ctx.fillText(scoreStr, numStart, 306)

      ctx.font = SUFFIX_FONT
      ctx.fillStyle = '#374151'
      ctx.fillText('/10', numStart + scoreW + 10, 306)

      // Grade pill
      const PILL_FONT = 'bold 14px system-ui, -apple-system, sans-serif'
      ctx.font = PILL_FONT
      const pillText = `${grade}  ·  ${label}`
      const pillTW = ctx.measureText(pillText).width
      const pillPX = 22
      const pillH = 34
      const pillW = pillTW + pillPX * 2
      const pillX = LCX - pillW / 2
      const pillY = 332

      ctx.fillStyle = '#1f2937'
      ctx.beginPath()
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2)
      ctx.fill()
      ctx.fillStyle = '#e5e7eb'
      ctx.textAlign = 'center'
      ctx.fillText(pillText, LCX, pillY + 22)

      // ── Vertical divider ───────────────────────────────
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(575, 48)
      ctx.lineTo(575, 552)
      ctx.stroke()

      // ── RIGHT PANEL ────────────────────────────────────
      const RPX = 618
      const RPW = 1158 - RPX // 540 px

      // "PRACTICED FOR" eyebrow
      ctx.fillStyle = '#4b5563'
      ctx.font = '500 11px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('PRACTICED FOR', RPX, 108)

      // Role (up to 2 lines)
      const ROLE_FONT = 'bold 32px system-ui, -apple-system, sans-serif'
      const roleLines = wrapText(sessionData.role, ROLE_FONT, RPW).slice(0, 2)
      ctx.fillStyle = '#f9fafb'
      ctx.font = ROLE_FONT
      roleLines.forEach((line, i) => ctx.fillText(line, RPX, 148 + i * 40))
      const afterRole = 148 + roleLines.length * 40

      // "at"
      ctx.fillStyle = '#6b7280'
      ctx.font = '400 13px system-ui, -apple-system, sans-serif'
      ctx.fillText('at', RPX, afterRole + 16)

      // Company (indigo, single line truncated)
      const CO_FONT = 'bold 26px system-ui, -apple-system, sans-serif'
      ctx.font = CO_FONT
      let company = sessionData.company
      while (ctx.measureText(company).width > RPW && company.length > 1) {
        company = company.slice(0, -1)
      }
      if (company !== sessionData.company) company += '…'
      ctx.fillStyle = '#818cf8'
      ctx.fillText(company, RPX, afterRole + 50)

      // Section divider
      const divY = afterRole + 72
      ctx.strokeStyle = '#1f2937'
      ctx.beginPath()
      ctx.moveTo(RPX, divY)
      ctx.lineTo(1158, divY)
      ctx.stroke()

      // ── Score dimension bars ───────────────────────────
      const dims = ['Clarity', 'Confidence', 'Structure', 'Relevance'] as const
      const dimKeys = ['clarity', 'confidence', 'structure', 'relevance'] as const
      const avgScores = dimKeys.map(key =>
        result.evaluations.reduce((s, ev) => s + ev.scores[key], 0) / result.evaluations.length
      )

      const BAR_H = 7
      const BAR_SPACING = 42
      const barY0 = divY + 26

      dims.forEach((dim, i) => {
        const y = barY0 + i * BAR_SPACING
        const avg = avgScores[i]
        const barColor = avg >= 8 ? '#4ade80' : avg >= 6 ? '#facc15' : '#f87171'

        ctx.fillStyle = '#9ca3af'
        ctx.font = '400 12px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(dim, RPX, y)

        ctx.fillStyle = '#6b7280'
        ctx.font = '600 12px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(avg.toFixed(1), 1158, y)

        // Track
        ctx.fillStyle = '#1f2937'
        ctx.beginPath()
        ctx.roundRect(RPX, y + 7, RPW, BAR_H, 4)
        ctx.fill()

        // Fill
        const fillW = (avg / 10) * RPW
        if (fillW > 0) {
          ctx.fillStyle = barColor
          ctx.beginPath()
          ctx.roundRect(RPX, y + 7, fillW, BAR_H, 4)
          ctx.fill()
        }
      })

      // ── Footer ─────────────────────────────────────────
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, 560)
      ctx.lineTo(W, 560)
      ctx.stroke()

      // App icon box
      ctx.fillStyle = '#6366f1'
      ctx.beginPath()
      ctx.roundRect(40, 577, 30, 30, 7)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('AI', 55, 597)

      // "Practiced with Interview AI"
      ctx.textAlign = 'left'
      ctx.font = '400 14px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#6b7280'
      ctx.fillText('Practiced with', 82, 597)
      ctx.font = '400 14px system-ui, -apple-system, sans-serif'
      const prefixW = ctx.measureText('Practiced with ').width
      ctx.font = '600 14px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#a5b4fc'
      ctx.fillText('Interview AI', 82 + prefixW, 597)

      // ── Download ───────────────────────────────────────
      const slug = sessionData.company.toLowerCase().replace(/\s+/g, '-')
      const a = document.createElement('a')
      a.download = `interview-ai-${slug}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Evaluating your interview...</p>
          <p className="text-gray-500 text-sm">Claude is reviewing your answers</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-md shadow-indigo-600/25"
          >
            Start Over
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const { grade, label } = overallGrade(result.overallScore)

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-white/[0.06] px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
          <LogoMark className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white">Interview AI</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Auto-email status banner */}
        {autoEmailStatus === 'sent' && (
          <div className="flex items-center gap-2.5 bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-300">Results sent to your email.</p>
          </div>
        )}

        {/* Blind Spot Callout */}
        {result.blindSpot?.name && (
          <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-gray-900/60 backdrop-blur-sm shadow-lg shadow-black/20">
            {/* Subtle red gradient wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 via-transparent to-transparent pointer-events-none" />
            <div className="relative px-6 py-5 flex flex-col gap-2">
              <p className="text-xs font-semibold text-red-500/70 uppercase tracking-widest">Your Blind Spot</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-white">{result.blindSpot.name}</span>
                <span className="text-gray-500 text-sm">—</span>
                <span className="text-gray-300 text-sm leading-relaxed">{result.blindSpot.description}</span>
              </div>
            </div>
          </div>
        )}

        {/* Overall Score */}
        <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 text-center shadow-xl shadow-black/30">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-6">Overall Score</p>
          <div className="flex items-center justify-center mb-5">
            {(() => {
              const r = 72
              const circ = 2 * Math.PI * r
              const pct = result.overallScore / 10
              const dash = `${(pct * circ).toFixed(1)} ${((1 - pct) * circ).toFixed(1)}`
              const hexColor = result.overallScore >= 8 ? '#4ade80' : result.overallScore >= 6 ? '#facc15' : '#f87171'
              return (
                <div className="relative inline-flex items-center justify-center w-48 h-48">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r={r} fill="none" stroke="#1f2937" strokeWidth="9" />
                    <circle
                      cx="80" cy="80" r={r}
                      fill="none" stroke={hexColor} strokeWidth="9"
                      strokeLinecap="round" strokeDasharray={dash}
                    />
                  </svg>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-6xl font-bold tabular-nums ${scoreColor(result.overallScore)}`}>
                      {result.overallScore}
                    </span>
                    <span className="text-gray-600 text-sm">/10</span>
                  </div>
                </div>
              )
            })()}
          </div>
          <div className="inline-flex items-center gap-2 bg-gray-800/80 rounded-full px-4 py-1.5">
            <span className="text-white font-bold">{grade}</span>
            <span className="text-gray-400 text-sm">— {label}</span>
          </div>
        </div>

        {/* Goal Gradient */}
        {(() => {
          const bench = getBenchmark(interviewType, sessionData?.company ?? '')
          const userScore = Math.round(result.overallScore * 10)
          const gap = bench.score - userScore

          if (gap <= 0) {
            return (
              <div className="flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-2xl px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-300">Above benchmark</p>
                  <p className="text-sm text-gray-400">
                    You scored <span className="font-semibold text-white">{userScore}</span> — {bench.label} typically target {bench.score}+. Keep going.
                  </p>
                </div>
              </div>
            )
          }

          const urgency = gap >= 20
            ? { color: 'border-red-500/20 bg-red-500/5', dot: 'bg-red-500/20', icon: 'text-red-400', bar: 'bg-red-500', msg: `Focused practice across ${bench.sessions} can close this.` }
            : gap >= 10
            ? { color: 'border-amber-500/20 bg-amber-500/5', dot: 'bg-amber-500/20', icon: 'text-amber-400', bar: 'bg-amber-500', msg: `Most users close that gap in ${bench.sessions}.` }
            : { color: 'border-yellow-500/20 bg-yellow-500/5', dot: 'bg-yellow-500/20', icon: 'text-yellow-400', bar: 'bg-yellow-500', msg: `You're close — ${bench.sessions} should get you there.` }

          const pct = Math.min(99, Math.round((userScore / bench.score) * 100))

          return (
            <div className={`border rounded-2xl px-5 py-4 flex flex-col gap-3 ${urgency.color}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-0.5">
                    You scored <span className={urgency.icon}>{userScore}</span>.{' '}
                    {bench.label} typically score <span className="text-white">{bench.score}+</span>.
                  </p>
                  <p className="text-sm text-gray-400">
                    You're <span className="font-semibold text-white">{gap} points away</span> — {urgency.msg}
                  </p>
                </div>
                <div className={`shrink-0 w-9 h-9 rounded-full ${urgency.dot} flex items-center justify-center`}>
                  <svg className={`w-4.5 h-4.5 ${urgency.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              {/* Progress bar toward benchmark */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Your score</span>
                  <span>Benchmark: {bench.score}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${urgency.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          )
        })()}

        {/* Per-Question Breakdown */}
        <div>
          <h2 className="text-white font-semibold text-lg mb-4">Question Breakdown</h2>
          <div className="space-y-4">
            {result.evaluations.map((ev, i) => (
              <div key={i} className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-5 shadow-lg shadow-black/20">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-gray-200 font-medium text-sm leading-relaxed flex-1">
                    <span className="text-indigo-400 font-semibold">Q{i + 1}.</span> {ev.question}
                  </p>
                  <span className={`text-2xl font-bold tabular-nums shrink-0 ${scoreColor(ev.average)}`}>
                    {ev.average}
                  </span>
                </div>

                {/* Score bars */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(ev.scores).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 capitalize">{key}</span>
                        <span className="text-gray-400">{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${val * 10}%`, background: scoreBarGradient(val) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* STAR Analysis */}
                <div className="border border-gray-700/60 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">STAR Analysis</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Score</span>
                      <span className={`text-sm font-bold tabular-nums ${ev.star.starScore >= 3 ? 'text-green-400' : ev.star.starScore >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {ev.star.starScore}
                      </span>
                      <span className="text-xs text-gray-600">/4</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {(['situation', 'task', 'action', 'result'] as const).map((component) => {
                      const rating = ev.star[component] as StarRating
                      const style = starRatingStyle(rating)
                      return (
                        <div key={component} className={`rounded-lg border px-3 py-2 ${style.bg} ${style.border}`}>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            {component[0].toUpperCase()}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                            <span className={`text-xs font-medium ${style.text}`}>{starRatingLabel(rating)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {ev.star.starCoaching && (
                    <div className="flex gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-indigo-300 leading-relaxed">{ev.star.starCoaching}</p>
                    </div>
                  )}
                </div>

                {/* Answer preview */}
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">Your answer</p>
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{ev.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filler Words */}
        {fillerData && (
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
                  {/* mic icon */}
                  <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">Filler Words</h2>
                  <p className="text-xs text-gray-500">A habit you may not have noticed</p>
                </div>
              </div>
              {/* Fluency score badge */}
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${fillerData.score >= 8 ? 'text-green-400' : fillerData.score >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {fillerData.score}
                  </span>
                  <span className="text-xs text-gray-600">/10</span>
                </div>
                <span className="text-xs text-gray-500">Fluency</span>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Summary callout */}
              {fillerData.totalFillers === 0 ? (
                <div className="flex items-center gap-2.5 bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-300">No filler words detected — clean, confident delivery.</p>
                </div>
              ) : (
                <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
                  fillerData.score >= 7
                    ? 'bg-yellow-500/8 border-yellow-500/20'
                    : 'bg-red-500/8 border-red-500/20'
                }`}>
                  <svg className={`w-4 h-4 shrink-0 mt-0.5 ${fillerData.score >= 7 ? 'text-yellow-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className={`text-sm leading-relaxed ${fillerData.score >= 7 ? 'text-yellow-300' : 'text-red-300'}`}>
                    You used <span className="font-semibold">{fillerData.totalFillers} filler word{fillerData.totalFillers !== 1 ? 's' : ''}</span> across {result!.evaluations.length} answers
                    {fillerData.totalWords > 0 && (
                      <> — about <span className="font-semibold">1 every {Math.round(fillerData.totalWords / fillerData.totalFillers)} words</span></>
                    )}.
                    {fillerData.score < 5
                      ? ' This is a significant pattern that interviewers notice. Slow down and replace fillers with a brief pause.'
                      : ' A few fillers are normal, but practice catching yourself to sound more polished.'}
                  </p>
                </div>
              )}

              {/* Per-question bars */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Question</p>
                <div className="flex flex-col gap-2">
                  {result!.evaluations.map((ev, i) => {
                    const count = fillerData.perAnswer[i].total
                    const barPct = fillerData.maxPerAnswer > 0 ? (count / fillerData.maxPerAnswer) * 100 : 0
                    const barColor = count === 0 ? 'bg-gray-700' : count <= 2 ? 'bg-yellow-500' : 'bg-red-500'
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-4 shrink-0 text-right">Q{i + 1}</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.max(barPct, count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium w-14 shrink-0 ${count === 0 ? 'text-gray-600' : count <= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {count === 0 ? 'none' : `${count} filler${count !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top filler words */}
              {fillerData.ranked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Most Used</p>
                  <div className="flex flex-wrap gap-2">
                    {fillerData.ranked.map(({ word, count }, i) => (
                      <div
                        key={word}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
                          i === 0
                            ? 'bg-red-500/12 border-red-500/25 text-red-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400'
                        }`}
                      >
                        <span>"{word}"</span>
                        <span className={`font-bold ${i === 0 ? 'text-red-400' : 'text-gray-500'}`}>×{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-700 leading-relaxed">
                Detection covers: um, uh, like, so, literally, basically, right, you know, kind of, sort of.
                Some may reflect intentional usage — use as a directional signal, not an exact count.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Biggest Mistakes */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-red-500/20 rounded-2xl p-5 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm">3 Biggest Mistakes</h3>
            </div>
            <ol className="space-y-2.5">
              {result.biggestMistakes.map((mistake, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-gray-300 leading-relaxed">{mistake}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Improvements */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-green-500/20 rounded-2xl p-5 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm">3 Key Improvements</h3>
            </div>
            <ol className="space-y-2.5">
              {result.improvements.map((tip, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="text-green-500 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-gray-300 leading-relaxed">{tip}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Example Better Answer */}
        <div className="bg-gray-900/60 backdrop-blur-sm border border-indigo-500/20 rounded-2xl p-5 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-sm">Example Better Answer</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {result.exampleBetterAnswer}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4 pb-8">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={generateShareCard}
            disabled={isGenerating || !sessionData}
            className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 font-semibold px-6 py-3 rounded-xl transition-all duration-200 border border-gray-700/60 hover:border-gray-600/70 shadow-md"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Share Your Score
              </>
            )}
          </button>
          <button
            onClick={() => router.push(`/interview/${sessionId}`)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Interview
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold px-6 py-3 rounded-xl transition-all duration-200 border border-gray-700/60 hover:border-gray-600/70 shadow-md"
          >
            New Interview
          </button>

          <button
            onClick={() => { setEmailOpen((o) => !o); setEmailStatus('idle'); setEmailError('') }}
            className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 font-semibold px-6 py-3 rounded-xl transition-all duration-200 border border-gray-700/60 hover:border-gray-600/70 shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email My Results
          </button>
        </div>

        {/* Email input panel */}
        {emailOpen && (
          <div className="w-full max-w-sm">
            {emailStatus === 'sent' ? (
              <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-300">Results sent to <span className="font-medium">{emailAddress}</span></p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendEmail()}
                    placeholder="your@email.com"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={sendEmail}
                    disabled={emailStatus === 'sending' || !emailAddress.trim()}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-sm shadow-indigo-600/20 disabled:shadow-none"
                  >
                    {emailStatus === 'sending' ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : 'Send'}
                  </button>
                </div>
                {emailStatus === 'error' && (
                  <p className="text-xs text-red-400 px-1">{emailError}</p>
                )}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Share Your Feedback */}
        <div>
          <h2 className="text-white font-semibold text-lg mb-4">Share Your Feedback</h2>
          <iframe
            src="https://docs.google.com/forms/d/1aCvDzFyUWJx4-KkPzQ-FINWARaYjY6f276phmf4SxAU/viewform?embedded=true"
            width="100%"
            height="600"
            style={{ border: 'none', display: 'block' }}
          >
            Loading…
          </iframe>
        </div>

        {/* Footer */}
        <footer className="pb-10 pt-4 text-center">
          <p className="text-xs text-gray-700">© 2026 Interview AI&nbsp;&nbsp;·&nbsp;&nbsp;Built for students, by students</p>
        </footer>
      </div>
    </div>
  )
}
