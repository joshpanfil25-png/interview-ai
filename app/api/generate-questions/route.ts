import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseClient } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Verticals that are school admissions interviews, not job interviews.
// "company" is read as the target school; "role" is read as the program/degree.
const SCHOOL_VERTICALS = new Set([
  'Pre-Med / Health Professional School',
  'Pre-Law / Law School',
  'Graduate School (General)',
])

const QUESTION_FOCUS_OPTIONS = ['Balanced', 'Behavioral-Heavy', 'Technical-Heavy'] as const
type QuestionFocus = (typeof QUESTION_FOCUS_OPTIONS)[number]

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'] as const
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]

export async function POST(req: NextRequest) {
  try {
    const {
      company,
      role,
      resumeText,
      linkedinUrl,
      sessionId,
      interviewType = 'General',
      questionFocus = 'Balanced',
      difficulty = 'Medium',
    } = await req.json()

    if (!company || !role || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const focus: QuestionFocus = (QUESTION_FOCUS_OPTIONS as readonly string[]).includes(questionFocus)
      ? questionFocus
      : 'Balanced'
    const level: Difficulty = (DIFFICULTY_OPTIONS as readonly string[]).includes(difficulty)
      ? difficulty
      : 'Medium'
    const isSchoolVertical = SCHOOL_VERTICALS.has(interviewType)

    // Create the Supabase client at request time (never at module/build time).
    const supabase = getSupabaseClient()

    const verticalGuidance: Record<string, string> = {
      'Finance':
        'Focus on financial modeling literacy, valuation methods (DCF, comparable companies, precedent transactions), capital markets awareness, and quantitative judgment under ambiguity. The role-specific question should test applied technical finance knowledge — e.g., how a change in an assumption flows through a model, or how to think about a company\u2019s capital structure — not just a definition.',
      'Investment Banking':
        'Focus on deal-process fluency, technical modeling (LBO mechanics, M&A accretion/dilution, DCF), pitch and client-facing experience, and composure under long-hours, high-pressure conditions. The role-specific question should test IB technical depth — e.g., walk through how a DCF is built, explain what drives accretion/dilution in a stock deal, or how leverage affects LBO returns.',
      'Private Equity':
        'Focus on deal sourcing and diligence instincts, investment thesis construction, portfolio company operating involvement, and returns math. The role-specific question should probe PE fundamentals — MOIC vs. IRR, key value-creation levers (multiple expansion, deleveraging, EBITDA growth), or a short case-style prompt to evaluate a hypothetical target.',
      'Consulting':
        'Include a case-style or structured problem-solving question that forces the candidate to build a framework live, not recite one. Focus on structured thinking, hypothesis-driven analysis, client communication under ambiguity, and change management. The role-specific question should present a business problem (market entry, profitability decline, operational bottleneck) and ask the candidate to reason through it.',
      'Tech':
        'Focus on system design trade-offs, technical problem-solving, engineering judgment (build vs. buy, scaling decisions), and cross-functional collaboration with product/design. The role-specific question should probe technical depth calibrated to the actual role — software engineering, data, product, or infrastructure — not a generic "tell me about tech" prompt.',
      'Real Estate':
        'Focus on deal underwriting mechanics, cap rate and IRR intuition, market/submarket analysis, and asset management trade-offs. The role-specific question should test real estate finance fundamentals — e.g., how cap rate relates to price, what drives NOI, or how to evaluate a value-add opportunity.',
      'Marketing':
        'Focus on channel-prioritization trade-offs under a real budget constraint, first-party data strategy in a cookieless/privacy-first environment, cross-functional friction with sales over lead quality (what actually counts as a "qualified" lead), and reallocating spend away from an underperforming channel. The role-specific question should be a live diagnostic scenario (e.g. "website traffic just dropped 20% overnight, what do you check first") or a channel-prioritization decision under a stated budget cut, and should push for real metrics (CAC, conversion rate, ROAS) rather than described intuition.',
      'Sales':
        'This role expects a real scenario, not a definition. Ground the role-specific question in one specific buyer persona and one specific objection pulled from real deal patterns — a price pushback mid-negotiation, a stalled deal where the champion has gone quiet, a competitor lock-in on renewal, or a prospect demanding pricing before a discovery call. Ask the candidate to write out exactly what they would say and why, using a real qualification framework (BANT, MEDDIC, or SPICED) rather than a generic "I would build rapport" answer. The behavioral questions should probe a lost deal (what they would change with hindsight) and how much of their pipeline is self-sourced versus inbound.',
      'Healthcare':
        'Focus on patient-centered decision-making, interdisciplinary teamwork, handling high-stakes judgment calls under time pressure, and awareness of regulatory/compliance context. The role-specific question should be grounded in a scenario specific to the stated role (clinical, administrative, or health-tech) rather than a generic "why healthcare" prompt.',
      'Accounting':
        'Focus on technical accuracy under GAAP/IFRS, process and controls thinking, and how the candidate handles a discrepancy or deadline pressure. The role-specific question should involve a concrete accounting scenario — a reconciliation issue, a revenue recognition judgment call, or how to handle a client disagreement over treatment.',
      'Audit':
        'Focus on professional skepticism, risk assessment, materiality judgment, and navigating disagreements with a client. The role-specific question should present a concrete audit scenario — identifying a control weakness, evaluating a management estimate, or deciding whether an issue rises to material — rather than asking generically about "attention to detail."',
      'Operations':
        'Focus on process optimization under real constraints, cross-functional coordination, and root-cause thinking. The role-specific question should present a concrete operational breakdown (a supply chain delay, a workflow bottleneck, a capacity constraint) and ask the candidate to diagnose and prioritize a fix.',
      'Human Resources':
        'Ground the role-specific question in a concrete employee relations scenario requiring real judgment — not "how do you handle conflict" in the abstract, but a specific situation (two employees in an ongoing dispute, a manager avoiding a hard performance conversation, an unpopular new policy rollout) where the candidate must show a structured process: separate conversations first, documentation, a follow-up check-in, and a clear line between coaching, a formal performance path, and escalation to legal or leadership when the facts warrant it. Push for how they would handle competing priorities (a compliance deadline versus an urgent employee relations issue) and how they navigate confidentiality.',
      'Nonprofit':
        'Ground the role-specific question in a concrete resource-constraint or stakeholder scenario — a key donor withdrawing support mid-project, funding for a program getting cut unexpectedly, or an ethical tension between what a donor wants funded and what the program actually needs. Push for both quantitative and qualitative impact measurement (not just "we track outcomes" — ask how they would actually measure success with limited data) and how they would build trust with a community stakeholder who does not yet trust the organization. Avoid a generic "why do you care about this cause" prompt — root it in a specific trade-off.',
      'Government':
        'This is closer to a competency-based interview (in the style of UK Civil Service Success Profiles or US federal structured interviews) than a typical private-sector interview — every question should map to a named competency (delivering under competing political/financial/operational pressures, stakeholder management across departments or agencies, ethical decision-making, communicating with non-expert constituents) and expect a strict STAR answer where the candidate\u2019s individual action is distinguishable from what the team did. The role-specific question should be a realistic policy or constituent-service scenario requiring a judgment call within institutional constraints — never a partisan policy-opinion question.',
      'Pre-Med / Health Professional School':
        'This is a school admissions interview, not a job interview — the candidate is applying to this school for this program (MD, DO, PA, dental, nursing, etc.). Ground every question in what real medical/health-professional school interviews actually test: motivation for medicine grounded in a specific lived experience (never a platitude), sound judgment in an ethical or high-pressure scenario, teamwork and empathy in a clinical or caregiving context, and resilience after a genuine setback. The role-specific question should be a "why this school and program" fit question or a light situational-judgment scenario (a disagreement with a colleague, a difficult patient-communication moment) — never a clinical knowledge quiz. Avoid vague prompts like "why do you want to help people"; push for a specific, examined moment.',
      'Pre-Law / Law School':
        'This is a school admissions interview, not a job interview — the candidate is applying to this school for this program (JD, LLM, etc.). Ground every question in what real law school interviews actually test: STAR-structured behavioral questions about disagreement, engaging with an opposing viewpoint, leadership under pressure, and adapting to a significant unexpected change. The role-specific question should be a genuine "why law, why this school" question tied to something specific about the school (a clinic, a faculty member, a program strength) or a short current-events/legal-reasoning prompt asking the candidate to reason through both sides of an issue. Avoid generic "why do you want to be a lawyer" prompts — push for specificity.',
      'Graduate School (General)':
        'This is a school admissions interview, not a job interview — the candidate is applying to this school for this graduate program. Ground questions in academic and research motivation, a deep-dive on a specific project or area of study, handling an academic or research setback, and collaboration within an academic or lab setting. The role-specific question should be a "why this program at this school" fit question tied to something specific (a faculty member, a research focus, a curriculum strength). Avoid generic "why grad school" prompts — push for a specific, examined reason.',
      'Coffee Chat':
        'This is an informal networking conversation, not a formal interview. Replace the behavioral questions with 4 natural conversation-starter questions (career journey, advice, industry trends, day-to-day experience). Replace the role-specific question with a thoughtful question about their path. The curveball should be a memorable, genuine question that shows curiosity. Keep all questions open-ended and conversational.',
      'General':
        'Use broadly applicable behavioral and situational questions suitable for any industry or role.',
    }

    const guidance = verticalGuidance[interviewType] ?? verticalGuidance['General']

    // Controls how many of each question type appear, and in what order.
    // Every type must still be one of behavioral | role-specific | curveball —
    // these match the Supabase question_type check constraint, so no schema change is needed.
    const focusOrder: Record<QuestionFocus, string[]> = {
      Balanced: [
        '1. Behavioral question (STAR method expected)',
        '2. Behavioral question (teamwork/collaboration)',
        '3. Behavioral question (handling failure or conflict)',
        '4. Behavioral question (leadership or initiative)',
        '5. Role-specific question — follow the vertical guidance above',
        '6. Curveball / creative / unexpected question',
      ],
      'Behavioral-Heavy': [
        '1. Behavioral question (STAR method expected)',
        '2. Behavioral question (teamwork/collaboration)',
        '3. Behavioral question (handling failure or conflict)',
        '4. Behavioral question (leadership or initiative)',
        '5. Behavioral question (adaptability — handling ambiguity or a significant unexpected change)',
        '6. Curveball / creative / unexpected question',
      ],
      'Technical-Heavy': [
        '1. Behavioral question (STAR method expected) — keep exactly one grounding behavioral question',
        '2. Role-specific question — tests a foundational concept from the vertical guidance above',
        '3. Role-specific question — an applied scenario requiring judgment, not recall',
        '4. Role-specific question — a trade-off or "how would you decide between X and Y" question',
        '5. Role-specific question — the deepest/most advanced probe from the vertical guidance above',
        '6. Curveball / creative / unexpected question',
      ],
    }

    const focusTypeMap: Record<QuestionFocus, string[]> = {
      Balanced: ['behavioral', 'behavioral', 'behavioral', 'behavioral', 'role-specific', 'curveball'],
      'Behavioral-Heavy': ['behavioral', 'behavioral', 'behavioral', 'behavioral', 'behavioral', 'curveball'],
      'Technical-Heavy': ['behavioral', 'role-specific', 'role-specific', 'role-specific', 'role-specific', 'curveball'],
    }

    const difficultyGuidance: Record<Difficulty, string> = {
      Easy:
        'Calibrate to Easy: keep questions foundational and accessible. Assume the candidate may be early-career, a student, or new to this field — coursework, internships, part-time jobs, and class projects are all fair source material, not just full-time professional experience. Role-specific questions should test core concepts rather than advanced application. Keep the curveball light and low-pressure.',
      Medium:
        'Calibrate to Medium: assume the candidate has some relevant experience (internship-level to a few years) and calibrate accordingly. Role-specific questions should test applied understanding, not just definitions — the candidate should have to reason, not just recall.',
      Hard:
        'Calibrate to Hard: assume the candidate is targeting a competitive, senior-track opportunity. Role-specific questions should probe edge cases, require the candidate to quantify trade-offs, and go a layer deeper than a textbook answer — the kind of question that separates a good answer from a great one. Behavioral questions should expect fully realized STAR answers with real stakes, not a surface-level anecdote. The curveball can be more abstract or higher-pressure, while staying fair and never a "gotcha."',
    }

    const orderInstructions = focusOrder[focus].join('\n')
    const expectedTypes = focusTypeMap[focus]

    const antiRepeatInstruction = 'Every question in this set — especially the behavioral ones — must probe a genuinely distinct situation, skill, or competency. Never generate two questions a candidate could answer with the same story (for example, do not ask both a general "walk me through your background" question and a separate "tell me about a relevant experience" question — these overlap). If following the guidance above would naturally produce overlapping angles, adjust the specific wording so each question targets a different moment, skill, or trade-off.'

    const framingIntro = isSchoolVertical
      ? `You are a warm, encouraging admissions interview coach preparing practice questions for a candidate applying to ${company} for their ${role} program. Your goal is to help this person grow and show their best self, so write questions that are appropriately challenging but always fair — open-ended prompts that give the candidate room to shine, never "gotcha" questions designed to trip them up. Even the curveball should feel like a thoughtful, energizing question, not an ambush.`
      : `You are a warm, encouraging interview coach preparing practice questions for a candidate applying to ${company} for the role of ${role}. Your goal is to help this person grow and show their best self, so write questions that are appropriately challenging but always fair — open-ended prompts that give the candidate room to shine, never "gotcha" questions designed to trip them up. Even the curveball should feel like a thoughtful, energizing question, not an ambush.`

    const prompt = `${framingIntro}

Interview vertical: ${interviewType}
Vertical guidance: ${guidance}

${difficultyGuidance[level]}

${antiRepeatInstruction}

${resumeText ? `Here is the candidate's resume:\n${resumeText}\n` : ''}
${linkedinUrl ? `Candidate's LinkedIn: ${linkedinUrl}\n` : ''}

Generate exactly 6 interview questions tailored to the ${interviewType} vertical in the following order:
${orderInstructions}

Return ONLY a valid JSON array with no extra text, in this exact format:
[
${expectedTypes.map((t) => `  {"type": "${t}", "question": "..."}`).join(',\n')}
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
