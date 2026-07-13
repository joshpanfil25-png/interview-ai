---
name: add-interview-vertical
description: Add a new interview vertical to Runback (a new option in the industry/major dropdown with its own question guidance). Use when someone wants the app to cover a new field, major, role, or interview type.
---

# Add an interview vertical

Runback's coverage lives in two files that MUST stay in sync. Adding a vertical = a guidance string + a dropdown option (+ school-vertical membership for admissions interviews).

## The two files

1. `app/api/generate-questions/route.ts` — the `verticalGuidance` object (a `Record<string, string>`). Each key is a vertical; its value is one paragraph injected into the Opus question-generation prompt.
2. `app/page.tsx` — the `INTERVIEW_TYPES` array (the dropdown the user picks from).

The key string must be **byte-identical** across both files. A dropdown entry with no matching guidance key silently falls back to `General`; a guidance key with no dropdown entry is dead code.

## Steps

1. **Branch** `caroline/...` (or `josh/...`). Never work on `main`.
2. **Write the guidance** in `verticalGuidance`, matching the house style of the strongest existing entries (Sales, HR, Government): 2-4 sentences, scenario-grounded, tells the model what the *role-specific* question should actually be, and pushes for specifics over a generic prompt. Insert it anywhere in the object (order does not matter for a map) — inserting before `'Product Management':` is a convenient anchor.
3. **Add the exact same key** to `INTERVIEW_TYPES` in `app/page.tsx`, in a sensible group.
4. **If it is a school/admissions interview** (candidate applies to a program, not a job): add the key to `SCHOOL_VERTICALS` in BOTH `route.ts` and `page.tsx` — this relabels the Company/Role fields to School/Program. Job-type verticals (including things like residency, where "company" = hospital and "role" = specialty) do NOT go in SCHOOL_VERTICALS.
5. **Verify** with the `verify-question-changes` skill (sync check + tsc + lint). Guidance and dropdown counts must be equal.
6. **Commit + open a PR** to `main` (never push to main — Vercel auto-deploys on merge; Josh/Cooper approve).

## Hard rules (from CLAUDE.md)

- **Do NOT add a new `question_type`.** Questions are always `behavioral | role-specific | curveball` (Postgres check constraint). A vertical only changes question *content*, never types. No schema change.
- Prompts stay as inline template strings in the route — do not extract a new abstraction.
- In guidance strings, use the curly `’` for apostrophes and straight `"` for internal quotes. A raw ASCII `'` terminates the string. (Existing entries already do this; a Python `str.replace` script is the reliable way to edit them without escaping pain.)

## Non-standard arcs

If the vertical is a *conversation*, not a STAR interview (like Coffee Chat or Startup/Founder/VC), guidance alone is NOT enough — the hardcoded `focusOrder` + interview framing override it. Add the vertical to the `arcOverrides` map (near `orderInstructions`) with 6 custom question lines, and branch the `framingIntro`/`qualityBar` if the "interview" framing fights the intent. Keep the override types as the Balanced pattern so `question_type` stays valid.

## Quality bar

Before shipping a vertical, sanity-check it with the `audit-vertical-readiness` skill: would a real interviewer for that field say practicing these questions prepares the candidate? Fix category errors (wrong altitude, wrong interview type) before opening the PR.
