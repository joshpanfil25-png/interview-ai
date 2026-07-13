import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Fast haiku call; headroom to avoid edge-case truncation.
export const maxDuration = 30

export type FollowUp = {
  followUp: string
}

// Builds the interviewer-follow-up prompt. Pure and exported so it can be
// unit-tested without an API call.
export function buildFollowUpPrompt(args: {
  question: string
  answer: string
  company?: string
  role?: string
  interviewType?: string
}): string {
  const { question, answer, company, role, interviewType } = args
  const context = [
    role ? `the role of ${role}` : null,
    company ? `at ${company}` : null,
    interviewType ? `(${interviewType} interview)` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return `You are a warm but sharp interviewer running a mock interview${
    context ? ` for ${context}` : ''
  }. The candidate was just asked this question and gave this answer.

Question: ${question}
Answer: ${answer}

Ask exactly ONE natural follow-up question a real interviewer would ask next, grounded in what they actually said. Good follow-ups do one of: probe a vague or unsupported claim, push for a concrete number or specific example, ask them to walk through a tradeoff or decision more deeply, or gently challenge an assumption. It must be fair and answerable from their own experience or reasoning — never a gotcha, never introducing outside facts they could not know.

If the answer is empty, a non-answer, or does not genuinely attempt the question, instead return a single encouraging nudge to actually attempt it.

Return ONLY the follow-up question text — no preamble, no quotes, no labels.`
}

export async function POST(req: NextRequest) {
  try {
    const { question, answer, company, role, interviewType } = await req.json()
    if (!question || !answer) {
      return NextResponse.json({ error: 'Missing question or answer' }, { status: 400 })
    }

    const prompt = buildFollowUpPrompt({ question, answer, company, role, interviewType })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

    const followUp = textBlock.text.trim()
    if (!followUp) throw new Error('Empty follow-up returned')

    const result: FollowUp = { followUp }
    return NextResponse.json(result)
  } catch (err) {
    console.error('follow-up error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
