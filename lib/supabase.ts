import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  }
  _supabase = createClient(url, key)
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

export type Session = {
  id: string
  company: string
  role: string
  linkedin_url?: string
  created_at: string
}

export type Question = {
  id: string
  session_id: string
  question_text: string
  question_type: 'behavioral' | 'role-specific' | 'curveball'
  order_index: number
}

export type Answer = {
  id: string
  session_id: string
  question_id: string
  answer_text: string
  created_at: string
}
