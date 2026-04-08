import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
}

export type EvaluationResult = {
  overallScore: number
  evaluations: QuestionEvaluation[]
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

    // Fetch questions
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
      }
    })

    const prompt = `You are an expert interview coach. Evaluate the following mock interview answers.

${qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}

Score each answer on a scale of 1-10 for: Clarity, Confidence, Structure, and Relevance.

Return ONLY a valid JSON object with no extra text:
{
  "evaluations": [
    {
      "scores": { "clarity": 0, "confidence": 0, "structure": 0, "relevance": 0 }
    }
  ],
  "biggestMistakes": ["mistake1", "mistake2", "mistake3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "exampleBetterAnswer": "A detailed example of how to answer one of the weakest questions better"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let parsed: any
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse evaluation from Claude')
    }

    // Merge question/answer data with scores
    const evaluations: QuestionEvaluation[] = qaPairs.map((qa, i) => {
      const scores = parsed.evaluations?.[i]?.scores || {
        clarity: 5, confidence: 5, structure: 5, relevance: 5
      }
      const avg = (scores.clarity + scores.confidence + scores.structure + scores.relevance) / 4
      return {
        question: qa.question,
        answer: qa.answer,
        scores,
        average: Math.round(avg * 10) / 10,
      }
    })

    const overallScore = Math.round(
      (evaluations.reduce((sum, e) => sum + e.average, 0) / evaluations.length) * 10
    ) / 10

    const result: EvaluationResult = {
      overallScore,
      evaluations,
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
