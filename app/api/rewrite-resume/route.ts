import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type BulletRewrite = {
  original: string
  improved: string
  reason: string  // one-phrase label: "quantified" | "stronger verb" | "clearer impact" | "removed filler"
}

export type ResumeRewriteGuide = {
  rewrites: BulletRewrite[]
}

export async function POST(req: NextRequest) {
  try {
    const { resumeText, role, company } = await req.json()

    if (!resumeText?.trim()) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 })
    }

    const context = role || company
      ? `Target role: ${role || 'unspecified'}${company ? ` at ${company}` : ''}.`
      : ''

    const prompt = `You are an expert resume writer. Your job is to rewrite weak bullet points from this resume — not rewrite the whole resume, just the bullets that need improvement.

${context}

Resume text:
---
${resumeText.slice(0, 6000)}
---

Instructions:
1. Extract every bullet point (or sentence-length achievement/responsibility) from the resume.
2. For each bullet that has a clear problem — missing quantification, weak verb, vague impact, or filler phrases — write an improved version.
3. Skip bullets that are already strong (quantified, action-oriented, concise). Do NOT include them.
4. Focus improvements on:
   - Adding specific numbers/metrics where they're obviously missing (use placeholders like "[X%]" or "[N users]" if exact numbers aren't known)
   - Replacing weak openers ("Responsible for", "Helped with", "Worked on", "Assisted in") with strong action verbs
   - Cutting filler phrases ("various", "a variety of", "multiple", "as needed", "in order to")
   - Making the impact or outcome explicit when it's buried or absent
5. Keep improvements realistic — don't invent facts, just restructure and sharpen what's there.
6. Include between 5 and 15 rewrites (skip trivial ones, focus on the most impactful changes).
7. For "reason", use exactly one of these labels: "add metrics", "stronger verb", "clearer impact", "remove filler", "combine & sharpen"

Return ONLY valid JSON, no extra text:
{
  "rewrites": [
    {
      "original": "Exact original bullet text here",
      "improved": "Rewritten version here",
      "reason": "label here"
    }
  ]
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
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
      throw new Error('Failed to parse rewrite guide')
    }

    if (!Array.isArray(parsed.rewrites) || parsed.rewrites.length === 0) {
      throw new Error('No rewrites returned')
    }

    const result: ResumeRewriteGuide = {
      rewrites: parsed.rewrites.map((r: any) => ({
        original: r.original || '',
        improved: r.improved || '',
        reason:   r.reason   || 'improve',
      })),
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Rewrite resume error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
