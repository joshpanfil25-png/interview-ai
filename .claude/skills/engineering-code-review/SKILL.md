---
name: engineering-code-review
description: Invoke before opening a PR or when reviewing a diff in the Runback (interview-ai) repo. Enforces the project's hard rules — question_type constraint, no schema changes, no evaluate-route edits, mobile-first, and lint parity vs main — so a diff never merges violating a founder-owned boundary.
---

# Runback Code Review

Run this against the working diff (`git diff main...HEAD`) before requesting review. Runback deploys to Vercel on merge to `main`, so a bad diff ships to prod. Reject on any item below.

1. **question_type constraint.** Grep the diff for any question `type` / `question_type` literal. It MUST be exactly one of `behavioral | role-specific | curveball` (Postgres check constraint in `supabase-schema.sql:15`). A new question category must map into one of the three — never a new value. If the diff needs a new value, it needs a schema migration, which needs Josh's sign-off. Block.
2. **No schema changes.** No `alter table` / `create table` / new column/table in the diff or in any `.sql` file without explicit Josh sign-off noted in the PR. Even "small" ones. Block.
3. **No evaluate-route edits.** `app/api/evaluate/route.ts` and `app/api/evaluate-single/route.ts` are scoring (Josh's area). If either is touched without an explicit request, flag and block.
4. **Supabase client lifetime.** Any new Supabase usage must create the client at request time inside the handler (via the `lib/supabase*` helper), never a module-level singleton. Block a module-level client.
5. **Prompt pattern.** Prompt changes stay as inline template strings inside the route handler (e.g. `app/api/generate-questions/route.ts`). No new prompt-abstraction/file introduced unilaterally.
6. **Secrets.** No API keys, `.env.local` values, or credentials in code, comments, or commit message.
7. **Mobile-first.** Most users are on phones. Any UI change must use the Tailwind breakpoints already present in the file and be verified at a narrow viewport. Confirm it was tested on mobile.
8. **Style.** camelCase vars/functions, PascalCase components, Tailwind inline, brand tokens from `app/globals.css @theme` (no hardcoded hex where a `--color-*` token exists).
9. **Scope.** Only files for the current task changed. Unrelated fixes belong in the PR description, not the diff.
10. **Lint parity.** `npx tsc --noEmit` clean; `npm run lint` introduces NO new errors vs `main` (pre-existing `any` warnings are fine — don't fix unrelated ones here).
11. **Branch discipline.** Branch is name-namespaced (`caroline/…`, `josh/…`); PR targets a review by Josh or Cooper. Never a direct push to `main`.
