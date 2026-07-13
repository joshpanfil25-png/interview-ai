import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type LinkedInReview = {
  scores: {
    headline: number
    about: number
    experience: number
    keywords: number
    overall: number
  }
  quickWins: [string, string, string]
}

export async function POST(req: NextRequest) {
  try {
    const { linkedinText, role, company, interviewType } = await req.json()

    if (!linkedinText?.trim()) {
      return NextResponse.json({ error: 'No LinkedIn profile text provided' }, { status: 400 })
    }

    const context = role || company
      ? `The candidate is applying for ${role ? `the role of ${role}` : 'a position'}${company ? ` at ${company}` : ''}${interviewType && interviewType !== 'General' ? ` (${interviewType} vertical)` : ''}.`
      : 'No specific role or company was provided — score Keyword Relevance based on general professional standards.'

    const prompt = `You are a senior recruiter and LinkedIn profile coach with 15 years of experience. Analyze this LinkedIn profile text and score it honestly.

${context}

LinkedIn profile text (headline, about section, and/or experience bullets, as pasted by the candidate):
---
${linkedinText.slice(0, 6000)}
---

Score the profile on these four dimensions (each 1–10, be critical — do not inflate scores):

1. **Headline** (1–10): Is it more than just a job title? Does it signal value/specialization instead of being generic?
2. **About Section** (1–10): Does it tell a clear, compelling narrative? Avoids vague buzzwords ("passionate", "results-driven")?
3. **Experience Bullets** (1–10): Are they quantified? Strong action verbs? Outcomes not duties?
4. **Keyword Relevance** (1–10): Would this profile surface in recruiter searches for the target role? Right terminology present?

Then give exactly 3 quick wins — specific, actionable changes the candidate can make today in under an hour. Name the exact change, not vague advice. 1–2 sentences each.

Return ONLY valid JSON, no extra text:
{
  "scores": {
    "headline": 0,
    "about": 0,
    "experience": 0,
    "keywords": 0
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
      throw new Error('Failed to parse LinkedIn review')
    }

    const s = parsed.scores
    const overall = Math.round(((s.headline + s.about + s.experience + s.keywords) / 4) * 10) / 10

    const result: LinkedInReview = {
      scores: {
        headline:   Math.min(10, Math.max(1, Math.round(s.headline))),
        about:      Math.min(10, Math.max(1, Math.round(s.about))),
        experience: Math.min(10, Math.max(1, Math.round(s.experience))),
        keywords:   Math.min(10, Math.max(1, Math.round(s.keywords))),
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
    console.error('Review LinkedIn error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
