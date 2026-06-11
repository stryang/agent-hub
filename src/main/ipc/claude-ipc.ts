import { BrowserWindow, ipcMain } from "electron";
import type { ClaudeCodeAdapter } from "../services/claude-code-adapter.js";
import type { PromptInput } from "../services/claude-code-adapter.js";
import type { ClaudeSessionService } from "../services/claude-session-service.js";
import type { CommandValidator } from "../services/command-validator.js";
import type { ClaudeValidationResult } from "../../shared/types/claude-config.js";

const MAX_COMMAND_PATH_LENGTH = 4_096;
const MAX_SESSION_ID_LENGTH = 4_096;
const MAX_PROMPT_LENGTH = 200_000;
const MAX_CWD_LENGTH = 4_096;
const MAX_RUN_ID_LENGTH = 4_096;

export function normalizeClaudeCommandPath(
  commandPath: unknown,
): { ok: true; commandPath: string } | ClaudeValidationResult {
  if (typeof commandPath !== "string") {
    return {
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Claude command path must be a non-empty string.",
    };
  }

  const trimmedCommandPath = commandPath.trim();

  if (trimmedCommandPath.length === 0) {
    return {
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Claude command path must be a non-empty string.",
    };
  }

  if (trimmedCommandPath.length > MAX_COMMAND_PATH_LENGTH) {
    return {
      ok: false,
      commandPath: trimmedCommandPath.slice(0, MAX_COMMAND_PATH_LENGTH),
      code: "missing",
      message: "Claude command path is too long.",
    };
  }

  return { ok: true, commandPath: trimmedCommandPath };
}

export function normalizeClaudeSessionId(sessionId: unknown): string {
  if (typeof sessionId !== "string") {
    throw new Error("Invalid Claude session id.");
  }

  const trimmedSessionId = sessionId.trim();
  if (
    trimmedSessionId.length === 0 ||
    trimmedSessionId.length > MAX_SESSION_ID_LENGTH
  ) {
    throw new Error("Invalid Claude session id.");
  }

  return trimmedSessionId;
}

export function normalizeClaudePromptInput(input: unknown): PromptInput {
  if (!isRecord(input)) {
    throw new Error("Invalid Claude prompt payload.");
  }

  if (typeof input.prompt !== "string") {
    throw new Error("Claude prompt must be a non-empty string.");
  }

  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    throw new Error("Claude prompt must be a non-empty string.");
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error("Claude prompt is too long.");
  }

  const normalized: PromptInput = { prompt };

  if (input.sessionId !== undefined) {
    normalized.sessionId = normalizeClaudeSessionId(input.sessionId);
  }

  if (input.cwd !== undefined) {
    if (typeof input.cwd !== "string") {
      throw new Error("Claude cwd must be a non-empty string.");
    }

    const cwd = input.cwd.trim();
    if (cwd.length === 0) {
      throw new Error("Claude cwd must be a non-empty string.");
    }

    if (cwd.length > MAX_CWD_LENGTH) {
      throw new Error("Claude cwd is too long.");
    }

    normalized.cwd = cwd;
  }

  return normalized;
}

export function normalizeClaudeRunId(runId: unknown): string {
  if (typeof runId !== "string") {
    throw new Error("Invalid Claude run id.");
  }

  const trimmedRunId = runId.trim();
  if (trimmedRunId.length === 0 || trimmedRunId.length > MAX_RUN_ID_LENGTH) {
    throw new Error("Invalid Claude run id.");
  }

  return trimmedRunId;
}

export function registerClaudeIpc(
  commandValidator: CommandValidator,
  sessionService: ClaudeSessionService,
  claudeCodeAdapter: ClaudeCodeAdapter,
) {
  ipcMain.handle("claude:validate", (_event, commandPath: unknown) => {
    const normalized = normalizeClaudeCommandPath(commandPath);
    if (!normalized.ok) {
      return normalized;
    }

    return commandValidator.validate(normalized.commandPath);
  });

  ipcMain.handle("claude:sessions:list", () => sessionService.listSessions());
  ipcMain.handle("claude:sessions:load", (_event, sessionId: unknown) => {
    return sessionService.loadSession(normalizeClaudeSessionId(sessionId));
  });
  ipcMain.handle("claude:prompt", (_event, input: unknown) => {
    return claudeCodeAdapter.runPrompt(
      normalizeClaudePromptInput(input),
      (agentEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send("agent:event", agentEvent);
        }
      },
    );
  });
  ipcMain.handle("claude:cancel", (_event, runId: unknown) => {
    claudeCodeAdapter.cancelRun(normalizeClaudeRunId(runId));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
