---
name: code_assist/code-review/tui
description: TUI/CLI-flavored weights and anti-patterns for code review (Bubble Tea, Ratatui, Textual, Ink, etc.)
type: variant
---

# Code Review — TUI / CLI Variant

Use this weight table when reviewing a terminal UI or interactive CLI app (Bubble Tea, Ratatui, Textual, Ink, blessed, etc.). Combine with `shared.md`.

---

## Weight Table

| Category | Weight |
|---|---|
| Event Loop & Input Handling | 2.0 |
| Screen State & View Composition | 1.8 |
| Keyboard Navigation & Shortcut Discoverability | 1.8 |
| Render Performance & Redraw Strategy | 1.6 |
| Terminal Compatibility (truecolor, sixel, fallbacks) | 1.5 |
| Resize & Layout Responsiveness | 1.5 |
| Error Handling & Crash Recovery (restore terminal state) | 1.5 |
| Concurrency & Cancellation (long-running ops, cancel keys) | 1.5 |
| Accessibility (screen reader hints, no-color mode, motion) | 1.3 |
| Theming & Color Architecture | 1.3 |
| Configuration & Environment Management | 1.2 |
| Logging Without Corrupting the UI | 1.2 |
| Extensibility & Plugin Surface | 1.2 |
| External Process / I/O Boundaries | 1.2 |
| Documentation & Readability | 1.0 |
| Naming Quality | 1.0 |

---

## Anti-Pattern Checklist (Step 3)

Explicitly look for and call out:

- **Event loop**: blocking I/O directly inside the update/render loop, synchronous network/disk calls without offloading to a goroutine / async task / worker, unbounded message queues.
- **Terminal state**: leaving the terminal in raw mode or the alternate screen on panic/exit, missing `defer`/`Drop`/`finally` to restore state, `os.Exit` paths that skip cleanup, no `SIGINT`/`SIGTERM` handler that disarms the renderer.
- **Stdout discipline**: `println!` / `fmt.Println` / `console.log` while the alternate screen is active, log output corrupting the rendered frame, missing dedicated log file or sidecar pane.
- **Rendering**: redraw-everything-every-tick instead of diffed updates, hardcoded ANSI escape sequences instead of using the framework renderer, magic cursor positioning, layout math duplicated across views.
- **Input**: magic key codes scattered across files instead of a central keymap, no help/`?` overlay listing shortcuts, no support for both vim-style and arrow navigation where users expect both, modifier-key combos that conflict with the terminal emulator.
- **Resize**: fixed widths / heights that overflow on narrow terminals, panels that don't reflow on `SIGWINCH`, content cut off without indication.
- **Color / theme**: no `NO_COLOR` env support, hardcoded 24-bit color without 256/16-color fallback, color-only state indication (bad for monochrome / color-blind users), themes baked into widgets instead of injected.
- **Concurrency**: long-running operations with no progress indicator, no cancel key (`q` / `Esc` / `Ctrl+C`) that actually aborts the work, race conditions between background task completion and view transitions.
- **External I/O**: shelling out without input sanitization, streaming subprocess output that floods the renderer, missing timeouts on external calls.
- **Extensibility**: views/screens hardcoded into a switch statement instead of registered, no plugin/extension surface, custom widgets that duplicate framework primitives.

Use this list as a checklist during Step 3 of `shared.md`.
