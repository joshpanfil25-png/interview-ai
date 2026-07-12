---
name: engineering-system-design
description: Invoke when designing a new Runback (interview-ai) feature or reworking a flow — a new interview vertical, a new intake branch, memory/history, or anything that adds data. Grounds the design in the sessions/questions/answers model, the school-vs-job intake split, and the founder-owned constraints.
---

# Runback System Design

Before proposing a design, fit it to what already exists. Runback's whole surface is: intake → 6 generated questions → answers → scored feedback, on `sessions`/`questions`/`answers`. Constraints below are hard.

1. **Start from the data model.** `sessions` (company, role, linkedin_url) → `questions` (question_text, `question_type` ∈ `behavioral|role-specific|curveball`, order_index) → `answers` (unique per session+question). If your feature needs new persisted data, that's a schema change — stop and get Josh's sign-off *before* designing around it, and expect it to be the long pole.
2. **Respect the intake split.** `app/page.tsx` `INTERVIEW_TYPES` distinguishes job interviews (company/role) from admissions verticals (target school/program). A new vertical must slot into this branching and still produce exactly 6 questions whose types stay within the three allowed values. Design new question categories as mappings onto `behavioral|role-specific|curveball`, not new enum values.
3. **Question generation is prompt-shaped, not code-shaped.** Steering (`verticalGuidance`, `COMPANY_CALIBRATION`, `arcOverrides`) lives as inline template strings in `generate-questions/route.ts`. Design new interviewer behavior as prompt structure there, not a new service or prompt framework.
4. **One route per concern.** New capability = new `app/api/*/route.ts`, not extra branches bolted onto an existing handler. Keep the Supabase client request-scoped.
5. **Scoring is off-limits by default.** Anything touching `evaluate`/`evaluate-single` (Josh's) needs explicit sign-off. Design feedback features to *consume* scoring output rather than modify the scoring path.
6. **Design for stateless serverless.** Handlers run per-request on Vercel; `sessionId` (client uuid + localStorage) is the continuity key. Don't assume in-memory state between requests.
7. **Plan for auth + memory.** These are coming and change assumptions (RLS is allow-all today; users are anonymous). Design new tables/flows so they're keyed in a way a future `user_id` can attach cleanly, and mind the auth-callback redirect-origin trap.
8. **Cost/latency of model choice.** Opus for generation + full eval (quality), Haiku for per-answer feedback (speed/cost). Pick deliberately for any new AI step and justify it.
9. **Deliverable:** restate the task in one sentence, list every file that changes and why, flag any schema/`evaluate*`/`question_type` touch for go-ahead, then a step-by-step plan — get approval before coding (the `/plan` contract).
