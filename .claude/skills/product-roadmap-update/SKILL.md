---
name: product-roadmap-update
description: Maintain Runback's Now / Next / Later roadmap as Josh (auth/infra) and Caroline (question quality) run parallel workstreams — keep it honest about what's pure prompt/guidance work vs what needs Supabase schema sign-off or waits on auth landing. Use for "update the roadmap", "what's the status", "reprioritize", or after shipping/scoping something.
---

# Runback roadmap update

A living Now / Next / Later view. Its job is to keep two parallel founders honest about sequencing and about what's actually blocked. Not a Gantt chart — a shared source of truth that fits on one screen.

## Procedure

1. **Read the current roadmap** if one exists (check the repo / shared doc). Don't rewrite from scratch — reconcile against reality.

2. **Bucket every item into exactly one of three:**
   - **Now** — actively being built this cycle. Cap it: ~1-2 per founder, no more. If it's not moving, it's not Now.
   - **Next** — scoped and unblocked, picked up when a Now slot frees.
   - **Later** — real but not yet scoped, or blocked on a dependency.

3. **Tag each item by lane and gate** so the honesty is visible at a glance:
   - Lane: **[Q]** question-quality/prompt (Caroline) or **[I]** auth/infra (Josh).
   - Gate: **prompt-only** (ships via branch→PR, no schema) or **schema/sign-off** (needs Josh + a migration; migrations are out-of-band, never silent) or **blocked: auth** (waits on login/memory landing).

4. **Apply the sequencing rules honestly:**
   - Prompt-only [Q] work is never blocked by infra — it can always be in Now regardless of what Josh is doing.
   - Anything stateful (prep-plans, saved progress, weak-spot tracking) is **blocked: auth** until login + memory land — it stays in Later with that gate shown, not optimistically promoted to Next.
   - Anything touching `question_type`, the Supabase tables, or `evaluate*` routes carries **schema/sign-off** and can't enter Now without Josh's go-ahead recorded.

5. **Write it out** in the shape below and note what changed (moved, shipped, newly blocked) since last update.

## Shape

```
# Runback Roadmap — <date>

## Now
- [Q] Multi-turn adaptive follow-ups (prompt-only) — #1 realism gap, Caroline
- [I] Login + accounts + memory (schema/sign-off) — Josh

## Next
- [Q] Curveball relevance tuning + firm calibration pass (prompt-only)
- [Q] Continuous question-quality regression harness (prompt-only)
- [Q] Voice/verbal mode — build on lib/fillerWords.ts (prompt-only; UI)

## Later
- [I] Stateful progress + prep-plans (blocked: auth)
- [I] Weak-spot tracking across sessions (blocked: auth)
- [Q/I] B2B / university angle — school+program verticals (needs scoping)

Changed since last: <what moved/shipped/newly blocked>
```

## Guardrails
- Keep it honest: a nice-sounding item that's blocked on auth goes in Later with the gate shown — don't park it in Next to look busy.
- Every schema/sign-off item names Josh explicitly; there are no silent schema changes on this roadmap.
- If an item can't be tagged prompt-only vs schema, it isn't scoped enough to be Now or Next — leave it Later until `product-write-spec` sorts it.
