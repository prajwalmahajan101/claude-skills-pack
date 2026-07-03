---
name: code_assist/domains/frontend
description: Condensed frontend/UI/UX playbook - anti-slop design direction, layout, type, motion, and the pre-flight quality bar. Self-contained.
type: skill
---

# Domain - Frontend / UI / UX

## Direction first (avoid templated "AI slop")
- Read the brief; infer the right design direction (editorial, minimalist, brutalist,
  premium, playful) before coding. Commit to one and make it intentional.
- Real design system: a small set of tokens (type scale, spacing scale, 1-2 accent colors,
  radius, shadow) applied consistently - not ad-hoc values per component.

## Layout & type
- Strong typographic contrast (size/weight), generous whitespace, an intentional grid
  (asymmetry and bento layouts beat centered-card monotony).
- A clean, spacious, readable hero - visible on a small laptop; no cards-inside-cards.

## Color & surface
- Restrained palette; avoid default gradients + heavy drop shadows unless the direction calls
  for them. Prefer subtle depth (borders, tint, soft shadow) over glow.

## Motion
- Purposeful micro-interactions and perpetual, subtle motion; hardware-accelerated
  transforms/opacity. Motion supports hierarchy, never distracts.

## Pre-flight quality bar (before "done")
- Responsive at small + large widths; keyboard focus + a11y contrast; no layout shift;
  images sized; empty/loading/error states handled. Verify by running the app (`/code_assist:verify`).

## Deeper references (optional, if installed)
`frontend-design`, `taste-skill`, `soft-skill`, `minimalist-skill`, `brutalist-skill`,
`redesign-skill`, `image-to-code-skill`, `brandkit`. For animation/3D see `domains/animation-3d.md`.
