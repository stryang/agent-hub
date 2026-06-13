# AGENTS.md

Guidance for local agent tools working in this repository.

## Project

Agent Hub is a macOS arm64 Electron app that presents a polished UI for local agent CLIs. The first supported adapter is Claude Code.

## First Milestone

- Scaffold Electron + React + TypeScript + Vite.
- Port the current Agent Hub HTML design into components.
- Add Claude Code command validation.
- Load Claude Code history into the sidebar.
- Run Claude Code with structured output and render UI events.

## Boundaries

- Do not implement agent logic in the app.
- Do not replace Claude Code session storage.
- Do not add Codex CLI support before the Claude Code milestone is complete.
- Do not commit `agent-hub-export.html`.
- Keep `.claude/`, `.codex/`, and `.agents/` directories in git.
- Do not commit local runtime state, credentials, caches, or machine-specific files inside those directories.

## Quality Bar

- Keep main/preload/renderer responsibilities separate.
- Add tests around adapters, command validation, session indexing, and diff collection.
- Prefer explicit typed events over ad hoc parsing in UI components.

## UI Conventions

- Use agent theme tokens for agent-specific color. `--accent` is the current agent theme color.
- Claude Code uses orange theme color. Codex should use blue when Codex support is added.
- Text that represents the current agent or current model should use the current agent theme color token, not hard-coded provider colors.
- Use `lucide-react` for interface icons. Keep brand logos, such as Claude Code or Agent Hub marks, as brand assets instead of replacing them with lucide icons.

## Development Commands

- `npm install`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run dist:mac`

## Completion Workflow

- After implementation, run:
  - `npm run lint`
  - `npm test`
  - `npm run dist:mac`
- After a successful mac build, close any running Agent Hub instance and reopen the latest packaged app:
  - `osascript -e 'tell application "Agent Hub" to quit' || true`
  - `pkill -x "Agent Hub" || true`
  - `open "release/mac-arm64/Agent Hub.app"`

## Local Files

- `design/` and `tests/` are intentionally ignored; do not commit them.
- Use `design/` only as a visual reference and source of local UI assets.
