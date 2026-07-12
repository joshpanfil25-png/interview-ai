---
name: verify-question-changes
description: Pre-commit + post-merge integrity check for changes to the question-generation code (verticals, guidance, calibration, prompt instructions). Run before every PR that touches generate-questions or the intake dropdown, and after a stack of such PRs merges.
---

# Verify question changes

The `/ship` checklist plus the integrity checks that caught a silently-dropped clause after a merge. Run this before opening any PR that touches `app/api/generate-questions/route.ts` or `app/page.tsx`, and again on `main` after several such PRs land.

## Pre-commit checks

1. **Dropdown ↔ guidance sync.** The `INTERVIEW_TYPES` array (`app/page.tsx`) and the `verticalGuidance` keys (`app/api/generate-questions/route.ts`) must have the same set of entries (ignoring `General`, which has a code fallback). No dropdown-without-guidance (silent fallback), no guidance-without-dropdown (dead code), no duplicates. School verticals must match across `SCHOOL_VERTICALS` in both files. A short Python script that parses both and diffs the sets is the reliable check.

2. **`npx tsc --noEmit`** — must be 0 errors.

3. **`npm run lint`** — no *new* problems vs. `main`. The repo has pre-existing `any` warnings/errors; do not fix unrelated ones. Confirm parity by linting the changed files on your branch, then `git stash` and lint the same files on `main`, and compare the counts — they should be identical.

4. **No schema / scoring / model / secret changes** unless that is explicitly the task. `git diff` and grep for `question_type`, `SUPABASE`, `ANTHROPIC_API`, `Math.max` (scoring clamps), `model:`, and `.env`. Question types must stay `behavioral | role-specific | curveball`. Do not touch `evaluate/route.ts` or `evaluate-single/route.ts` without explicit sign-off.

5. **Mobile** — if `page.tsx` layout changed (not just a dropdown option), check the Tailwind breakpoints used elsewhere in the file.

## Post-merge integrity check (do this after a stack of guidance PRs merges)

Branches cut independently off `main` that touch the same regions (the vertical list near `'Product Management':`, or the shared `specializationInstruction` / `seniorityInstruction` strings) will conflict on merge, and conflict resolution can **silently drop** a change. After the stack lands, on latest `main`:

1. Re-run the sync check (counts + set diff).
2. `grep` for a unique phrase from **each** merged change to confirm none were lost (e.g. `arcOverrides`, `distinctive expertise`, `Many verticals bundle`, each new vertical key, each new calibration alias).
3. Scan for leftover conflict markers: `grep -n '<<<<<<<\|=======\|>>>>>>>'`.
4. `npx tsc --noEmit`.

If a phrase is missing, a merge dropped it — restore it in a small follow-up PR.

## Prefer fewer, sequential PRs

Many parallel PRs off `main` that touch the same file cause exactly this merge-drop risk. When making a batch of guidance changes, prefer stacking them (each branch off the previous) or one consolidated PR, so they apply cleanly.
