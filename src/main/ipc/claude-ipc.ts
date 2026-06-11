import { ipcMain } from "electron";
import type { CommandValidator } from "../services/command-validator.js";
import type { ClaudeValidationResult } from "../../shared/types/claude-config.js";

const MAX_COMMAND_PATH_LENGTH = 4_096;

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

export function registerClaudeIpc(commandValidator: CommandValidator) {
  ipcMain.handle("claude:validate", (_event, commandPath: unknown) => {
    const normalized = normalizeClaudeCommandPath(commandPath);
    if (!normalized.ok) {
      return normalized;
    }

    return commandValidator.validate(normalized.commandPath);
  });
}
