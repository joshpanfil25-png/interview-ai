import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BASE = 'https://api.heygen.com'
const KEY = () => process.env.HEYGEN_API_KEY ?? ''

async function fetchVideoStatus(videoId: string): Promise<{ status: string; videoUrl?: string }> {
  try {
    const res = await fetch(`${BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': KEY() },
    })
    const data = await res.json()
    return {
      status: data.data?.status ?? 'pending',
      videoUrl: data.data?.video_url,
    }
  } catch {
    return { status: 'failed' }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const { data: questions } = await supabase
      .from('questions')
      .select('id, heygen_video_id, video_url')
      .eq('session_id', sessionId)
      .order('order_index')

    if (!questions?.length) return NextResponse.json({ ready: false, videos: [] })

    // No HeyGen video IDs at all → not configured, skip straight to interview
    const anyVideoId = questions.some((q) => q.heygen_video_id)
    if (!anyVideoId) return NextResponse.json({ ready: true, noHeygen: true, videos: [] })

    // For questions that have a video ID but no URL yet, poll HeyGen
    const supabaseUpdates: PromiseLike<any>[] = []

    const videos = await Promise.all(
      questions.map(async (q) => {
        if (!q.heygen_video_id) {
          return { questionId: q.id, status: 'no_video', videoUrl: null }
        }
        if (q.video_url) {
          return { questionId: q.id, status: 'completed', videoUrl: q.video_url }
        }

        const { status, videoUrl } = await fetchVideoStatus(q.heygen_video_id)

        if (status === 'completed' && videoUrl) {
          supabaseUpdates.push(
            supabase.from('questions').update({ video_url: videoUrl }).eq('id', q.id)
          )
          return { questionId: q.id, status: 'completed', videoUrl }
        }

        return { questionId: q.id, status, videoUrl: null }
      })
    )

    if (supabaseUpdates.length) await Promise.all(supabaseUpdates)

    const withVideoIds = questions.filter((q) => q.heygen_video_id)
    const completed = videos.filter((v) => v.videoUrl).length
    const ready = completed >= withVideoIds.length

    return NextResponse.json({
      ready,
      videos,
      completedCount: completed,
      total: withVideoIds.length,
    })
  } catch (err: any) {
    console.error('HeyGen status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
