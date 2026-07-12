---
name: design-design-critique
description: Structured visual critique of a Runback screen from a screenshot — visual hierarchy, spacing/rhythm, brand consistency, mobile layout, and clarity of the primary action. Use when someone pastes a screenshot and wants design feedback, or to self-review a UI change before a PR.
---

# Runback design critique

Turn a screenshot into structured, actionable feedback. Works self-run (before a PR) or handed to a reviewer. Ask for the screenshot at the width that matters — **default to mobile**, since most Runback users are on phones; request a desktop shot too for the intake two-column layout.

## What to ask for
- The screenshot (mobile width first; desktop if the layout is responsive).
- Which page (intake / interview / results) and what the **one primary action** is meant to be.

## Critique checklist
Go through each; for every issue name the specific element and a concrete fix, not just a verdict.

1. **Visual hierarchy** — Does the eye land on the primary action first? Is there one clear focal point, or are several elements competing? Headings > labels > body should be obvious by size/weight. Is `--color-volt` reserved for scores/wins, or is it diluting the accent hierarchy?
2. **Spacing & rhythm** — Consistent gaps (the form uses `space-y-3`, `gap-4`)? Any cramped or orphaned element? Even padding inside cards (`p-5`)? Aligned left edges down the column?
3. **Brand consistency** — Colors from the `@theme` tokens only (no stray hexes)? Sprint Orange `#FF5A1F` for actions, surfaces in the warm-dark family, Inter for body / `.font-display` for the wordmark? Field/label/card recipes match the rest of the app?
4. **Mobile layout** — At ~375px: no horizontal scroll, no truncated labels (watch the Target School/Program relabel — longer strings), tap targets ≥ ~44px, two-column `sm:grid-cols-2` blocks stack cleanly to one column?
5. **Primary action clarity** — Is the main CTA unmistakably the brightest/most prominent element? Verb-first label? Are secondary/optional actions visually quieter so they don't compete?
6. **Copy at a glance** — Labels scannable, tone consistent with the coach voice, states (loading/empty/error) present where expected?

## Procedure
1. Restate the page and its intended primary action in one line.
2. Walk the 6 checklist items; log each finding as **element → problem → concrete fix**, referencing tokens/recipes from `app/globals.css` and `app/page.tsx`.
3. Rank findings: blockers (breaks hierarchy or mobile) first, then polish.
4. Call out what's already working — keep it, don't churn it.
5. If the ask is net-new aesthetic direction rather than a critique of existing UI, hand off to the built-in `frontend-design` skill.
