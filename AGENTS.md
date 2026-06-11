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
- Do not commit local agent state from `.claude/`, `.codex/`, or `.agents/`.

## Quality Bar

- Keep main/preload/renderer responsibilities separate.
- Add tests around adapters, command validation, session indexing, and diff collection.
- Prefer explicit typed events over ad hoc parsing in UI components.
