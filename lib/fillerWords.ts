// Filler word detection utility.
// Phrases must come before their component single words to avoid double-counting.
// All matches are whole-word (word boundaries) to avoid false positives inside longer words.

export const FILLER_PATTERNS: { word: string; pattern: RegExp }[] = [
  { word: 'you know',  pattern: /\byou know\b/gi },
  { word: 'kind of',   pattern: /\bkind of\b/gi },
  { word: 'sort of',   pattern: /\bsort of\b/gi },
  { word: 'um',        pattern: /\buh*m+\b/gi },   // catches "um", "umm", "uhm"
  { word: 'uh',        pattern: /\buh+\b/gi },
  { word: 'like',      pattern: /\blike\b/gi },
  { word: 'so',        pattern: /\bso\b/gi },
  { word: 'literally', pattern: /\bliterally\b/gi },
  { word: 'basically', pattern: /\bbasically\b/gi },
  { word: 'right',     pattern: /\bright\b/gi },
]

export type FillerCount = {
  /** Total filler occurrences across all patterns */
  total: number
  /** Per-word counts, e.g. { like: 4, um: 2, ... } */
  breakdown: Record<string, number>
}

/** Count filler words in a single text string. */
export function countFillers(text: string): FillerCount {
  // Work on a copy with multi-word phrases blanked out first so single-word
  // patterns don't re-match inside them.
  let working = text
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const { word, pattern } of FILLER_PATTERNS) {
    const matches = working.match(pattern) ?? []
    const count = matches.length
    if (count > 0) {
      breakdown[word] = count
      total += count
      // Blank matched spans so subsequent single-word patterns can't overlap
      working = working.replace(pattern, ' '.repeat(word.length))
    }
  }

  return { total, breakdown }
}

/** Run filler counting across an array of answer strings (one per question). */
export function countFillersPerAnswer(answers: string[]): FillerCount[] {
  return answers.map(countFillers)
}

/**
 * Aggregate per-answer breakdowns into a ranked list of the most-used filler words.
 * Returns entries sorted by count descending.
 */
export function rankFillers(perAnswer: FillerCount[]): { word: string; count: number }[] {
  const totals: Record<string, number> = {}
  for (const { breakdown } of perAnswer) {
    for (const [word, count] of Object.entries(breakdown)) {
      totals[word] = (totals[word] ?? 0) + count
    }
  }
  return Object.entries(totals)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Fluency score 0–10 based on fillers-per-100-words.
 * ≤1 filler per 100 words → 10, degrades ~1 point per extra filler per 100 words.
 */
export function fluencyScore(totalFillers: number, totalWords: number): number {
  if (totalWords === 0) return 10
  const rate = (totalFillers / totalWords) * 100 // fillers per 100 words
  return Math.max(0, Math.round(10 - rate))
}

/** Word count for a plain-text string. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
