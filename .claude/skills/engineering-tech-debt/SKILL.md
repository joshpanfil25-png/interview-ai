---
name: engineering-tech-debt
description: Invoke when assessing, logging, or proposing to pay down tech debt in Runback (interview-ai), or when tempted to "clean up while you're in here". Distinguishes real debt from intentional design decisions so you don't refactor away a founder's deliberate choice.
---

# Runback Tech Debt

Some things that look like debt are intentional. Never refactor them without sign-off — flag in the PR description instead. Use this to sort deliberate-choice from real-debt.

## Do NOT "fix" — these are intentional
- Request-time Supabase client (not a module singleton). Deliberate.
- Inline prompt template strings in route handlers (no prompt-management layer). Deliberate — follow the pattern.
- `question_type` limited to three values via a DB check constraint. Deliberate — map new categories in, don't add values.
- Client-side uuid `sessionId` + localStorage. Deliberate id pattern.
- Pre-existing `any`/lint warnings on `main`. Don't fix unrelated ones in an unrelated PR (breaks lint-parity reasoning and creeps scope).
- Allow-all RLS. Placeholder until auth lands — not something to "harden" ad hoc.

## Real debt worth tracking
1. **No automated tests** — the biggest gap; see engineering-testing-strategy for the pragmatic path.
2. **Fragile model-response parsing** — handlers parse Anthropic completions; malformed output can 500. Hardening parsing (with tests) is legitimate debt paydown.
3. **Duplicated Supabase/util logic** across `lib/` and routes — consolidate into `lib/` only when genuinely shared, without changing the request-scoped-client contract.
4. **Auth/memory readiness** — anonymous-session assumptions will need revisiting when `user_id` arrives.

## How to handle it
1. **Log, don't drive-by.** Note debt in the PR description or an issue; do not expand the current task's scope to pay it down silently.
2. **Never bundle a refactor with a feature/fix** — separate PR, separate review.
3. **Anything touching schema, `evaluate*` routes, or `question_type`** needs Josh's explicit sign-off before you start, even if it "feels small."
4. **Keep changes on a name-namespaced branch → PR → Josh/Cooper approval.** No direct push to `main` (Vercel auto-deploys it).
5. **Verify parity after any cleanup:** `npx tsc --noEmit` clean, no new lint errors vs `main`, mobile still works.
