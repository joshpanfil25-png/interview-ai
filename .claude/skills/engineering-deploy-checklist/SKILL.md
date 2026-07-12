---
name: engineering-deploy-checklist
description: Invoke before shipping any Runback (interview-ai) change and to confirm a deploy actually went live. Encodes the branch → PR → approve → merge → Vercel auto-deploy flow and how to verify the running deploy on runback.app — since merge to main ships straight to prod with no manual deploy step.
---

# Runback Deploy Checklist

There is NO manual deploy step: merging to `main` triggers Vercel to auto-deploy to prod (`runback.app`) ~2 minutes later. So "merge" == "ship." Never push to `main` directly.

## Pre-merge (the /ship gate)
1. `npx tsc --noEmit` — must be clean.
2. `npm run lint` — no *new* errors vs `main` (pre-existing `any` warnings are fine; don't fix unrelated ones).
3. `npm run dev`, click the real flow end to end, and **test on a phone** — most users are mobile.
4. `git diff` — read every line; confirm nothing unrelated snuck in and no secrets / `.env.local` values leak.
5. Confirm no schema change, no unapproved `evaluate*` edit, and every `question_type` stays `behavioral|role-specific|curveball`. If any are present, they need Josh's sign-off before this proceeds.
6. Descriptive commit message (what + why).
7. Branch is name-namespaced (`caroline/…`, `josh/…`).

## Merge flow
8. Open a PR from your branch. Get **Josh or Cooper** to approve. Merge only after approval — never a direct push to `main`.

## Verify it actually went live
9. Wait ~2 min after merge, then check Vercel: the deployment for that commit shows **Ready** (not Building/Error) and is the **current production** deployment. Match the commit SHA.
10. Hit `https://runback.app` and smoke-test the changed path in a real browser (and on mobile). Don't trust "merged" as "shipped" — confirm the new behavior is present in prod.
11. Check Vercel runtime logs for new errors on the affected `app/api/*/route.ts`.
12. If the deploy failed or the change isn't live, read the Vercel build logs for that deployment; do not re-merge blindly.

## If it's broken in prod
13. Revert the merge commit via a new PR (fastest safe rollback → Vercel redeploys the prior good commit). Don't hand-edit `main`.
