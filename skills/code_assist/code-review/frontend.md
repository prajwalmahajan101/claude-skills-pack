---
name: code_assist/code-review/frontend
description: Frontend-flavored weights and anti-patterns for code review (React, Vue, Svelte, Next, etc.)
type: variant
---

# Code Review — Frontend Variant

Use this weight table when reviewing a frontend / web UI codebase. Combine with `shared.md`.

---

## Weight Table

| Category | Weight |
|---|---|
| Component Architecture & Composition | 2.0 |
| State Management & Data Flow | 1.8 |
| Accessibility (a11y) | 1.8 |
| Type Safety & Prop Contracts | 1.6 |
| API Integration & Data Fetching | 1.5 |
| Rendering Performance | 1.5 |
| UX Consistency & Design System Adherence | 1.5 |
| Error Boundaries & User-Facing Error Handling | 1.5 |
| Security (XSS, CSRF, unsafe HTML, dep CVEs) | 1.5 |
| Styling Architecture | 1.3 |
| Bundle Size & Code Splitting | 1.3 |
| Routing & Navigation | 1.2 |
| Forms & Input Validation | 1.2 |
| Asset & Media Management | 1.0 |
| i18n / l10n Readiness | 1.0 |
| Documentation & Readability | 1.0 |
| Naming Quality | 1.0 |

---

## Anti-Pattern Checklist (Step 3)

Explicitly look for and call out:

- **Component design**: god components (>300 LOC), prop drilling past 3 levels, mixing presentation and data-fetching, conditional hooks, components that mutate parent state directly.
- **State management**: scattered local state that should be centralized, centralized state that should be local, derived state stored instead of computed, manual subscriptions duplicating framework reactivity.
- **Re-rendering**: missing `key` on lists, inline object/array/function props causing child re-renders, `useEffect` with missing or wrong deps, unmemoized expensive computations on hot paths, context providers that re-render the whole tree.
- **Type safety**: `any` escape hatches, unchecked optional props, prop types that diverge from API response types, missing discriminated unions for variant components.
- **Data fetching**: fetch-in-effect waterfalls, missing loading / error / empty states, duplicate requests across components, no cache invalidation strategy, ignored race conditions on rapid input.
- **Accessibility**: missing `alt` text, custom controls without `role` / `aria-*` / keyboard handlers, focus traps in modals broken, color-only state indication, headings skipping levels, form fields without labels.
- **Security**: `dangerouslySetInnerHTML` / `v-html` with untrusted input, `target="_blank"` without `rel="noopener"`, secrets in client bundles, eval-equivalents, outdated deps with known CVEs.
- **Styling**: CSS specificity wars, global selectors leaking into components, hard-coded colors/spacing bypassing design tokens, deep nesting in CSS-in-JS hurting bundle size.
- **Bundle**: synchronous import of heavy libs, no route-level code splitting, importing entire icon/lodash packs instead of single members.
- **Forms**: validation only on submit (no inline feedback), uncontrolled inputs mixed with controlled inputs, missing autocomplete attributes, inaccessible error messaging.
- **Routing**: route definitions duplicated, navigation logic scattered across components, missing 404 / loading boundaries.

Use this list as a checklist during Step 3 of `shared.md`.
