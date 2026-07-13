import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Fast haiku call, but add headroom to prevent edge-case truncation.
export const maxDuration = 30

export type SingleFeedback = {
  score: number
  didWell: string
  improve: string
}

export async function POST(req: NextRequest) {
  try {
    const { question, answer } = await req.json()
    if (!question || !answer) {
      return NextResponse.json({ error: 'Missing question or answer' }, { status: 400 })
    }

    const prompt = `You are a supportive, encouraging interview coach giving instant feedback on a single interview answer. Picture a mentor who is genuinely in the candidate's corner — you want to build their confidence while helping them grow, never to tear them down.

Question: ${question}
Answer: ${answer}

Lead with sincere recognition of what worked, then frame the next step as an opportunity to get even stronger. Stay honest and specific — don't paper over real gaps — but keep the delivery warm and motivating. Scoring floor — this overrides the encouraging tone above: if the answer is empty, a single stray character, gibberish, or otherwise does not genuinely attempt to answer the question, score it 0 and do not manufacture praise for it (leave didWell empty or state plainly that there was no attempt to assess). Reserve 1-2 only for a real but very weak attempt. Return ONLY a valid JSON object with no extra text:
{
  "score": <integer 0-10>,
  "didWell": "<one encouraging, specific sentence — the single most effective thing they did>",
  "improve": "<one constructive sentence — the single biggest opportunity to make this answer stronger next time, framed as a growth move rather than a failure>"
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    const parsed = JSON.parse(jsonMatch[0])

    const result: SingleFeedback = {
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, Math.round(parsed.score))) : 5,
      didWell: parsed.didWell || '',
      improve: parsed.improve || '',
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('evaluate-single error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
