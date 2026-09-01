import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Full end-of-interview evaluation is one Opus call over the whole transcript.
// Runs without extended thinking (see the model call below), so it completes well
// within the platform's default function limit.
export const maxDuration = 60

export type StarRating = 'present' | 'weak' | 'missing'

export type StarAnalysis = {
  situation: StarRating
  task: StarRating
  action: StarRating
  result: StarRating
  starScore: number
  starCoaching: string
}

export type QuestionEvaluation = {
  question: string
  answer: string
  scores: {
    clarity: number
    confidence: number
    structure: number
    relevance: number
  }
  average: number
  star: StarAnalysis
}

export type BlindSpot = {
  name: string         // short punchy title, e.g. "All Sizzle, No Steak"
  description: string  // one sentence, specific to their answers
}

export type EvaluationResult = {
  overallScore: number
  evaluations: QuestionEvaluation[]
  blindSpot: BlindSpot
  biggestMistakes: [string, string, string]
  improvements: [string, string, string]
  exampleBetterAnswer: string
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Create the Supabase client at request time (never at module/build time).
    // Use the cookie-aware SSR client so a logged-in user's session (sent with
    // this same-origin fetch) resolves auth.uid() and RLS returns their owned
    // rows. Guests send no cookie → behaves as anon → null-owned rows visible,
    // exactly as before.
    const supabase = await createSupabaseServerClient()

    // Fetch questions (question_type included — used below to calibrate
    // grading per question, e.g. the opener/motivation/self-knowledge slots
    // are not STAR-shaped by design, so they need different calibration than
    // a behavioral story or the curveball).
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index')

    if (qError) throw new Error(qError.message)
    if (!questions?.length) throw new Error('No questions found for this session')

    // Fetch answers
    const { data: answers, error: aError } = await supabase
      .from('answers')
      .select('*')
      .eq('session_id', sessionId)

    if (aError) throw new Error(aError.message)

    // Build Q&A pairs
    const qaPairs = questions.map((q) => {
      const answer = answers?.find((a) => a.question_id === q.id)
      return {
        question: q.question_text,
        answer: answer?.answer_text || '[No answer provided]',
        type: q.question_type as string,
      }
    })

    const prompt = `You are a supportive, experienced interview coach — the kind of mentor who genuinely believes in the candidate and wants to see them succeed. Evaluate the following mock interview answers with warmth and encouragement. Your feedback should build the candidate up while staying honest and specific: always lead with what they did well, and frame every area for growth as an opportunity to improve rather than a failure. Keep the honesty, soften the delivery.

${qaPairs.map((qa, i) => `Q${i + 1} [${qa.type}]: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}

What real interviewers actually screen for at entry level — reward this, not polish:
- Sound judgment, specificity, accountability, genuine self-awareness, evidence of initiative, coachability, honest reflection on mistakes, real motivation (specific reasons for THIS job/company, a real answer to what they want to do), appropriate escalation and role awareness, and empathy where relevant.
- Do NOT over-reward length, corporate buzzwords, raw confidence/polish, or a perfectly structured STAR response for its own sake. Many people-scenarios have multiple defensible answers — do not grade against one single "ideal" answer.

Calibrate to what each question actually is (the bracketed label after each Qn above is its type, but judge by the question's actual content, not just the label):
- The opener ("Tell me about yourself"): grade on thoroughness without rambling, an appropriate time horizon (their story arc, not their whole life), and whether they connect their background to this specific role — not on STAR structure.
- Motivation / self-knowledge questions (typically Q2-Q3 — "why do you want to work here," "what do you want to do"): a one-word or generic answer ("consulting," "I like finance") scores LOW on Relevance and Clarity, with coaching feedback explicitly explaining that employers specifically screen for genuine, specific motivation and self-knowledge, and a generic answer is exactly what a real interviewer flags.
- The two short behavioral questions: grade for the judgment/initiative/coachability signals above, using the full STAR rubric normally.
- The curveball: grade on resourcefulness and judgment, not a "correct" answer.

For each answer, do two things:

1. Score it 0-10 for: Clarity, Confidence, Structure, and Relevance. Scoring floor: if an answer is empty, a single stray character, gibberish, or does not genuinely attempt to answer the question, score all four components 0 — do not award points for effort that is not there, regardless of the encouraging tone.

   Score each dimension against this rubric, not a gut feeling:
   - Clarity — is the point easy to follow and does the answer lead with it, or is it buried, rambling, or hard to parse?
   - Confidence — does the language read as decisive and grounded (owns "I", commits to a position), or hedged, vague, and uncertain?
   - Structure — for the two behavioral questions and the curveball, does the answer follow a recognizable shape (STAR, or a clear logical progression), or does it wander? For the opener and the motivation/self-knowledge questions, judge structure as: does the answer stay organized and on-point for a non-story answer, not whether it hits STAR beats it was never going to have.
   - Relevance — does it actually answer the question asked with concrete substance (specific reasons, numbers, names, examples), or is it generic filler or off-topic? This is where a generic motivation answer gets penalized hardest.
   Calibrate the number to the evidence: 8-10 = strong (specific, well-structured, directly on-point); 5-7 = solid but with real gaps; 2-4 = weak, vague, or only partially responsive; 0-1 = essentially no genuine attempt. Do not cluster every answer in the 6-8 band — spread scores to reflect real differences.

2. Analyze whether the answer uses the STAR method (Situation, Task, Action, Result). For each of the four components, rate it as:
   - "present" — clearly and specifically addressed
   - "weak" — hinted at or vague but not fully developed
   - "missing" — entirely absent
   The opener and the motivation/self-knowledge questions are not story-shaped by design — for those, do not penalize a missing Task/Action/Result as if it were a failed behavioral story; rate Situation/Task/Action/Result "missing" where genuinely absent, but keep the starCoaching sentence focused on what actually matters for that question type (thoroughness and connection to the role for the opener; specificity for motivation/self-knowledge) rather than "add a Result." For the two behavioral questions and the curveball, apply the full STAR rubric normally. Then give a starScore (0–4) counting how many components are "present" (not "weak"). Finally, write one sentence of warm, constructive coaching on how to strengthen that specific answer.

Also identify the candidate's single most valuable blind spot — the one pattern across their answers that they probably haven't noticed themselves, and that would help them most to become aware of. This should feel like a genuinely useful insight from a coach who was paying close attention: specific and personal, like it was written just for them. It must be grounded in something actually present in their answers (a real pattern, not a generic observation).

Give it a short, memorable name (2–5 words, like a chapter title) and one honest, warm sentence that names the specific habit and points toward the upside of addressing it. Pull from concrete details in their answers, and frame it as a helpful realization that will make them stronger — an insight, not an attack.

For biggestMistakes, list the three growth opportunities that would raise their performance the most. For improvements, give three specific, actionable next steps they can apply right away. Keep both honest and concrete, but phrase them the way an encouraging coach would — as constructive moves forward, not a list of things they got wrong. For exampleBetterAnswer, show a stronger version of one of their weakest answers as inspiration for what they're capable of.

Return ONLY a valid JSON object with no extra text:
{
  "evaluations": [
    {
      "scores": { "clarity": 0, "confidence": 0, "structure": 0, "relevance": 0 },
      "star": {
        "situation": "present|weak|missing",
        "task": "present|weak|missing",
        "action": "present|weak|missing",
        "result": "present|weak|missing",
        "starScore": 0,
        "starCoaching": "One sentence of warm, specific coaching here."
      }
    }
  ],
  "blindSpot": {
    "name": "Short Memorable Name",
    "description": "One honest, encouraging sentence grounded in their actual answers, framed as a helpful insight."
  },
  "biggestMistakes": ["mistake1", "mistake2", "mistake3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "exampleBetterAnswer": "A detailed example of how to answer one of the weakest questions better"
}`

    // One Opus call over the whole transcript, no extended thinking — same shape
    // as the other Opus routes here (generate-questions, rewrite-resume,
    // grade-resume). The original bug: this route uniquely enabled adaptive
    // thinking, which shares the max_tokens budget with the output, so long
    // reasoning could leave no room for the JSON → empty text block → "No
    // response" (500). Running without thinking gives the full budget to the
    // evaluation JSON and removes the starvation entirely.
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const evaluationText = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (!evaluationText) {
      throw new Error('No response from Runback')
    }

    let parsed: any
    try {
      const jsonMatch = evaluationText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse evaluation from Runback')
    }

    // Merge question/answer data with scores and STAR analysis
    const evaluations: QuestionEvaluation[] = qaPairs.map((qa, i) => {
      const scores = parsed.evaluations?.[i]?.scores || {
        clarity: 5, confidence: 5, structure: 5, relevance: 5
      }
      const avg = (scores.clarity + scores.confidence + scores.structure + scores.relevance) / 4
      const rawStar = parsed.evaluations?.[i]?.star
      const star: StarAnalysis = {
        situation: rawStar?.situation || 'missing',
        task: rawStar?.task || 'missing',
        action: rawStar?.action || 'missing',
        result: rawStar?.result || 'missing',
        starScore: typeof rawStar?.starScore === 'number' ? rawStar.starScore : 0,
        starCoaching: rawStar?.starCoaching || '',
      }
      return {
        question: qa.question,
        answer: qa.answer,
        scores,
        average: Math.round(avg * 10) / 10,
        star,
      }
    })

    const overallScore = Math.round(
      (evaluations.reduce((sum, e) => sum + e.average, 0) / evaluations.length) * 10
    ) / 10

    const result: EvaluationResult = {
      overallScore,
      evaluations,
      blindSpot: {
        name:        parsed.blindSpot?.name        || 'Unknown Pattern',
        description: parsed.blindSpot?.description || '',
      },
      biggestMistakes: parsed.biggestMistakes || ['N/A', 'N/A', 'N/A'],
      improvements: parsed.improvements || ['N/A', 'N/A', 'N/A'],
      exampleBetterAnswer: parsed.exampleBetterAnswer || '',
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Evaluate error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
