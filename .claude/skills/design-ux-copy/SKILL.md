---
name: design-ux-copy
description: Write and review Runback's microcopy — dropdown labels, the Company/Role vs Target School/Program relabel, button/empty/error/loading states, and the warm-but-honest coach tone. Use when adding or changing any user-facing string on the intake, interview, or results pages.
---

# Runback UX copy

Runback is an AI mock-interview coach. The voice is a **good coach: warm, direct, honest**. Encouraging without flattery; specific over generic; never corporate-stiff, never hype.

## Tone rules
- Warm but honest — praise what earned it, name what didn't. No participation-trophy language on scores.
- Second person, active voice, contractions ("you'll", "let's"). Short sentences.
- Scannable and mobile-friendly: most users read on a phone. Prefer a 3–6 word label over a sentence; a sentence over a paragraph.
- Plain words over jargon. Say "your answer," not "your response artifact."

## The relabel (most copy-sensitive spot)
`app/page.tsx` swaps the Company/Role fields for school-admissions verticals via `isSchoolVertical` (`SCHOOL_VERTICALS`). Both label AND placeholder must switch together and stay parallel:
- Job: label "Company" / "Role", placeholder "e.g. Google" / "e.g. Software Engineer"
- School: label "Target School" / "Program / Degree", placeholder "e.g. Johns Hopkins" / "e.g. MD Program"
When editing either side, edit its twin. Any downstream copy that says "company" or "role" (buttons, results, emails) must also read correctly for a school applicant — audit both branches before shipping.

## State copy checklist
- **Buttons:** verb-first, outcome-oriented ("Start interview", "Score my answers"), not "Submit". Give a distinct in-progress label ("Generating your questions…").
- **Loading:** say what's happening and that it's worth the wait — question generation and evaluation call Claude and take real seconds. "Building your 6 questions…", not a bare spinner.
- **Empty:** point to the next action ("No sessions yet — start your first mock interview").
- **Error:** plain-language cause + recoverable next step, never a raw stack/HTTP code. "We couldn't read that PDF. Try another file or skip the resume." Keep the user's entered data.
- **Optional vs required:** mark required fields with the existing `*`; label optional ones "(optional)" like Resume already does.

## Procedure
1. Identify every state the string covers (default, loading, success, empty, error).
2. Draft in the coach voice; read it aloud — if it sounds like a form, rewrite.
3. If the string touches Company/Role, verify it in BOTH the job and school branches.
4. Check length on a narrow (mobile) width — no wrapping that breaks a label mid-phrase.
5. Keep terminology consistent with what's already on screen (don't call it "session" here and "interview" there).
