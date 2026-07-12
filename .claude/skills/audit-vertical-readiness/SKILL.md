---
name: audit-vertical-readiness
description: Stress-test whether Runback's generated questions would actually make a candidate interview-ready for a given vertical/persona, using an expert-interviewer lens. Use before shipping a vertical, after editing guidance, or to sweep-audit the whole app for category errors.
---

# Audit vertical readiness

This is the QA method that has caught every real question-quality bug (residency using med-school questions, sports-marketing forced into CAC/ROAS, Coffee Chat producing a STAR interview instead of a networking chat). Run it to verify a vertical produces genuinely useful, on-target questions — not just plausible ones.

## Method (per vertical + persona)

1. **Pick a realistic persona** for the vertical: a specific role, company, and seniority (e.g. "new-grad RN, Med-Surg, Cleveland Clinic"; "1L Summer Associate, Kirkland & Ellis"). Edge personas expose the most bugs — try a non-obvious major, an entry-level candidate, or a niche sub-role.
2. **Read the vertical's guidance** from `verticalGuidance` in `app/api/generate-questions/route.ts`, plus the global instructions that wrap every prompt: seniority calibration, the realism/quality bar, anti-repeat (4 distinct behavioral competencies), the specialization instruction (target the actual industry/company + distinctive expertise + sub-role), and `arcOverrides` if the vertical has one.
3. **Simulate the 6 questions** the app would generate (default Balanced = 4 behavioral + 1 role-specific + 1 curveball; or the arc override).
4. **Grade as a harsh expert interviewer for that exact field.** Return:
   - `VERDICT`: Ready | Partially ready | Not ready
   - `BROKEN`: Y only for a **category error** — the guidance fundamentally mismatches the real interview (wrong altitude, wrong interview type, wrong format). These are the priority.
   - `GAP`: the single biggest thing a real interview tests that this misses.
   - `FIX`: one concrete guidance (or arc/instruction) change.

Use a subagent (or several in parallel) to grade independently — an expert lens catches what the author cannot.

## Sweep mode (audit many verticals)

Fan out one expert agent per 3 verticals; have each read the guidance from the repo and grade its personas in the compact `VERDICT | BROKEN | GAP | FIX` format. Synthesize: fix all `BROKEN=Y` first, then group the `Partially ready` findings into cross-cutting themes (recurring patterns like "single role-specific slot under-samples technical verticals," "bundled sub-roles default to one," "role-specifics assume senior judgment for entry-level") rather than shipping 20 one-off edits.

## What "category error" vs "refinement" means

- **Category error (fix now):** the app is preparing the candidate for the WRONG interview. (Residency getting med-school-admissions questions; a networking chat getting a STAR mock.)
- **Refinement (batch or document):** right interview, minor gap. (A REIT analyst not being asked about FFO specifically.)

The app is a 6-question text tool: it cannot replicate a live interactive case, a live coding round, or a spoken role-play. Do not mark those format limits as `BROKEN` — they are structural (track them as roadmap items), not per-vertical bugs.
