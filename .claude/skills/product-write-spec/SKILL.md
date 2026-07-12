---
name: product-write-spec
description: Turn a Runback fix-list item or feature idea into a one-page spec BEFORE any code — problem, goal/non-goals, user story, proposed change, files touched, and explicit sign-off flags for anything hitting the Supabase schema, evaluate* scoring routes, or the question_type enum. Use this when someone says "spec this", "write it up before coding", or hands you a raw idea/bug to plan.
---

# Write a Runback spec

One page, before code. This front-loads the disagreements so the /plan command and the PR are cheap. Do not skip to implementation.

## Procedure

1. **Restate in one sentence.** What is the candidate-facing change, in plain words? If you can't, the idea isn't ready — ask.

2. **Fill the template below.** Keep it to one screen. If a section is empty, say so explicitly ("Non-goals: none yet") rather than deleting it.

3. **Run the sign-off scan.** Grep your proposed change against these tripwires. If ANY are hit, the spec is blocked on the named owner before code starts — write that in the Flags section, don't just note it in passing:
   - Touches `supabase-schema.sql`, adds/renames a table or column, or changes the `sessions` / `questions` / `answers` shape → **Josh sign-off**.
   - Adds or changes a `question_type` value (the check constraint is exactly `behavioral | role-specific | curveball`) → **Josh sign-off + schema migration**. New question categories must map into one of the three existing types.
   - Touches `app/api/evaluate/route.ts` or `app/api/evaluate-single/route.ts` (scoring) → **Josh's area, explicit request required**.
   - Needs a new npm dependency → confirm first; check if an existing lib already covers it (e.g. `lib/fillerWords.ts`, `pdfjs-dist`, `nodemailer`).

4. **Name every file that changes and why** — real paths (`app/api/generate-questions/route.ts`, `app/page.tsx`, `lib/*`). If you can't list them, you haven't scoped it.

5. **Hand off to `/plan`.** The spec is the input to /plan; /plan produces the step-by-step and waits for approval. Don't write code from the spec directly.

## Template

```
# <feature/fix name>

Problem:        What breaks or is missing today, from the candidate's POV.
Goal:           The one outcome that means this is done.
Non-goals:      What this explicitly does NOT do (scope fence).
User story:     As a <candidate/founder>, I want <x> so that <y>.
Proposed change: The actual approach, 2-4 sentences. Prompt-only? UI? Route logic?
Files touched:  path — why
                path — why
Flags (sign-off): schema? evaluate*? question_type? new dep?  Who signs off, or "none".
Success metric: How we'll know it worked (e.g. curveball relevance up, drop-off down,
                fewer off-rubric scores). Prefer something observable, not vibes.
Open questions: The things we genuinely don't know yet.
```

## Runback-specific notes
- Prompts are big template strings inside the route handler — a "prompt change" spec usually touches exactly one `route.ts` and needs no schema flag. Say so; that's the easy, fast path and most question-quality work lives here.
- `sessionId` is generated client-side and written to both localStorage and Supabase in one request. Any spec touching identity/session flow must list both `app/page.tsx` and every route that reads `sessionId`.
- Mobile is the default surface — if the change is UI, the spec's success metric should mention the phone view.
