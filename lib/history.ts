export type HistoryEntry = {
  sessionId: string
  date: string           // ISO string
  company: string
  role: string
  interviewType: string
  overallScore: number
  scores: {
    clarity: number
    confidence: number
    structure: number
    relevance: number
  }
  fillerCount: number
}

const STORAGE_KEY = 'interview_history'
const MAX_ENTRIES = 20

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

/** Prepend entry, deduplicate by sessionId, cap at MAX_ENTRIES. */
export function saveHistoryEntry(entry: HistoryEntry): void {
  const history = loadHistory()
  const filtered = history.filter((h) => h.sessionId !== entry.sessionId)
  filtered.unshift(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ENTRIES)))
}
