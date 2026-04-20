import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    const prompt = `You are an expert interview coach giving instant feedback on a single interview answer.

Question: ${question}
Answer: ${answer}

Rate this answer and give concise feedback. Return ONLY a valid JSON object with no extra text:
{
  "score": <integer 1-10>,
  "didWell": "<one sentence — the single most effective thing they did>",
  "improve": "<one sentence — the single most important thing to fix next time>"
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
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(1, Math.round(parsed.score))) : 5,
      didWell: parsed.didWell || '',
      improve: parsed.improve || '',
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('evaluate-single error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
