---
name: design-design-system
description: Keep Runback's components, brand tokens, and Tailwind conventions consistent as verticals and the school-admissions flow grow. Use when adding or editing UI on the intake, interview, or results pages, introducing a new field/card/button, or when you catch yourself about to hardcode a color or hand-roll a control that already exists.
---

# Runback design system

Runback styles with **Tailwind CSS 4 utility classes inline in JSX** — no CSS modules, no styled-components. Brand tokens live in `app/globals.css` under `@theme`. Reuse before you reinvent.

## Brand tokens (from `app/globals.css @theme`)
Reference these as Tailwind classes (`bg-brand`, `text-ink-muted`, `border-line`) — never hardcode a hex that already has a token.
- `--color-brand` `#FF5A1F` (Sprint Orange, primary/actions) + `--color-brand-hover` `#E64A12`
- `--color-volt` `#D9FF3F` (scores/wins) — reserve for positive/score emphasis, not generic accents
- `--color-cream` / `--color-ink` `#F5F1E8` (primary text), `--color-ink-muted` `#b8b0a2` (labels/secondary)
- Surfaces: `--color-surface` (cards), `--color-surface-input` (fields), `--color-surface-inset` (nested panels)
- Lines: `--color-line`, `--color-line-hover`
- Fonts: body `--font-inter`; display/wordmark via `.font-display` (`--font-archivo`)

## Procedure
1. **Search for an existing pattern first.** Grep `app/page.tsx` (and any component files) for the closest existing element before writing new markup. The canonical form controls, buttons, cards, and the select-with-chevron pattern already exist there.
2. **Copy the established class recipe.** Reuse the exact utility strings rather than approximating. The house recipes are:
   - Input/select field: `w-full bg-surface-input border border-white/[0.12] rounded-md px-3 py-2.5 text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors`
   - Field label: `block text-[13px] font-semibold text-ink-muted mb-1.5` (add `tracking-tight` where siblings do); required marker `<span className="text-red-500">*</span>`
   - Card surface: `bg-surface border border-line rounded-2xl p-5`
   - Custom `<select>`: `appearance-none ... pr-10` plus the absolutely-positioned chevron SVG — don't build a new dropdown.
3. **Match the surface hierarchy.** Cards on `surface`, fields on `surface-input`, nested panels on `surface-inset`. Don't invent an intermediate shade.
4. **Respect motion tone.** Entrances are opacity-only (`.animate-fade-in`, 0.18s). No slides/bounces — keep the "quiet entrance" feel.
5. **Consistency across the 3 pages.** Intake, interview, and results should share the same field, button, and card vocabulary. If results needs a new element, factor the shared version rather than forking a one-off style.
6. **New verticals = data, not new UI.** Adding to `INTERVIEW_TYPES` or `SCHOOL_VERTICALS` should not require new components — the intake form already renders any option. Only touch layout if the field set genuinely changes.
7. **Mobile-first.** Reuse the responsive pattern already in the file (`grid-cols-1 sm:grid-cols-2`, `mx-auto lg:mx-0`). Check the breakpoints a file already uses before adding your own.

For net-new visual/aesthetic direction (a brand-new surface with no precedent), use the built-in `frontend-design` skill — then fold the result back into these tokens and recipes.
