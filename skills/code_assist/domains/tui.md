---
name: code_assist/domains/tui
description: Condensed terminal-UI playbook - library choice, layout, and interaction for TUIs and CLI tools. Self-contained.
type: skill
---

# Domain - TUI / CLI

## Library choice
- **Go**: Bubble Tea (+ Lipgloss for style, Bubbles for widgets) - the Elm-style model.
- **Rust**: Ratatui (+ Crossterm) - immediate-mode, explicit draw loop.
- **Python**: Textual (rich, app-like) or Rich (styled output); prompt_toolkit for REPLs.
- **JS/TS**: Ink (React for the terminal).
- Simple command-line utility? A plain arg-parser + styled output beats a full TUI framework.

## Layout & design
- Design for 80x24 up; reflow on resize. Clear visual hierarchy with spacing, a restrained
  palette, and consistent key hints. One primary action per view.
- Respect `NO_COLOR`; degrade gracefully without truecolor/unicode; keep latency imperceptible.

## Interaction
- Discoverable keybindings (show them); consistent nav (arrows/hjkl), quit, help.
- Non-blocking work off the render loop; show progress; never freeze the UI.
- Handle terminal resize, Ctrl-C, and restore the terminal state on exit.

## Reference apps
lazygit, k9s, btop, helix, yazi - study their layout and key models.

## Deeper reference (optional, if installed)
`tui-design`.
