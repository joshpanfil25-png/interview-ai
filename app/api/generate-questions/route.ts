import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { company, role, resumeText, linkedinUrl, sessionId, interviewType = 'General' } = await req.json()

    if (!company || !role || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const verticalGuidance: Record<string, string> = {
      'Finance': 'Focus on financial modeling, valuation methods (DCF, comps, precedent transactions), market awareness, and quantitative reasoning. The role-specific question should test technical finance knowledge.',
      'Investment Banking': 'Focus on deal experience, modeling (LBO, M&A accretion/dilution), pitch experience, and navigating high-pressure environments. The role-specific question should test IB technical knowledge like walk me through a DCF or LBO mechanics.',
      'Private Equity': 'Focus on deal sourcing, investment thesis, portfolio operations, and returns analysis. The role-specific question should cover PE concepts like MOIC, IRR, value creation levers, or a case-style question about evaluating a company.',
      'Consulting': 'Include a case-style or structured problem-solving question. Focus on structured thinking, client communication, data-driven insights, and change management. The role-specific question should involve a business problem or framework application.',
      'Tech': 'Focus on system design, technical problem-solving, engineering trade-offs, and cross-functional collaboration. The role-specific question should probe technical depth relevant to the specific role (software, data, product, etc.).',
      'Real Estate': 'Focus on market analysis, deal underwriting, cap rates, IRR, and asset management. The role-specific question should test real estate finance fundamentals or property evaluation.',
      'Marketing': 'Focus on campaign strategy, brand positioning, data-driven decision making, and customer insight. The role-specific question should involve a go-to-market scenario or marketing channel trade-off.',
      'Sales': 'Focus on pipeline management, objection handling, closing techniques, and quota attainment. The role-specific question should involve a sales scenario or how they would sell a product.',
      'Healthcare': 'Focus on patient care philosophy, interdisciplinary teamwork, clinical decision-making under pressure, and regulatory awareness. The role-specific question should be relevant to the specific healthcare role.',
      'Accounting': 'Focus on accuracy, process improvement, regulatory knowledge, and attention to detail. The role-specific question should involve accounting standards, reconciliation scenarios, or audit/tax methodology.',
      'Audit': 'Focus on attention to detail, risk assessment, professional skepticism, and regulatory compliance. The role-specific question should involve an audit scenario such as identifying a control weakness, handling a client disagreement, or assessing materiality.',
      'Operations': 'Focus on process optimization, cross-functional coordination, and problem-solving under constraints. The role-specific question should involve a supply chain, workflow, or efficiency scenario.',
      'Human Resources': 'Focus on employee relations, performance management, DEI initiatives, and organizational design. The role-specific question should involve an HR policy decision or conflict resolution scenario.',
      'Nonprofit': 'Focus on mission alignment, stakeholder management, grant writing or fundraising, and impact measurement. The role-specific question should involve a resource constraint or program design challenge.',
      'Government': 'Focus on public service motivation, policy knowledge, interagency collaboration, and navigating bureaucracy. The role-specific question should involve a policy scenario or constituent service challenge.',
      'Coffee Chat': 'This is an informal networking conversation, not a formal interview. Replace the behavioral questions with 4 natural conversation-starter questions (career journey, advice, industry trends, day-to-day experience). Replace the role-specific question with a thoughtful question about their path. The curveball should be a memorable, genuine question that shows curiosity. Keep all questions open-ended and conversational.',
      'General': 'Use broadly applicable behavioral and situational questions suitable for any industry or role.',
    }

    const guidance = verticalGuidance[interviewType] ?? verticalGuidance['General']

    const prompt = `You are an expert interviewer preparing questions for a candidate applying to ${company} for the role of ${role}.

Interview vertical: ${interviewType}
Vertical guidance: ${guidance}

${resumeText ? `Here is the candidate's resume:\n${resumeText}\n` : ''}
${linkedinUrl ? `Candidate's LinkedIn: ${linkedinUrl}\n` : ''}

Generate exactly 6 interview questions tailored to the ${interviewType} vertical in the following order:
1. Behavioral question (STAR method expected) — adapted to ${interviewType} context
2. Behavioral question (teamwork/collaboration) — adapted to ${interviewType} context
3. Behavioral question (handling failure or conflict) — adapted to ${interviewType} context
4. Behavioral question (leadership or initiative) — adapted to ${interviewType} context
5. Role-specific technical/domain question for ${role} at ${company} — follow the vertical guidance above
6. Curveball / creative / unexpected question — relevant to ${interviewType} culture or mindset

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
