---
name: code_assist/code-review/detect
description: Stack detection sub-skill — classifies a repo as backend, frontend, tui, fullstack, or unknown
type: subskill
---

# Stack Detection

Classify the current repository into one or more of: `backend`, `frontend`, `tui`. Return a single token used by `ROUTER.md`.

---

## Signals

### Backend
- `pyproject.toml` / `requirements.txt` / `Pipfile` containing: `fastapi`, `django`, `flask`, `starlette`, `sanic`, `aiohttp`, `tornado`
- `package.json` deps containing: `express`, `fastify`, `nestjs`, `@nestjs/core`, `koa`, `hapi`, `hono`
- `go.mod` containing: `gin-gonic/gin`, `labstack/echo`, `gofiber/fiber`, `go-chi/chi`, `gorilla/mux`
- `Cargo.toml` containing: `axum`, `actix-web`, `rocket`, `warp`, `tide`
- `pom.xml` / `build.gradle` containing: `spring-boot`, `spring-web`, `quarkus`, `micronaut`
- Presence of any of: `migrations/`, `alembic.ini`, `prisma/schema.prisma`, `knexfile.*`, `db/schema.rb`
- `Dockerfile` with a server-style `CMD`/`ENTRYPOINT` (uvicorn, gunicorn, node server.js, etc.)

### Frontend
- `package.json` deps containing: `react`, `react-dom`, `vue`, `svelte`, `next`, `nuxt`, `@remix-run/`, `solid-js`, `astro`, `preact`, `qwik`
- Any file with extension: `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`
- Config files: `tailwind.config.*`, `vite.config.*`, `next.config.*`, `nuxt.config.*`, `svelte.config.*`, `astro.config.*`
- `public/index.html` or `index.html` at repo root with a SPA mount point

### TUI / CLI
- Go: imports of `github.com/charmbracelet/bubbletea`, `github.com/charmbracelet/lipgloss`, `github.com/gdamore/tcell`, `github.com/rivo/tview`
- Rust: `Cargo.toml` containing `ratatui`, `tui` (legacy), `crossterm`, `cursive`, `termion`
- Python: `pyproject.toml` / `requirements.txt` containing `textual`, `urwid`, `prompt_toolkit`, `blessed`, `py_cui`; or source imports of `rich.live.Live` / `rich.layout.Layout`
- JS/TS: `package.json` deps containing `ink`, `blessed`, `neo-blessed`, `terminal-kit`
- Strong hint: a `cmd/` directory with a CLI entrypoint AND **no** HTTP framework detected

---

## Detection Procedure

1. Run a fast sweep — prefer cheap checks first:
   ```bash
   ls -1 package.json pyproject.toml requirements.txt go.mod Cargo.toml pom.xml build.gradle 2>/dev/null
   ```
2. For each present manifest, read it (or `grep` for the framework names) to set boolean flags: `is_backend`, `is_frontend`, `is_tui`.
3. Cross-check with file-extension/config-file signals using `find . -maxdepth 4 -type f \( -name '*.tsx' -o -name '*.vue' -o -name 'tailwind.config.*' \) | head -1` and similar.
4. Collect the set of true flags.

---

## Output Contract

Return **exactly one line** to the router:

| Set of true flags | Returned token |
|---|---|
| `{backend}` | `backend` |
| `{frontend}` | `frontend` |
| `{tui}` | `tui` |
| `{backend, frontend}` | `fullstack:backend,frontend` |
| `{backend, tui}` | `fullstack:backend,tui` |
| `{frontend, tui}` | `fullstack:frontend,tui` |
| `{backend, frontend, tui}` | `fullstack:backend,frontend,tui` |
| `{}` | `unknown` |

When returning a multi-stack token, list the stacks alphabetically.

---

## Disambiguation

- A `package.json` with **both** `express` and `react` (common in Next.js API routes) counts as `fullstack:backend,frontend` only if there is also a server entrypoint file (e.g., `server.{ts,js}`, custom `api/` outside Next.js convention). A plain Next.js app counts as `frontend`.
- A Go CLI that happens to use `net/http` for outbound calls is still `tui` — backend requires a server framework or a routing layer.
- If unsure between two stacks, prefer the broader fullstack label and let the router run both.
