@AGENTS.md

<!-- The line above pulls in the Next.js 16 breaking-changes warning that was already
     here. Don't remove it -- Next 16 differs from Claude's training data and Claude
     Code needs that reminder every session. -->

# Runback (interview-ai) — Project Context

Runback is an AI mock-interview product: a candidate enters a company/role (or target
school/program for admissions verticals), gets 6 tailored interview questions, answers
them, and gets scored feedback. Two founders build here: Josh (backend/infra owner,
GitHub admin) and Caroline (question quality / prompt engineering owner).

## Tech Stack
- Framework: Next.js 16.2.2 (App Router, Turbopack), React 19.2.4, TypeScript 5
- Styling: Tailwind CSS 4, custom brand tokens defined in `app/globals.css` under `@theme`
- Database: Supabase (Postgres) — 3 tables: `sessions`, `questions`, `answers`
- AI: `@anthropic-ai/sdk` — Claude Opus for question generation and full evaluation,
  Claude Haiku for fast per-answer feedback
- Resume parsing: `pdfjs-dist` (client-side PDF text extraction)
- Email: `nodemailer`
- Deploy: Vercel, auto-deploys on merge to `main`

## Architecture Rules
- API routes live in `app/api/*/route.ts`, one route per concern. Don't merge unrelated
  logic into an existing route — add a new one.
- Supabase client is created at **request time** inside each route handler via
  `getSupabaseClient()`, never at module load time. This is intentional — do not refactor
  it to a module-level singleton.
- `question_type` is constrained by a Postgres check constraint to exactly
  `behavioral | role-specific | curveball` (see `supabase-schema.sql`). Any new question
  category must map into one of these three — do not add a new type value without a
  schema migration, and do not add a schema migration without Josh's sign-off first.
- Session/question/answer flow: `sessionId` (uuid) is generated client-side, written to
  `localStorage` and to Supabase in the same request. Don't change this id generation
  pattern without checking both `app/page.tsx` and every API route that reads `sessionId`.
- Prompts sent to the Anthropic API are built as large template strings inside the route
  handler, not extracted to separate prompt files. This is the existing pattern — follow
  it rather than introducing a new prompt-management abstraction on your own initiative.

## Local Development
- **Google sign-in on localhost:** to test the auth flow locally, the Supabase
  dashboard (Authentication → URL Configuration → Redirect URLs) must include
  `http://localhost:3000/**`. Without it, Supabase ignores the app's `redirectTo`
  and falls back to the **Site URL** (`https://runback.app`), so after Google
  consent you land on production instead of back on localhost. Leave Site URL as
  `https://runback.app` (correct for prod) and keep `https://runback.app/**` in
  the allowlist too. The app code already sends the right origin — this is a
  dashboard config, not a code fix.

## Code Style
- camelCase for variables/functions, PascalCase for components
- Tailwind utility classes inline in JSX — no separate CSS modules or styled-components
- Brand colors/fonts referenced as CSS custom properties (`--color-brand`, `--font-inter`,
  etc.) defined in `app/globals.css` — never hardcode a hex value that already has a token
- Keep API route files self-contained: types, prompt-building, and the handler all live
  in the same `route.ts` unless a type is genuinely shared across multiple routes

## What NOT to Do
- Never push straight to `main`. Always: branch → PR → Josh or Cooper approves → merge.
  Vercel auto-deploys ~2 minutes after merge, no manual deploy step exists or is needed.
- Never commit `.env.local` (already gitignored — don't fight that) or paste real
  credentials anywhere in chat, code comments, or commit messages.
- Do not add a Supabase table or column without explicit confirmation first — no schema
  changes without sign-off, ever, even for something that feels small.
- Do not install a new npm dependency without confirming first — check whether an
  existing library already covers the need.
- Do not modify files unrelated to the current task. If a fix belongs somewhere else,
  flag it in the PR description instead of expanding scope silently.
- Do not touch `evaluate/route.ts` or `evaluate-single/route.ts` (scoring logic) without
  explicit request — that's Josh's area unless stated otherwise.
- Test on mobile before calling anything done — most users are on phones.

## Custom Commands
Type these directly to Claude Code at the start of a session.

### /plan
Before writing any code:
1. Restate the task in one sentence to confirm shared understanding
2. List every file that will change and why
3. Flag anything that touches Supabase schema, `evaluate*` routes, or the
   `question_type` enum — those need explicit go-ahead before proceeding
4. Write a short step-by-step plan
5. Wait for approval before writing code

### /review
Run this checklist against the diff before committing:
1. Does every question `type` value stay within `behavioral | role-specific | curveball`?
2. Any hardcoded secrets, API keys, or `.env` values leaking into the diff?
3. Does this follow the existing prompt-string pattern rather than introducing a new one?
4. Mobile-responsive? (check the actual Tailwind breakpoints used elsewhere in the file)
5. Does this stay inside the current task's files, or did scope creep in?

### /ship
Before pushing:
1. `npx tsc --noEmit` — must be clean
2. `npm run lint` — no *new* errors versus what's already on `main` (some pre-existing
   `any` warnings exist in this repo; don't try to fix unrelated ones in your PR)
3. `npm run dev`, click through the actual flow, test on a phone
4. `git diff` — read every line before committing, make sure nothing unrelated snuck in
5. Descriptive commit message: what changed and why, not just "fix stuff"
6. Push to a branch namespaced with your name (e.g. `caroline/...`, `josh/...`) —
   never push directly to `main`

## Session Hygiene
- Run `/clear` between unrelated tasks (e.g. after finishing question-quality work,
  before starting a login/auth task) — don't let one long session accumulate unrelated
  context, output quality degrades as context fills up
- For anything nontrivial, use `/plan` first and get it approved before implementation,
  rather than iterating live in code
- If a fix goes sideways (like a long debugging back-and-forth), prefer rewinding
  (double-Esc or `/rewind`) to before the failed attempt and re-prompting with what was
  learned, rather than letting the failed attempts pile up in context
