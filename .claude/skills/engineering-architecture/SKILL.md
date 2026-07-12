---
name: engineering-architecture
description: Invoke when you need to understand or explain how Runback (interview-ai) is put together, before a change that spans multiple files, or when onboarding to the codebase. Maps the actual routes, libs, data model, and the intentional constraints so changes respect existing structure.
---

# Runback Architecture

Runback is a Next.js 16.2 (App Router, Turbopack) + React 19 + TS app on Vercel, backed by Supabase Postgres and Anthropic. Understand these boundaries before restructuring anything.

1. **Request flow.** `app/page.tsx` (intake form + `INTERVIEW_TYPES`, generates a client-side uuid `sessionId`) → `app/api/generate-questions/route.ts` (Opus builds 6 questions) → `app/interview/[sessionId]/page.tsx` (answering) → `app/api/evaluate-single/route.ts` (Haiku, per-answer feedback) and `app/api/evaluate/route.ts` (Opus, full evaluation) → `app/results/[sessionId]/page.tsx` and `app/api/email-results/route.ts` (nodemailer).
2. **Data model (3 tables).** `sessions` (id uuid PK, company, role, linkedin_url) → `questions` (session_id FK, question_text, `question_type` ∈ `behavioral|role-specific|curveball`, order_index) → `answers` (session_id + question_id FKs, answer_text, unique per pair). Cascade deletes. RLS is currently allow-all (no auth yet). Schema is `supabase-schema.sql`.
3. **One route per concern.** Each `app/api/*/route.ts` owns one job (generate, evaluate, evaluate-single, grade-resume, rewrite-resume, email-results, log-user). Add a new route rather than merging unrelated logic into an existing one.
4. **Supabase client is request-scoped by design.** Built inside each handler via a `lib/supabase*` helper, never module-level. `lib/` holds shared concerns: `supabase.ts`, `supabaseServerClient.ts`, `supabaseBrowserClient.ts`, `supabaseProxy.ts`, `useUser.ts`, `authActions.ts`, `history.ts`, `fillerWords.ts`. Do NOT refactor the client to a singleton.
5. **Prompts live inline.** Large template strings inside the route handler (see `verticalGuidance`, `COMPANY_CALIBRATION`, `arcOverrides` in `generate-questions/route.ts`). No separate prompt-management layer — follow the pattern, don't invent an abstraction.
6. **Styling.** Tailwind 4 inline utilities; brand tokens under `@theme` in `app/globals.css` (`--color-*`, `--font-*`). No CSS modules / styled-components; no hardcoded hex where a token exists. Mobile-first.
7. **Ownership boundaries.** Josh owns backend/infra + scoring (`evaluate*` routes) + schema + is GitHub admin. Caroline owns question quality / prompt engineering (`generate-questions`). Respect these when deciding who signs off.
8. **Note the Next 16 caveat.** `AGENTS.md`/`CLAUDE.md`: this Next.js differs from training data — consult `node_modules/next/dist/docs/` before using framework APIs, and heed deprecation notices.
