---
name: product-product-brainstorming
description: Structured sparring session for Runback question-quality, UX, or feature ideas — diverge then converge, score each idea by impact vs effort vs whether it needs schema/infra, and tie everything back to the real goal (does this help a candidate actually land the interview). Use for "let's brainstorm", "what should we build", "spitball ideas for X", or when an idea needs pressure-testing before it becomes a spec.
---

# Runback brainstorming

A sparring partner, not a yes-man. Push back, surface tradeoffs, and always end pointed at one next action. The north star: **does this measurably help a candidate walk into the real interview more prepared?** Ideas that don't ladder to that are interesting, not important.

## Procedure

1. **Frame the goal.** Restate what we're trying to improve in one line (e.g. "curveballs feel generic", "candidates bounce before finishing 6 questions"). Anchor divergence to it.

2. **Diverge — go wide first, no judging.** Generate 6-10 raw ideas. Mix cheap prompt/guidance tweaks with bigger bets. Explicitly include at least one idea from each lane:
   - **Question quality / prompt** (Caroline's lane): sharper firm calibration, better curveball relevance, difficulty-tier tuning, question-focus modes, rubric-anchoring, the quality gate.
   - **Realism** (the biggest gap): multi-turn adaptive follow-ups — the #1 realism gap; voice/verbal mode (there's already `lib/fillerWords.ts` to build on).
   - **Stateful / infra** (Josh's lane, needs auth+schema): prep-plans, saved progress, weak-spot tracking across sessions — mostly blocked until login/memory land.
   - **Reach**: the B2B / university angle (target-school + program verticals across the 47 verticals), the continuous question-quality regression harness.

3. **Converge — score each surviving idea** on three axes. Be honest, not generous:

   | Idea | Impact (lands-the-interview) | Effort | Needs schema/infra? |
   |------|------------------------------|--------|---------------------|
   | ...  | H/M/L                        | S/M/L  | none / prompt-only / **Josh sign-off** |

   - **Prompt-only, high-impact** ideas are the win condition — they ship this week with no schema risk. Flag them first.
   - Anything marked "needs schema/infra" is gated on Josh and probably blocked on auth/memory landing — say so; don't pretend it's a quick win.
   - Kill or park ideas that are clever but don't move the land-the-interview needle.

4. **Converge to one.** Pick the single highest impact-per-effort idea that isn't infra-blocked. State it plus a runner-up.

5. **Hand off.** Turn the winner into a `product-write-spec` one-pager. Brainstorm output should end with: "Next: spec <idea>."

## Guardrails
- Don't propose a new `question_type` value as if it's free — the enum is `behavioral | role-specific | curveball` and anything else needs a migration + Josh. New categories map into the existing three.
- Don't invent a new prompt-management abstraction; question ideas live as edits to the existing route template strings.
- Cheap and shippable beats grand and blocked. When two ideas tie on impact, the one with no schema flag wins.
