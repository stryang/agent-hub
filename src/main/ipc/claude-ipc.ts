import { BrowserWindow, ipcMain } from "electron";
import type { ClaudeCodeAdapter } from "../services/claude-code-adapter.js";
import type { ClaudeSessionService } from "../services/claude-session-service.js";
import type { CommandValidator } from "../services/command-validator.js";
import type { ClaudeValidationResult } from "../../shared/types/claude-config.js";

const MAX_COMMAND_PATH_LENGTH = 4_096;
const MAX_SESSION_ID_LENGTH = 4_096;

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
  ipcMain.handle("claude:prompt", (_event, input) => {
    return claudeCodeAdapter.runPrompt(input, (agentEvent) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("agent:event", agentEvent);
      }
    });
  });
  ipcMain.handle("claude:cancel", (_event, runId: string) => {
    claudeCodeAdapter.cancelRun(runId);
  });
}
