# Agent Hub Claude Code Electron Design

Date: 2026-06-11

## Summary

Agent Hub is a macOS arm64 desktop client for locally installed coding agents. The first version supports Claude Code only. The app is a desktop interaction and presentation shell: Claude Code remains responsible for agent behavior, model access, context, tools, permissions, and session persistence. Agent Hub manages the desktop UI, theme, command configuration, process execution, structured output parsing, and friendly rendering of tool activity.

The UI must follow the existing `agent-hub-export.html` design: a left project/session sidebar, Claude Code selector, top path/status bar, chat thread with user/assistant messages, tool cards for file reads/edits/commands, diff rendering, and bottom composer/status chips.

## Goals

- Build a macOS arm64 Electron app using React, TypeScript, Vite, and Node.
- Let the user add Claude Code by specifying the local `claude` command path.
- Validate that the command exists, is executable, reports a version, and is authenticated.
- Load Claude Code historical sessions into the left sidebar after Claude Code is added.
- Let the user select a session and continue it through Claude Code's native resume/session mechanism.
- Run Claude Code in structured output mode and map its stream into UI events.
- Render assistant messages, read/edit/write/bash tool cards, diffs, raw output, errors, and run status.
- Preserve Claude Code as the source of truth for agent sessions and behavior.
- Save only UI configuration, command path, recently selected session, and local rendering cache.

## Non-Goals

- Supporting Codex CLI, Gemini CLI, or custom CLIs in the first version.
- Implementing an LLM or agent loop inside Agent Hub.
- Replacing Claude Code's session storage.
- Owning permission policy decisions that Claude Code already handles.
- Building plugins, multi-agent orchestration, or a marketplace.
- Implementing production signing, notarization, auto-update, or distribution workflows in the first milestone.

## Technology Stack

- Desktop shell: Electron
- UI: React, TypeScript, Vite
- Main process: Node.js
- Process execution: `child_process` for structured Claude Code print mode; `node-pty` can be added later for interactive fallback.
- State: lightweight renderer store such as Zustand or Jotai.
- Local app config: JSON file in Electron `userData`; SQLite can be added later if query needs grow.
- Diff rendering: local parser for unified diff plus CSS matching the existing HTML.

Electron is preferred for the first version because the current design is already HTML/CSS, Node process control is direct, and Claude Code integration will require streaming JSON parsing, filesystem reads, and child process management.

## Architecture

```txt
src/
  main/
    index.ts
    ipc/
      claude-ipc.ts
      config-ipc.ts
    services/
      claude-code-adapter.ts
      claude-session-service.ts
      command-validator.ts
      git-diff-service.ts
      app-config-store.ts

  preload/
    index.ts

  renderer/
    App.tsx
    components/
      Sidebar.tsx
      CliSelector.tsx
      Thread.tsx
      ToolCard.tsx
      DiffViewer.tsx
      Composer.tsx
      StatusBar.tsx
      SettingsDialog.tsx
    state/
      agent-store.ts
      config-store.ts
    styles/
      theme.css
      app.css

  shared/
    types/
      agent-events.ts
      claude-config.ts
      sessions.ts
```

The renderer never calls Node APIs directly. The preload layer exposes a small typed API on `window.agentHub`. The main process owns filesystem access, command validation, Claude Code process execution, session indexing, and git diff collection.

## Claude Code Setup

The settings flow asks the user to select or enter a Claude Code command path, for example:

- `/opt/homebrew/bin/claude`
- `/usr/local/bin/claude`
- `~/.local/bin/claude`

Validation checks:

- The path exists.
- The path is executable.
- `claude --version` completes successfully.
- `claude auth status` reports an authenticated state.
- The installed version supports the structured output options required by this app.

If validation fails, the settings dialog shows the exact failed check and keeps the app in an unconfigured state. If validation succeeds, the app saves the command path and immediately refreshes the Claude Code session index.

## Session Loading

Agent Hub does not own Claude Code conversation state. It builds a read-only UI index over Claude Code's native sessions.

Session discovery should use the most stable source available in this order:

1. A public Claude Agent SDK session listing API, if available and stable in the installed version.
2. Claude Code's documented transcript files at `~/.claude/projects/<project>/<session-id>.jsonl`, or the equivalent location under `CLAUDE_CONFIG_DIR`.

The second path is acceptable because Claude Code documents these JSONL transcript files as the place where session data is stored and exported. Agent Hub only reads them to build a sidebar index.

Sidebar grouping:

- Group sessions by project working directory.
- Sort projects by most recent session activity.
- Sort sessions within each project by most recent activity.
- Title priority: explicit session name, summary, first prompt, then `Untitled Session`.
- Show branch and message count where available.

When a user selects a session, the right thread loads a preview from the transcript. When the user sends a new prompt, Agent Hub resumes through Claude Code with the selected session ID or name. Sessions created in print mode may not appear in Claude Code's interactive picker, so Agent Hub should keep the session IDs it observes from structured output.

## Runtime Data Flow

```txt
User prompt
  -> React Composer
  -> preload IPC API
  -> main ClaudeCodeAdapter
  -> local claude command
  -> stream-json stdout
  -> adapter parser
  -> AgentUiEvent
  -> renderer store
  -> Thread / ToolCard / DiffViewer / StatusBar
```

The first version runs Claude Code in print mode with structured streaming output:

```bash
claude -p "<prompt>" --output-format stream-json --verbose
```

When continuing a session, the adapter adds the appropriate Claude Code resume/session flag:

```bash
claude -p "<prompt>" --output-format stream-json --verbose --resume "<session-id-or-name>"
```

or:

```bash
claude -p "<prompt>" --output-format stream-json --verbose --session-id "<uuid>"
```

The exact resume form is selected during implementation against the installed Claude Code version. The adapter must capture any returned session ID and update the local UI index.

## UI Event Model

The renderer consumes a CLI-agnostic event model even though the first adapter is Claude Code only.

```ts
type AgentUiEvent =
  | { type: "user_message"; text: string; timestamp: number }
  | { type: "assistant_message"; text: string; partial?: boolean; timestamp: number }
  | {
      type: "tool_start";
      tool: "read" | "edit" | "write" | "bash" | "unknown";
      target?: string;
      command?: string;
      timestamp: number;
    }
  | { type: "tool_output"; text: string; timestamp: number }
  | { type: "tool_done"; status: "success" | "failed" | "cancelled"; timestamp: number }
  | { type: "diff"; filePath: string; unifiedDiff: string; timestamp: number }
  | { type: "permission_prompt"; text: string; choices?: string[]; timestamp: number }
  | { type: "raw_output"; text: string; timestamp: number }
  | { type: "error"; message: string; detail?: string; timestamp: number };
```

ClaudeCodeAdapter maps Claude stream events into these UI events. If an event cannot be parsed confidently, it emits `raw_output` instead of dropping content or breaking the thread.

## Tool Cards and Diff Rendering

The UI follows the current HTML design:

- `read` renders as a file read card with target path and completion status.
- `edit` and `write` render as file modification cards.
- `bash` renders as a command card with command text and output.
- `diff` renders as a dark unified diff block with added and removed rows.
- `raw_output` renders as a plain terminal-style block.
- `error` renders as an inline error card in the thread.

Diff generation should not depend only on Claude's prose. When the adapter detects a file modification, `git-diff-service` tries to collect `git diff -- <file>`. If the project is not a git repository, the file is untracked, or diff collection fails, the edit card still renders without a diff and shows a small "diff unavailable" status.

## Theme and Visual Behavior

Claude Code is the only enabled CLI in the first version. The app uses the existing Claude orange theme:

- Accent: `#D97757`
- Accent dim: `#fff1eb`
- Accent text: `#8b3d24`

The UI keeps the existing Agent Hub layout and density. CLI selector, pill, agent label, status chips, focus ring, context meter, and tool accents all derive from the active CLI theme. Other CLI options can be hidden or shown as disabled placeholders, but they should not imply support until their adapters exist.

## Permissions

Agent Hub does not decide whether Claude Code may read, edit, or run commands. Claude Code remains responsible for permission behavior.

First-version handling:

- Use Claude Code's normal configured permission mode.
- Surface permission-related structured output as `permission_prompt` or `error` where available.
- Do not implement custom MCP permission prompt tooling in the first milestone.
- If Claude Code blocks on a permission mode that cannot be handled in print mode, show an actionable error explaining that the user should adjust Claude Code permissions or run the task in a compatible mode.

## Error Handling

The app must expose clear UI states for:

- Claude command path missing.
- Claude command path not executable.
- Claude Code not authenticated.
- Unsupported or unknown Claude Code version.
- Claude process exits non-zero.
- Structured JSON parse failure.
- Session transcript read failure.
- Session resume failure.
- User cancellation.
- Git diff unavailable.

Structured parse failures degrade to `raw_output`. Process failures add an `error` event to the thread and set the status bar to failed. Cancellation sends an interrupt/termination signal to the child process and marks the active tool as cancelled.

## Local Persistence

Agent Hub stores only UI and integration metadata:

- Claude command path.
- Active theme.
- Last selected project.
- Last selected session ID or name.
- Recently loaded session index cache.
- Window size and layout preferences.

Claude Code remains the source of truth for conversation history. Agent Hub's cache is disposable and can be rebuilt from Claude Code sessions.

## Testing

Automated tests should focus on the high-risk boundaries:

- `command-validator`: path checks, version check, auth status parsing.
- `claude-code-adapter`: stream-json fixtures map to the expected UI events.
- `claude-session-service`: transcript/session fixtures group, sort, and title correctly.
- `git-diff-service`: git repo, non-git directory, modified tracked file, and untracked file behavior.
- Renderer smoke tests: thread renders user messages, assistant messages, tool cards, diffs, raw output, and errors.

Manual acceptance for the first milestone:

1. Add a local `claude` command path.
2. See successful validation and Claude orange theme.
3. See historical Claude Code sessions in the left sidebar.
4. Select a session and load its preview.
5. Send a prompt asking Claude to read a file and see a read tool card.
6. Send a prompt asking Claude to run a simple command and see a bash card.
7. Send a prompt asking Claude to make a small file edit and see an edit card plus diff when available.
8. Stop a running task and see cancellation reflected in the thread/status bar.

## Implementation Milestones

1. Scaffold Electron, React, TypeScript, and Vite.
2. Port `agent-hub-export.html` into componentized React and CSS.
3. Add secure preload IPC API.
4. Implement app config store and Claude command setup dialog.
5. Implement command validation.
6. Implement session indexing and sidebar population.
7. Implement Claude Code adapter with structured output parsing.
8. Implement UI event store and thread rendering.
9. Implement tool cards, diff viewer, and raw output fallback.
10. Add tests and manual acceptance checks.

## Sources Checked

- Claude Code CLI reference: `--print`, `--output-format stream-json`, `--verbose`, `--resume`, `--session-id`, and permission-related flags.
- Claude Code session documentation: local sessions, resume behavior, picker behavior, and documented JSONL transcript storage.
- Claude Agent SDK documentation and repository: SDK purpose and session-management guidance.
