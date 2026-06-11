# CLAUDE.md

This repository is for Agent Hub, an Electron desktop client for local coding agents.

## Product Direction

- First milestone supports Claude Code only.
- Agent Hub is a shell and renderer, not an LLM or agent implementation.
- Claude Code owns model calls, tools, permissions, and session persistence.
- Agent Hub owns desktop UI, command setup, structured output parsing, session indexing, and rendering.

## Implementation Constraints

- Follow the design in `docs/superpowers/specs/2026-06-11-agent-hub-claude-code-electron-design.md`.
- Preserve the visual direction from `agent-hub-export.html`, but do not commit that export file.
- Keep renderer code separate from Node APIs; use preload IPC boundaries.
- Prefer typed shared event models between Electron main, preload, and renderer.
- Degrade unknown Claude output to raw output instead of dropping it.

## Git Notes

- `agent-hub-export.html` is ignored intentionally.
- Do not commit local runtime content under `.claude/`, `.codex/`, or `.agents/` except `.gitkeep`.
