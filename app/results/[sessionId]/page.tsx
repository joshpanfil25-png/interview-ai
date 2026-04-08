'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { EvaluationResult } from '@/app/api/evaluate/route'
import { supabase } from '@/lib/supabase'

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [sessionData, setSessionData] = useState<{ company: string; role: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

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

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const scoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500'
    if (score >= 6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const overallGrade = (score: number) => {
    if (score >= 9) return { grade: 'A+', label: 'Outstanding' }
    if (score >= 8) return { grade: 'A', label: 'Excellent' }
    if (score >= 7) return { grade: 'B', label: 'Good' }
    if (score >= 6) return { grade: 'C', label: 'Fair' }
    return { grade: 'D', label: 'Needs Work' }
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.96.96 0 01-.65.244H7.28a.96.96 0 01-.65-.244l-.348-.347z" />
          </svg>
        </div>
        <span className="font-semibold text-white">Interview AI</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Overall Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">Overall Score</p>
          <div className="flex items-end justify-center gap-3 mb-2">
            <span className={`text-7xl font-bold tabular-nums ${scoreColor(result.overallScore)}`}>
              {result.overallScore}
            </span>
            <span className="text-3xl text-gray-600 mb-2">/10</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5">
            <span className="text-white font-bold">{grade}</span>
            <span className="text-gray-400 text-sm">— {label}</span>
          </div>
        </div>

        {/* Per-Question Breakdown */}
        <div>
          <h2 className="text-white font-semibold text-lg mb-4">Question Breakdown</h2>
          <div className="space-y-4">
            {result.evaluations.map((ev, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
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
                          className={`h-full rounded-full transition-all ${scoreBarColor(val)}`}
                          style={{ width: `${val * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
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

        {/* Feedback Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Biggest Mistakes */}
          <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-5">
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
          <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-5">
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
        <div className="bg-gray-900 border border-indigo-900/30 rounded-2xl p-5">
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
        <div className="flex flex-wrap gap-3 justify-center pb-8">
          <button
            onClick={generateShareCard}
            disabled={isGenerating || !sessionData}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 font-semibold px-6 py-3 rounded-xl transition-colors border border-gray-700"
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
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Interview
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            New Interview
          </button>
        </div>
      </div>
    </div>
  )
}
