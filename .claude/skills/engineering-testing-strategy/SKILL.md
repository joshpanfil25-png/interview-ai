---
name: engineering-testing-strategy
description: Invoke when adding tests to Runback (interview-ai), deciding what to test before a risky change, or when a founder asks "how do we test this?". Runback currently has NO automated tests — this lays out a pragmatic path that fits the route-handler architecture and the incoming auth/memory work.
---

# Runback Testing Strategy

There are currently **no tests** in this repo. Don't try to boil the ocean — add coverage where a regression would silently ship to prod (Vercel auto-deploys on merge). Prioritize in this order.

1. **Route-handler unit tests first.** Each concern is a self-contained `app/api/*/route.ts`. Test the pure, cheap-to-verify parts without live Anthropic/Supabase calls:
   - `generate-questions`: given intake input, assert exactly 6 questions and that every emitted `question_type` is within `behavioral|role-specific|curveball` (guards the DB check constraint). Mock the Anthropic client and feed representative + malformed completions to test the response-parsing path.
   - `evaluate` / `evaluate-single`: these are Josh's scoring area — coordinate before adding tests, but response-shape/parsing tests are safe and valuable.
2. **Question-quality regression harness.** The core product risk is question quality (Caroline's area). Build a lightweight harness that runs `generate-questions` against a fixed set of intake fixtures (job roles + school/program admissions cases) and checks structural invariants: exactly 6 questions, valid types, no duplicates, non-empty, reflects `verticalGuidance`/`COMPANY_CALIBRATION`/`arcOverrides`. Snapshot outputs so prompt edits show a reviewable diff instead of a silent drift.
3. **Pick a runner that fits Next 16 + TS.** Vitest is the pragmatic choice (fast, TS-native). Confirm the dependency add with a founder first (no new npm deps without sign-off). Do not wire it into `/ship` as a blocker until it's green and agreed.
4. **Contract-test the DB shape, don't mutate it.** Assert inserts match `sessions/questions/answers` columns and the `question_type` constraint — but never let a test create/alter schema. Use a disposable test session id and clean up.
5. **Anticipate auth + memory.** Both are coming. When they land, add: auth-callback redirect-origin tests (the localhost-vs-prod Site URL trap) and session-continuity tests (a returning user's history resolves correctly). Keep handlers pure enough to test now so this is cheap later.
6. **Manual mobile pass stays mandatory** regardless of automated coverage — click the real flow on a phone before "done."
