import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { company, role, resumeText, linkedinUrl, sessionId } = await req.json()

    if (!company || !role || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = `You are an expert interviewer preparing questions for a candidate applying to ${company} for the role of ${role}.

${resumeText ? `Here is the candidate's resume:\n${resumeText}\n` : ''}
${linkedinUrl ? `Candidate's LinkedIn: ${linkedinUrl}\n` : ''}

Generate exactly 6 interview questions in the following order:
1. Behavioral question (STAR method expected)
2. Behavioral question (teamwork/collaboration)
3. Behavioral question (handling failure or conflict)
4. Behavioral question (leadership or initiative)
5. Role-specific technical/domain question for ${role} at ${company}
6. Curveball / creative / unexpected question

Return ONLY a valid JSON array with no extra text, in this exact format:
[
  {"type": "behavioral", "question": "..."},
  {"type": "behavioral", "question": "..."},
  {"type": "behavioral", "question": "..."},
  {"type": "behavioral", "question": "..."},
  {"type": "role-specific", "question": "..."},
  {"type": "curveball", "question": "..."}
]`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let questions: Array<{ type: string; question: string }>
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found')
      questions = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse questions from Claude response')
    }

    if (!Array.isArray(questions) || questions.length !== 6) {
      throw new Error('Invalid question format returned')
    }

    // Store session in Supabase
    const { error: sessionError } = await supabase.from('sessions').insert({
      id: sessionId,
      company,
      role,
      linkedin_url: linkedinUrl || null,
    })

    if (sessionError) throw new Error(`Supabase session error: ${sessionError.message}`)

    // Store questions
    const questionRows = questions.map((q, i) => ({
      session_id: sessionId,
      question_text: q.question,
      question_type: q.type as 'behavioral' | 'role-specific' | 'curveball',
      order_index: i,
    }))

    const { error: questionsError } = await supabase.from('questions').insert(questionRows)
    if (questionsError) throw new Error(`Supabase questions error: ${questionsError.message}`)

    return NextResponse.json({ success: true, sessionId })
  } catch (err: any) {
    console.error('Generate questions error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
