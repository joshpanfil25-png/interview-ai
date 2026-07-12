---
name: add-firm-calibration
description: Add a specific company/firm's real interview-style notes to Runback, so entering that firm produces questions matching how it actually interviews. Use when someone wants firm-specific realism (e.g. Amazon LPs, McKinsey PEI, a Big 4, a bank).
---

# Add firm interview-style calibration

When a candidate enters a known firm, `matchCompanyCalibration()` injects that firm's real interview-style note into the generation prompt. This makes questions firm-accurate (Amazon → Leadership Principles, McKinsey → PEI, etc.). Unknown firms get no calibration — we never fabricate firm-specific detail.

## Where

`app/api/generate-questions/route.ts` → the `COMPANY_CALIBRATION` array (near the top). Each entry is `{ aliases: string[]; note: string }`.

## Steps

1. **Branch** `caroline/...`. Never `main`.
2. **Add an entry** to `COMPANY_CALIBRATION`:
   - `aliases`: lowercase strings matched against the entered company on a **word boundary** (`\bALIAS\b`, case-insensitive). Include realistic variants the user might type (e.g. `['citi', 'citibank', 'citigroup']`, `['jp morgan', 'jpmorgan']`). Firms with the same interview style can share one entry (e.g. all Big 4, all bulge-bracket banks).
   - `note`: 1-2 sentences on how that firm actually interviews and what it grades — grounded in real, verifiable interview methodology, not invented lore. Match the tone of existing notes. Use curly `’` for apostrophes.
3. **Test the matcher for false positives.** Short aliases are the risk. Write a tiny Node script (or reuse `scratchpad/cal_test2.js` pattern) replicating the `\bALIAS\b` match and confirm: the firm's real names match, and near-misses do NOT (e.g. `ey` must not match "Honeywell"/"hey"; `apple` must not match "Applebees"/"Pineapple"; `meta` must not match "Metabolic"). If a short alias false-matches, use a longer/more-distinctive alias.
4. **Verify** with `verify-question-changes` (tsc + lint). No schema change, no new deps.
5. **Commit + PR** to `main`.

## Rules

- Never fabricate firm-specific claims. If you are not confident about how a firm interviews, do not add it — the general vertical guidance is the safe default.
- The calibration is firm-style only; it does not change `question_type` or the schema.
- Keep aliases distinctive enough to avoid collisions across entries (e.g. "morgan" alone would collide between JPMorgan and Morgan Stanley — use the full names).
