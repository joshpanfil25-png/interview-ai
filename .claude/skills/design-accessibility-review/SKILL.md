---
name: design-accessibility-review
description: Pragmatic WCAG pass on Runback UI before shipping — form-control labels/aria, color contrast against the brand tokens, keyboard nav, focus states, and reduced motion. Use before opening a PR that adds or changes any interactive UI (intake form, interview, results).
---

# Runback accessibility review

A fast, real-world WCAG 2.1 AA pass — concrete checks, not the whole spec. Runback's UI is a dark, warm-toned form-heavy app; the intake form is the highest-risk surface.

## Form controls (`app/page.tsx`)
- **Every `<select>`/`<input>` needs a programmatic name.** The visual `<label>` elements are currently not tied to their controls. Prefer `<label htmlFor>` + matching `id`, or an `aria-label` on the control. Check the Interview Type, Question Focus, Difficulty selects and the First Name/Email/Company/Role inputs.
- **File upload drop zone is a clickable `<div>`.** It's not keyboard-reachable. Add `role="button"`, `tabIndex={0}`, an `aria-label` ("Upload resume PDF"), and Enter/Space handlers — or trigger the real hidden `<input type="file">` (it already exists) so keyboard users can browse.
- **Required fields:** the `*` is visual only. Add `aria-required="true"` (or rely on the native `required` already present on some inputs) so it's announced.
- **The relabel:** when `isSchoolVertical` swaps Company→Target School, the accessible name must swap too. If you use `aria-label`, make it conditional on `isSchoolVertical`, not hardcoded.

## Color contrast (brand tokens)
Verify against `app/globals.css` values on the actual dark surfaces:
- Body text `--color-ink` `#F5F1E8` on `--color-surface` `#1a1712` — passes; keep it for anything you must read.
- `--color-ink-muted` `#b8b0a2` on surfaces — OK for labels but borderline; do NOT use it for small critical text or on `--color-brand`.
- **Brand orange `#FF5A1F` and volt `#D9FF3F` do NOT pass as text colors** for body/small text on dark surfaces at 4.5:1 — use them for fills, borders, icons, and large/bold display only, with `--color-blacktop` `#121212` text on top of a volt or orange fill.
- Never signal state by color alone (e.g. required, error) — pair with text/icon.

## Keyboard & focus
- Tab through the whole flow: every control reachable, logical order, nothing trapped.
- **Visible focus.** Controls use `focus:outline-none` then a `focus:ring-1 focus:ring-brand/30 focus:border-brand`. Confirm that ring is actually visible on every interactive element (the drop zone currently has none). Never leave `focus:outline-none` without a replacement indicator.
- Custom chevron `<select>` still uses a native element — good, keep it keyboard-native; don't replace with a div-based dropdown.

## Motion
- Entrances are opacity-only (`.animate-fade-in`, 0.18s) — already gentle. If you add any movement, wrap it in `@media (prefers-reduced-motion: reduce)` and provide a no-motion fallback.

## Procedure
1. Run the four sections above against the diff (controls, contrast, keyboard/focus, motion).
2. Actually tab through the changed screen with the mouse unplugged.
3. Spot-check contrast on any new color pairing with a checker; confirm token choice matches the rules above.
4. Note anything unfixable-in-scope in the PR description rather than silently shipping it.
