import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BASE = 'https://api.heygen.com'
const KEY = () => process.env.HEYGEN_API_KEY ?? ''

function isConfigured() {
  const k = KEY()
  return k && k !== 'your_heygen_api_key'
}

async function heygenGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Api-Key': KEY() } })
  return res.json()
}

async function getDefaultAvatar(): Promise<string> {
  try {
    const data = await heygenGet('/v2/avatars')
    return data.data?.avatars?.[0]?.avatar_id ?? 'Daisy-inskirt-20220818'
  } catch {
    return 'Daisy-inskirt-20220818'
  }
}

async function getDefaultVoice(): Promise<string> {
  try {
    const data = await heygenGet('/v2/voices')
    const voices: any[] = data.data?.voices ?? []
    const pick =
      voices.find((v) => v.language === 'English' && !v.is_premium) ??
      voices.find((v) => v.language === 'English') ??
      voices[0]
    return pick?.voice_id ?? '2d5b0e6cf36f460aa7fc47e3eee4ba54'
  } catch {
    return '2d5b0e6cf36f460aa7fc47e3eee4ba54'
  }
}

async function submitVideo(avatarId: string, voiceId: string, text: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/v2/video/generate`, {
      method: 'POST',
      headers: { 'X-Api-Key': KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
          voice: { type: 'text', input_text: text, voice_id: voiceId, speed: 1.0 },
          background: { type: 'color', value: '#111827' },
        }],
        dimension: { width: 1280, height: 720 },
      }),
    })
    const data = await res.json()
    return data.data?.video_id ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    if (!isConfigured()) return NextResponse.json({ skipped: true })

    // Fetch questions
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_text, heygen_video_id')
      .eq('session_id', sessionId)
      .order('order_index')

    if (!questions?.length) return NextResponse.json({ error: 'No questions' }, { status: 404 })

    // Already submitted — don't resubmit on page refresh
    if (questions.some((q) => q.heygen_video_id)) {
      return NextResponse.json({ success: true, alreadyStarted: true })
    }

    // Resolve avatar + voice in parallel, then submit all 6 videos in parallel
    const [avatarId, voiceId] = await Promise.all([getDefaultAvatar(), getDefaultVoice()])

    const videoIds = await Promise.all(
      questions.map((q) => submitVideo(avatarId, voiceId, q.question_text))
    )

    // Persist video IDs back to Supabase
    await Promise.all(
      questions.map((q, i) => {
        if (!videoIds[i]) return null
        return supabase.from('questions').update({ heygen_video_id: videoIds[i] }).eq('id', q.id)
      }).filter(Boolean)
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('HeyGen generate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
