'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [error, setError] = useState('')
  const [webcamError, setWebcamError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [timerExpired, setTimerExpired] = useState(false)

  // ── HeyGen state ────────────────────────────────────────────
  const [preparingVideos, setPreparingVideos] = useState(true)
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})
  const [videoEnded, setVideoEnded] = useState(false)
  const [videoProgress, setVideoProgress] = useState({ completed: 0, total: 6 })
  const [waitingForVideo, setWaitingForVideo] = useState(false)

  // ── Refs ────────────────────────────────────────────────────
  const webcamRef = useRef<HTMLVideoElement>(null)
  const avatarVideoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load questions from Supabase ────────────────────────────
  useEffect(() => {
    async function loadQuestions() {
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

  // ── HeyGen: submit + poll ────────────────────────────────────
  useEffect(() => {
    if (questions.length === 0) return

    let cancelled = false

    async function startHeygen() {
      try {
        // Submit video generation jobs
        const genRes = await fetch('/api/heygen/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const genData = await genRes.json()

        // HeyGen not configured — skip loading screen immediately
        if (genData.skipped || !genRes.ok) {
          if (!cancelled) setPreparingVideos(false)
          return
        }

        // Fallback: start interview after 3 min even if first video never arrives
        const firstVideoTimeout = setTimeout(() => {
          if (!cancelled) setPreparingVideos(false)
        }, 180_000)

        // Stop all polling after 8 min
        const allDoneTimeout = setTimeout(() => {
          if (!cancelled) {
            setPreparingVideos(false)
            clearInterval(pollRef.current!)
          }
        }, 480_000)

        const poll = async () => {
          if (cancelled) return
          try {
            const res = await fetch(`/api/heygen/status?sessionId=${sessionId}`)
            const data = await res.json()

            if (data.noHeygen || !res.ok) {
              setPreparingVideos(false)
              clearInterval(pollRef.current!)
              clearTimeout(firstVideoTimeout)
              clearTimeout(allDoneTimeout)
              return
            }

            // Accumulate video URLs
            const urls: Record<string, string> = {}
            for (const v of data.videos ?? []) {
              if (v.videoUrl) urls[v.questionId] = v.videoUrl
            }
            if (!cancelled) {
              setVideoUrls(urls)
              setVideoProgress({
                completed: data.completedCount ?? 0,
                total: data.total ?? questions.length,
              })
            }

            // Start interview as soon as the first video is ready
            if (!cancelled && (data.completedCount ?? 0) >= 1) {
              setPreparingVideos(false)
              clearTimeout(firstVideoTimeout)
            }

            // Stop polling only when every video is done
            if (data.ready) {
              clearInterval(pollRef.current!)
              clearTimeout(allDoneTimeout)
            }
          } catch {
            // network error — keep polling
          }
        }

        await poll()
        pollRef.current = setInterval(poll, 10_000)
      } catch {
        // HeyGen call failed — fall back to text immediately
        if (!cancelled) setPreparingVideos(false)
      }
    }

    startHeygen()

    return () => {
      cancelled = true
      clearInterval(pollRef.current!)
    }
  }, [questions, sessionId])

  // ── 30-second per-question video wait timeout ────────────────
  useEffect(() => {
    if (!waitingForVideo) {
      clearTimeout(waitTimeoutRef.current!)
      return
    }
    waitTimeoutRef.current = setTimeout(() => setWaitingForVideo(false), 30_000)
    return () => clearTimeout(waitTimeoutRef.current!)
  }, [waitingForVideo])

  // ── Dismiss wait spinner when the video URL arrives ──────────
  useEffect(() => {
    if (!waitingForVideo) return
    const qId = questions[currentIndex]?.id
    if (qId && videoUrls[qId]) setWaitingForVideo(false)
  }, [videoUrls, waitingForVideo, currentIndex, questions])

  // ── Reset video state on question change ────────────────────
  useEffect(() => {
    setVideoEnded(false)
  }, [currentIndex])

  // ── Start webcam ────────────────────────────────────────────
  useEffect(() => {
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        streamRef.current = stream
        if (webcamRef.current) webcamRef.current.srcObject = stream
      } catch {
        setWebcamError('Webcam not available or permission denied.')
      }
    }
    startWebcam()

    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSpeechSupported(false)
    }

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      recognitionRef.current?.stop()
    }
  }, [])

  // ── Countdown timer — starts after video ends (or immediately if no video) ──
  useEffect(() => {
    if (isLoading || preparingVideos || waitingForVideo || questions.length === 0) return

    const currentQId = questions[currentIndex]?.id
    const hasVideo = currentQId ? !!videoUrls[currentQId] : false

    // Wait for avatar video to finish before starting the answer timer
    if (hasVideo && !videoEnded) return

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
  }, [currentIndex, isLoading, preparingVideos, waitingForVideo, questions, videoEnded, videoUrls])

  // ── Speech recognition ───────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!speechSupported) return
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
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [speechSupported])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  // ── Save answer and advance ───────────────────────────────────
  const saveAnswerAndAdvance = async () => {
    if (!transcript.trim()) {
      setError('Please record or type an answer before continuing.')
      return
    }
    setError('')
    setIsSaving(true)

    const currentQuestion = questions[currentIndex]
    const { error: saveError } = await supabase.from('answers').upsert(
      { session_id: sessionId, question_id: currentQuestion.id, answer_text: transcript.trim() },
      { onConflict: 'session_id,question_id' }
    )

    if (saveError) {
      setError('Failed to save answer. Please try again.')
      setIsSaving(false)
      return
    }

    if (currentIndex < questions.length - 1) {
      clearInterval(timerRef.current!)
      const nextIndex = currentIndex + 1
      const nextQId = questions[nextIndex]?.id
      setCurrentIndex(nextIndex)
      setTranscript('')
      setIsRecording(false)
      recognitionRef.current?.stop()
      // Show "Loading next question…" if the next video isn't ready yet
      if (nextQId && !videoUrls[nextQId]) setWaitingForVideo(true)
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      router.push(`/results/${sessionId}`)
    }
    setIsSaving(false)
  }

  // ── Supabase loading screen ──────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your interview...</p>
        </div>
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // ── HeyGen "Preparing your interviewer…" loading screen ──────
  if (preparingVideos) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-6">
        {/* Animated avatar silhouette */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-indigo-600/10 border-2 border-indigo-500/20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/30 animate-pulse flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          {/* Orbit ring */}
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>

        <div className="text-center">
          <h2 className="text-white font-semibold text-xl mb-2">Preparing your interviewer...</h2>
          <p className="text-gray-500 text-sm">
            Generating AI avatar videos for each question
          </p>
          {videoProgress.total > 0 && (
            <p className="text-indigo-400 text-sm mt-1 tabular-nums">
              {videoProgress.completed} of {videoProgress.total} ready
            </p>
          )}
        </div>

        {/* Progress bar */}
        {videoProgress.total > 0 && (
          <div className="w-64">
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(videoProgress.completed / videoProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Bouncing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Derived values ───────────────────────────────────────────
  const currentQuestion = questions[currentIndex]
  const currentVideoUrl = currentQuestion ? videoUrls[currentQuestion.id] ?? null : null
  const showAnswerControls = videoEnded || !currentVideoUrl
  const progress = ((currentIndex + 1) / questions.length) * 100
  const isWarning = timeLeft <= 30 && !timerExpired
  const timerDisplay = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  const typeLabels: Record<string, string> = {
    behavioral: 'Behavioral',
    'role-specific': 'Role-Specific',
    curveball: 'Curveball',
  }
  const typeColors: Record<string, string> = {
    behavioral: 'bg-blue-500/20 text-blue-300',
    'role-specific': 'bg-purple-500/20 text-purple-300',
    curveball: 'bg-orange-500/20 text-orange-300',
  }

  // ── Main interview screen ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a.96.96 0 01-.65.244H7.28a.96.96 0 01-.65-.244l-.348-.347z" />
            </svg>
          </div>
          <span className="font-semibold text-white">Interview AI</span>
        </div>
        <span className="text-sm text-gray-500">Mock Interview</span>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Webcam sidebar */}
        <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col items-center justify-start p-4 gap-3">
          <div className="w-full aspect-video bg-gray-800 rounded-xl overflow-hidden relative">
            {webcamError ? (
              <div className="absolute inset-0 flex items-center justify-center text-center p-3">
                <p className="text-gray-500 text-xs">{webcamError}</p>
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
          <p className="text-xs text-gray-500 text-center">Your camera feed (not recorded)</p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 flex-1">

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-sm text-gray-500">{Math.round(progress)}% complete</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 mx-0.5 rounded-full transition-colors duration-300 ${
                      i < currentIndex ? 'bg-indigo-500' : i === currentIndex ? 'bg-indigo-400' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Next-question loading spinner */}
            {waitingForVideo && (
              <div className="flex flex-col items-center justify-center py-14 gap-4">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Loading next question...</p>
              </div>
            )}

            {/* Question content — hidden while waiting for next video */}
            {!waitingForVideo && <>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[currentQuestion?.question_type] || 'bg-gray-700 text-gray-300'}`}>
                {typeLabels[currentQuestion?.question_type] || currentQuestion?.question_type}
              </span>

              {/* Timer — shown only once answer controls are active */}
              {showAnswerControls && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors duration-300 ${
                  timerExpired || isWarning ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-900 border-gray-800'
                }`}>
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 ${timerExpired || isWarning ? 'text-red-400' : 'text-gray-500'} ${isWarning ? 'animate-pulse' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-sm font-mono font-semibold tabular-nums ${timerExpired || isWarning ? 'text-red-400' : 'text-gray-300'}`}>
                    {timerDisplay}
                  </span>
                </div>
              )}
            </div>

            {/* Avatar video OR text question */}
            {currentVideoUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-800 bg-black">
                <video
                  key={currentQuestion.id}
                  ref={avatarVideoRef}
                  src={currentVideoUrl}
                  autoPlay
                  playsInline
                  className="w-full"
                  onEnded={() => setVideoEnded(true)}
                  onError={() => setVideoEnded(true)}
                />
                {/* Question as subtitle + skip button */}
                <div className="bg-gray-900/90 px-5 py-3 flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-300 leading-relaxed flex-1">
                    {currentQuestion.question_text}
                  </p>
                  {!videoEnded && (
                    <button
                      onClick={() => {
                        avatarVideoRef.current?.pause()
                        setVideoEnded(true)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-200 transition-colors whitespace-nowrap pt-0.5"
                    >
                      Skip →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-lg font-medium text-white leading-relaxed">
                  {currentQuestion?.question_text}
                </p>
              </div>
            )}

            {/* Time's up warning */}
            {timerExpired && showAnswerControls && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-300 text-sm">Time&apos;s up — wrap up your answer and move on when you&apos;re ready.</p>
              </div>
            )}

            {/* Answer controls — hidden while avatar video plays */}
            {showAnswerControls && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Your Answer</label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={speechSupported ? 'Click "Start Recording" to speak, or type your answer here...' : 'Type your answer here...'}
                    rows={7}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none transition-colors text-sm leading-relaxed"
                  />
                  <p className="text-xs text-gray-600">
                    {transcript.trim().split(/\s+/).filter(Boolean).length} words
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {speechSupported && (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                        isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
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
                    <button onClick={() => setTranscript('')} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                      Clear
                    </button>
                  )}

                  <div className="flex-1" />

                  <button
                    onClick={saveAnswerAndAdvance}
                    disabled={isSaving || !transcript.trim()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
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

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}
