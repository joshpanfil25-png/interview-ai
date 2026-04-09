import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ResumeGrade = {
  scores: {
    clarity: number
    impact: number
    relevance: number
    ats: number
    overall: number
  }
  quickWins: [string, string, string]
}

export async function POST(req: NextRequest) {
  try {
    const { resumeText, role, company, interviewType } = await req.json()

    if (!resumeText?.trim()) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 })
    }

    const context = role || company
      ? `The candidate is applying for ${role ? `the role of ${role}` : 'a position'}${company ? ` at ${company}` : ''}${interviewType && interviewType !== 'General' ? ` (${interviewType} vertical)` : ''}.`
      : 'No specific role or company was provided — score Relevance based on general professional standards.'

    const prompt = `You are a senior recruiter and resume coach with 15 years of experience. Analyze this resume and score it honestly.

${context}

Resume text:
---
${resumeText.slice(0, 6000)}
---

Score the resume on these four dimensions (each 1–10, be critical — do not inflate scores):

1. **Clarity & Formatting** (1–10): Is it scannable? Logical structure? Clear section labels? Professional?
2. **Impact of Bullet Points** (1–10): Are bullets quantified? Strong action verbs? Outcomes not duties?
3. **Relevance to Role** (1–10): Does experience match the target role? Positioned correctly?
4. **ATS Friendliness** (1–10): Standard headings? Relevant keywords? No tables/columns/images?

Then give exactly 3 quick wins — specific, actionable changes the candidate can make today in under an hour. Name the exact change, not vague advice. 1–2 sentences each.

Return ONLY valid JSON, no extra text:
{
  "scores": {
    "clarity": 0,
    "impact": 0,
    "relevance": 0,
    "ats": 0
  },
  "quickWins": [
    "Quick win 1.",
    "Quick win 2.",
    "Quick win 3."
  ]
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude')

    let parsed: any
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse resume grade')
    }

    const s = parsed.scores
    const overall = Math.round(((s.clarity + s.impact + s.relevance + s.ats) / 4) * 10) / 10

    const result: ResumeGrade = {
      scores: {
        clarity:   Math.min(10, Math.max(1, Math.round(s.clarity))),
        impact:    Math.min(10, Math.max(1, Math.round(s.impact))),
        relevance: Math.min(10, Math.max(1, Math.round(s.relevance))),
        ats:       Math.min(10, Math.max(1, Math.round(s.ats))),
        overall,
      },
      quickWins: [
        parsed.quickWins?.[0] || '',
        parsed.quickWins?.[1] || '',
        parsed.quickWins?.[2] || '',
      ],
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Grade resume error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
