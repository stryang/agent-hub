# Agent Hub

Agent Hub is a macOS arm64 desktop client for local coding agents. The first milestone targets Claude Code and uses Electron, React, TypeScript, and Node.

The app is a presentation and interaction shell. Claude Code remains responsible for agent behavior, model access, tool execution, permissions, and session persistence. Agent Hub provides the desktop UI, command setup, session sidebar, structured output parsing, tool cards, diff rendering, and Claude-themed interaction.

## Current Scope

- Electron desktop shell.
- Claude Code command-path setup.
- Claude Code session discovery and sidebar display.
- Structured Claude output rendered as assistant messages, read/edit/write/bash cards, diffs, raw output, and errors.
- UI based on the existing Agent Hub design.

Codex CLI, custom CLIs, plugins, auto-update, signing, and distribution are outside the first milestone.

## Design

The active product design is documented in:

- `docs/superpowers/specs/2026-06-11-agent-hub-claude-code-electron-design.md`

## Repository Notes

`agent-hub-export.html` is a local design export and is intentionally ignored by git.
