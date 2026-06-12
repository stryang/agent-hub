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

## UI Conventions

- Use agent theme tokens for agent-specific color. `--accent` is the current agent theme color.
- Claude Code uses orange theme color. Codex should use blue when Codex support is added.
- Text that represents the current agent or current model should use the current agent theme color token, not hard-coded provider colors.
- Use `lucide-react` for interface icons. Keep brand logos, such as Claude Code or Agent Hub marks, as brand assets instead of replacing them with lucide icons.

## Git Notes

- `agent-hub-export.html` is ignored intentionally.
- Keep `.claude/`, `.codex/`, and `.agents/` directories in git.
- Do not commit local runtime state, credentials, caches, or machine-specific files inside those directories.

## Validation

- After implementation, run:
  - `npm run lint`
  - `npm test`
  - `npm run dist:mac`
- After a successful mac build, close any running Agent Hub instance and reopen the latest packaged app:
  - `osascript -e 'tell application "Agent Hub" to quit' || true`
  - `pkill -x "Agent Hub" || true`
  - `open "release/mac-arm64/Agent Hub.app"`
