---
name: engineering-documentation
description: Invoke when documenting a Runback (interview-ai) change, updating CLAUDE.md/AGENTS.md, or writing a PR description. Keeps docs consistent with how this two-founder repo actually works — inline prompts, request-scoped clients, founder ownership, and the Next 16 caveat — without spawning stray markdown files.
---

# Runback Documentation

Runback is a small two-founder repo (Josh: backend/infra/scoring/schema; Caroline: question quality/prompts). Docs should serve *them*, not generic readers. Don't create new doc files unless asked — prefer updating what exists.

1. **Know the canonical docs.** `CLAUDE.md` (project context + `/plan` `/review` `/ship` commands + hard rules) pulls in `AGENTS.md` (the Next 16 "not the Next.js you know — read `node_modules/next/dist/docs/`" warning) via the top `@AGENTS.md` line. Never remove that line. `supabase-schema.sql` is the source of truth for the data model.
2. **Update the right place.** A new rule/constraint → `CLAUDE.md`. A schema change (only after Josh's sign-off) → `supabase-schema.sql` *and* the CLAUDE.md description of the tables. A Next-16 gotcha → keep it near the AGENTS.md caveat. Don't scatter notes into new `README`s.
3. **PR descriptions carry the real documentation.** For each PR state: what changed and why; every file touched; explicit flags for anything near schema, `evaluate*` routes, or `question_type`; and any out-of-scope debt you noticed but did NOT fix. This is where reviewers (Josh/Cooper) get context.
4. **Document decisions, not just code.** When a choice is deliberate (request-scoped Supabase client, inline prompt strings, three-value `question_type`, client-side uuid `sessionId`), say *why* so the next session doesn't "refactor" it away.
5. **Reference real symbols/paths.** Point to actual files (`app/api/generate-questions/route.ts`, `app/page.tsx` `INTERVIEW_TYPES`, `lib/supabase*`) and real identifiers (`verticalGuidance`, `COMPANY_CALIBRATION`, `arcOverrides`) rather than vague descriptions.
6. **Match house style.** camelCase/PascalCase conventions, Tailwind-inline + brand tokens in `app/globals.css @theme`, mobile-first — reflect these when documenting UI work.
7. **No secrets in docs, comments, or commit messages.** Never paste `.env.local` values or credentials anywhere.
8. **Keep it concise and actionable.** These founders read fast — bullet the essentials, skip fluff, and don't restate what the code already makes obvious.
