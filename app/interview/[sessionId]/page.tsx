'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient'
import { countFillers, rankFillers } from '@/lib/fillerWords'
import { GlassWordmark, RunbackLogoChip } from '@/app/components/teal-glass'

type Question = {
  id: string
  question_text: string
  question_type: string
  order_index: number
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function InterviewPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const TIMER_SECONDS = 120

  // ── Core state ──────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [error, setError] = useState('')
  const [webcamError, setWebcamError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)
  const [micError, setMicError] = useState('')
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [timerExpired, setTimerExpired] = useState(false)
  const [feedback, setFeedback] = useState<{ score: number; didWell: string; improve: string } | null>(null)
  const [timerResetKey, setTimerResetKey] = useState(0)

  // ── Refs ────────────────────────────────────────────────────
  const webcamRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Whether the user currently intends to be recording. Kept in a ref so the
  // SpeechRecognition `onend` handler (which fires early on mobile) can decide
  // whether to auto-restart the session or actually stop.
  const wantRecordingRef = useRef(false)
  // Whether mic permission has been granted (preflighted up front, separate
  // from the record toggle).
  const micReadyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load questions from Supabase ────────────────────────────
  useEffect(() => {
    async function loadQuestions() {
      const supabase = getSupabaseBrowserClient()
      // Ensure the auth session is hydrated before querying so a logged-in
      // user's JWT is attached (auth.uid() = user_id). Guests have no session,
      // so this is a no-op and reads run as anon → null-user_id rows visible.
      await supabase.auth.getSession()

      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('order_index')

      if (error) {
        setError('Failed to load questions. Please go back and try again.')
      } else if (!data || data.length === 0) {
        setError('No questions found. Please go back and generate an interview.')
      } else {
        setQuestions(data)
      }
      setIsLoading(false)
    }
    loadQuestions()
  }, [sessionId])

  // ── Start webcam ────────────────────────────────────────────
  useEffect(() => {
    async function startWebcam() {
      try {
        // Request camera + mic together so mic permission is granted up front,
        // separately from the record toggle. Keep video for the preview and
        // release the mic track immediately — SpeechRecognition acquires its own.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getAudioTracks().forEach((t) => t.stop())
        micReadyRef.current = true
        streamRef.current = stream
        if (webcamRef.current) webcamRef.current.srcObject = stream
      } catch {
        // Mic (or camera) denied — fall back to video-only so the preview still
        // works; recording will re-request mic and surface an error if needed.
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true })
          streamRef.current = videoOnly
          if (webcamRef.current) webcamRef.current.srcObject = videoOnly
        } catch {
          setWebcamError('Webcam not available or permission denied.')
        }
      }
    }
    startWebcam()

    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSpeechSupported(false)
    }

    return () => {
      wantRecordingRef.current = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      recognitionRef.current?.stop()
    }
  }, [])

  // ── Countdown timer ──────────────────────────────────────────
  useEffect(() => {
    if (isLoading || questions.length === 0) return

    setTimeLeft(TIMER_SECONDS)
    setTimerExpired(false)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setTimerExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current!)
  }, [currentIndex, isLoading, questions.length, timerResetKey])

  // ── Speech recognition ───────────────────────────────────────
  // Build + start a recognition session. Separated so `onend` can restart it
  // on mobile without re-running the permission flow.
  const beginRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
      }
      if (final) setTranscript((prev) => prev + final)
    }
    recognition.onerror = (event: any) => {
      // Fatal permission errors: stop and tell the user. Transient ones
      // (no-speech, aborted, network blips) fall through to onend's restart.
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        wantRecordingRef.current = false
        micReadyRef.current = false
        setMicError('Microphone access was denied. Allow it for this site in your browser settings, or type your answer below.')
        setIsRecording(false)
      }
    }
    recognition.onend = () => {
      // Mobile browsers (especially iOS) end the session early even with
      // continuous = true. While the user still intends to record, restart to
      // emulate a continuous session instead of stopping — the core mobile fix.
      if (wantRecordingRef.current) {
        try {
          recognition.start()
        } catch {
          /* start() throws if it is already (re)starting — safe to ignore */
        }
      } else {
        setIsRecording(false)
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      wantRecordingRef.current = false
      setIsRecording(false)
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!speechSupported) return
    setMicError('')
    // Mic permission is handled separately from the toggle. If the up-front
    // preflight didn't grant it, request it once here before recording. When it
    // was already granted, this branch is skipped so recognition.start() still
    // runs inside the tap gesture (important for mobile Safari).
    if (!micReadyRef.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true })
        s.getTracks().forEach((t) => t.stop())
        micReadyRef.current = true
      } catch {
        setMicError('Microphone access is blocked. Allow mic access for this site, or type your answer below.')
        return
      }
    }
    wantRecordingRef.current = true
    setIsRecording(true)
    beginRecognition()
  }, [speechSupported, beginRecognition])

  const stopRecording = useCallback(() => {
    // Clear intent first so onend does not auto-restart the session.
    wantRecordingRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  // ── Submit answer → fetch instant feedback ────────────────────
  const handleNextClick = async () => {
    if (!transcript.trim()) {
      setError('Please record or type an answer before continuing.')
      return
    }
    setError('')
    setIsSaving(true)

    // Stop recording if active
    wantRecordingRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
    clearInterval(timerRef.current!)

    const currentQuestion = questions[currentIndex]

    // Upsert answer (overwrites any previous attempt for this question). Uses
    // the auth-aware browser client so a logged-in user's write passes RLS
    // (parent session owned by auth.uid()); guests write as anon to their
    // null-owned session, unchanged.
    const supabase = getSupabaseBrowserClient()
    const { error: saveError } = await supabase.from('answers').upsert(
      { session_id: sessionId, question_id: currentQuestion.id, answer_text: transcript.trim() },
      { onConflict: 'session_id,question_id' }
    )

    if (saveError) {
      setError('Failed to save answer. Please try again.')
      setIsSaving(false)
      return
    }

    setIsSaving(false)

    // On the final question, skip the per-question feedback step and go straight
    // to the full results page. The answer is already saved above, and full
    // scoring runs on the results page — the instant single-answer feedback
    // (shown on questions 1..N-1) adds nothing on the last question and was what
    // forced the user to press "Finish & Get Results" a second time.
    if (currentIndex === questions.length - 1) {
      advanceQuestion()
      return
    }

    setIsEvaluating(true)

    try {
      const res = await fetch('/api/evaluate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion.question_text,
          answer: transcript.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Feedback request failed')
      setFeedback(data)
    } catch {
      // If feedback fails, just advance without showing the panel
      setFeedback(null)
      advanceQuestion()
    } finally {
      setIsEvaluating(false)
    }
  }

  // ── Try Again — re-record the same question ───────────────────
  const handleTryAgain = () => {
    setFeedback(null)
    setTranscript('')
    setTimerResetKey((k) => k + 1)
  }

  // ── Advance to next question or finish ────────────────────────
  const advanceQuestion = () => {
    setFeedback(null)
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setTranscript('')
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      router.push(`/results/${sessionId}`)
    }
  }

  // ── Loading screen ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">Loading your interview...</p>
        </div>
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-brand-hover hover:bg-brand text-white text-sm px-5 py-2 rounded-md font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values ───────────────────────────────────────────
  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100
  const isWarning = timeLeft <= 30 && !timerExpired
  const timerDisplay = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  const typeLabels: Record<string, string> = {
    behavioral: 'Behavioral',
    'role-specific': 'Role-Specific',
    curveball: 'Curveball',
  }
  const typeColors: Record<string, string> = {
    behavioral: 'bg-blue-500/10 text-blue-700',
    'role-specific': 'bg-purple-500/10 text-purple-700',
    curveball: 'bg-orange-500/10 text-orange-700',
  }

  // ── Main interview screen ────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative animate-fade-in overflow-x-clip bg-gradient-to-b from-white to-[#F1F4F6]">
      {/* Evaluating overlay */}
      {isEvaluating && (
        <div className="absolute inset-0 z-50 bg-white/85 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-ink/70">Evaluating your response…</p>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className="bg-[rgba(255,255,255,0.6)] backdrop-blur-[12px] border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <RunbackLogoChip size={28} />
          <GlassWordmark className="text-sm" />
        </div>
        <span className="text-brand bg-brand/10 px-2.5 py-1 rounded-md text-xs font-semibold">● LIVE</span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-0 lg:overflow-hidden">
        {/* Webcam sidebar */}
        <div className="w-full lg:w-72 bg-[rgba(255,255,255,0.4)] border-b lg:border-b-0 lg:border-r border-[rgba(31,37,43,0.08)] flex flex-col items-center justify-start p-4 gap-3">
          <div className="w-full max-w-[260px] lg:max-w-none aspect-video bg-surface-inset rounded-lg overflow-hidden relative">
            {webcamError ? (
              <div className="absolute inset-0 flex items-center justify-center text-center p-3">
                <p className="text-ink/70 text-xs">{webcamError}</p>
              </div>
            ) : (
              <video
                ref={webcamRef}
                autoPlay muted playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            {isRecording && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-red-500/90 rounded-full px-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-xs text-white font-medium">REC</span>
              </div>
            )}
          </div>
          <p className="text-xs text-ink/60 text-center">Your camera feed (not recorded)</p>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-8 lg:overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full min-w-0 flex flex-col gap-6 flex-1">

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-ink">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-sm text-ink/60">{Math.round(progress)}% complete</span>
              </div>
              <div className="h-1.5 bg-[rgba(31,37,43,0.08)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 mx-0.5 rounded-full transition-colors ${
                      i < currentIndex ? 'bg-brand' : i === currentIndex ? 'bg-brand/80' : 'bg-[rgba(31,37,43,0.1)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Badge + timer row */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[currentQuestion?.question_type] || 'bg-[rgba(31,37,43,0.08)] text-ink/60'}`}>
                {typeLabels[currentQuestion?.question_type] || currentQuestion?.question_type}
              </span>

              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors duration-300 ${
                timerExpired || isWarning ? 'bg-red-500/10 border-red-500/30' : 'bg-surface border-[rgba(31,37,43,0.08)]'
              }`}>
                <svg
                  className={`w-3.5 h-3.5 shrink-0 ${timerExpired || isWarning ? 'text-red-600' : 'text-ink/60'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`text-sm font-mono font-semibold tabular-nums ${timerExpired || isWarning ? 'text-red-600' : 'text-ink/70'}`}>
                  {timerDisplay}
                </span>
              </div>
            </div>

            {/* Question text */}
            <div className="relative bg-surface border border-line rounded-2xl p-5 sm:p-6 overflow-hidden shadow-[0_16px_40px_rgba(31,37,43,0.07)]">
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg,#0D5F63,#A8E0DD)' }} />
              <p className="font-serif text-2xl font-semibold text-ink leading-relaxed tracking-tight break-words">
                {currentQuestion?.question_text}
              </p>
            </div>

            {/* Time's up warning */}
            {timerExpired && (
              <div className="flex items-center gap-2.5 bg-red-500/[0.06] border border-red-500/20 rounded-md px-4 py-3">
                <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-700 text-sm">Time&apos;s up — wrap up your answer and move on when you&apos;re ready.</p>
              </div>
            )}

            {/* Feedback panel or answer controls */}
            {feedback ? (
              <div className="bg-surface border border-[rgba(31,37,43,0.08)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-[0_16px_40px_rgba(31,37,43,0.07)]">
                {/* Score */}
                <div className="flex items-center gap-3">
                  <span className="font-serif font-bold text-5xl text-brand tabular-nums">{feedback.score}</span>
                  <span className="text-xl text-ink/60 font-medium">/&thinsp;10</span>
                </div>

                {/* What they did well */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700">What you did well</p>
                  <p className="text-sm text-ink/80 leading-relaxed">{feedback.didWell}</p>
                </div>

                {/* One thing to improve */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">One thing to improve</p>
                  <p className="text-sm text-ink/80 leading-relaxed">{feedback.improve}</p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3 gap-y-3 pt-1">
                  <button
                    onClick={handleTryAgain}
                    className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm bg-[rgba(31,37,43,0.04)] hover:bg-[rgba(31,37,43,0.08)] border border-[rgba(31,37,43,0.1)] text-ink/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={advanceQuestion}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white font-semibold px-4 py-2 rounded-md shadow-[0_8px_20px_rgba(13,95,99,0.25)] transition-all text-sm"
                  >
                    {/* The feedback panel only renders on questions 1..N-1 (the
                        last question skips instant feedback and goes straight to
                        results), so this button is always "Next Question". */}
                    Next Question
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Answer textarea */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-ink/70">Your Answer</label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={speechSupported ? 'Click "Start Recording" to speak, or type your answer here...' : 'Type your answer here...'}
                    rows={7}
                    className="w-full bg-surface-input border border-[rgba(31,37,43,0.12)] rounded-md px-3 py-2.5 text-ink placeholder-ink/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none transition-colors text-sm leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink/60">
                      {transcript.trim().split(/\s+/).filter(Boolean).length} words
                    </p>
                    {(() => {
                      const { total, breakdown } = countFillers(transcript)
                      if (total === 0) return null
                      const top = rankFillers([{ total, breakdown }])[0]
                      return (
                        <p className="text-xs text-yellow-700/80">
                          {total} filler word{total !== 1 ? 's' : ''} detected
                          {top ? <span className="text-yellow-700/60"> · &quot;{top.word}&quot; ×{top.count}</span> : null}
                        </p>
                      )
                    })()}
                  </div>
                </div>

                {/* Recording + submit row */}
                <div className="flex flex-wrap items-center gap-3 gap-y-3">
                  {speechSupported && (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                        isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-[rgba(31,37,43,0.04)] hover:bg-[rgba(31,37,43,0.08)] border border-[rgba(31,37,43,0.1)] text-ink/80'
                      }`}
                    >
                      {isRecording ? (
                        <><div className="w-2 h-2 rounded-sm bg-white" />Stop Recording</>
                      ) : (
                        <><div className="w-2 h-2 rounded-full bg-red-500" />Start Recording</>
                      )}
                    </button>
                  )}

                  {transcript && (
                    <button onClick={() => setTranscript('')} className="text-sm text-ink/60 hover:text-ink transition-colors">
                      Clear
                    </button>
                  )}

                  <div className="flex-1" />

                  <button
                    onClick={handleNextClick}
                    disabled={isSaving || isEvaluating || !transcript.trim()}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-hover disabled:bg-brand-hover/40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-md shadow-[0_8px_20px_rgba(13,95,99,0.25)] transition-all text-sm"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : currentIndex < questions.length - 1 ? (
                      <>Next Question<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
                    ) : (
                      'Finish & Get Results'
                    )}
                  </button>
                </div>
              </>
            )}

            {micError && (
              <p className="text-amber-700 text-sm bg-amber-500/[0.08] border border-amber-500/25 rounded-md px-3 py-2.5">
                {micError}
              </p>
            )}
            {error && (
              <p className="text-red-700 text-sm bg-red-500/[0.06] border border-red-500/20 rounded-md px-3 py-2.5">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
