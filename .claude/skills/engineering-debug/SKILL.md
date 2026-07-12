---
name: engineering-debug
description: Invoke when something in Runback (interview-ai) is broken — questions not generating, evaluation failing, resume upload erroring, auth redirect landing on prod, or a route 500ing. Gives a Runback-specific triage order across the Next.js route handlers, Anthropic calls, Supabase, and pdfjs.
---

# Runback Debugging

Runback's runtime is a chain: intake (`app/page.tsx`) → `generate-questions` → `interview/[sessionId]` → `evaluate*` → `results/[sessionId]` / `email-results`, backed by Supabase (`sessions`, `questions`, `answers`) and Anthropic (Opus + Haiku). Isolate which link fails before changing code.

1. **Reproduce with a real sessionId.** `sessionId` is a client-generated uuid stored in `localStorage` and written to Supabase in the same request. Grab it from the URL / localStorage and use it to trace `sessions` → `questions` → `answers` rows in Supabase for that session.
2. **Read the failing route handler's logs.** Each concern is one `app/api/*/route.ts`. Check Vercel runtime logs (or the local `npm run dev` console) for the specific route. Note whether the error is pre-Anthropic (bad input), in the Anthropic call, or post (parsing the model response).
3. **Anthropic-call failures.** Opus is used for `generate-questions` and full `evaluate`; Haiku for `evaluate-single`. Check: model id valid, API key present, and — most common — the model returned text that didn't match the expected JSON/shape the handler parses. Log the raw completion before blaming the DB.
4. **question_type errors.** An insert into `questions` that violates the check constraint (`behavioral|role-specific|curveball`) throws at the DB. If generation drifted to a 4th type, fix the prompt in `generate-questions/route.ts` — do not loosen the constraint.
5. **Supabase failures.** Confirm the client is built at request time via the `lib/supabase*` helper (a stale/module-level client is a known foot-gun). Check RLS policies (currently allow-all) and that the `session_id` FK exists before inserting `questions`/`answers`.
6. **Resume parsing.** `pdfjs-dist` runs client-side. Failures are usually a scanned/image PDF (no text layer) or a worker-loading issue — check the browser console, not server logs.
7. **Auth redirect lands on prod.** Known config issue: Supabase Dashboard → Auth → Redirect URLs must include `http://localhost:3000/**`, else it falls back to Site URL (`https://runback.app`). This is a dashboard fix, not code (see CLAUDE.md Local Development).
8. **Reproduce on mobile** if the report is UI-related — most users are on phones and layout bugs may not show on desktop.
9. **If a fix goes sideways,** rewind to before the failed attempt and re-prompt with what was learned rather than stacking attempts. Do not expand scope to "clean up while here."
