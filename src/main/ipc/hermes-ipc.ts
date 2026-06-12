import { spawn } from "node:child_process";
import { BrowserWindow, ipcMain } from "electron";
import type { AppConfigStore } from "../services/app-config-store.js";
import { resolveClaudeCommandPath } from "../services/claude-command-resolver.js";
import type { HermesAdapter, HermesPromptInput } from "../services/hermes-adapter.js";
import type { HermesSessionService } from "../services/hermes-session-service.js";
import type { HermesValidationResult } from "../../shared/types/hermes-config.js";

const VALIDATE_TIMEOUT_MS = 5_000;
const VALIDATE_KILL_MS = 750;
const VALIDATE_OUTPUT_LIMIT = 8_192;

async function validateHermesCommand(commandPath: string): Promise<HermesValidationResult> {
  const resolution = await resolveClaudeCommandPath(commandPath);
  if (!resolution.ok) {
    return {
      ok: false,
      commandPath: resolution.commandPath,
      code: resolution.code,
      message: resolution.message,
      detail: resolution.detail,
    };
  }

  const executablePath = resolution.commandPath;
  const result = await runWithTimeout(executablePath, ["--version"]);

  if (result.code !== 0) {
    return {
      ok: false,
      commandPath: executablePath,
      code: "version_failed",
      message: "Hermes version check failed.",
      detail: result.stderr || result.stdout || `Exited with code ${result.code}.`,
    };
  }

  const version = (result.stdout.trim() || result.stderr.trim() || "unknown")
    .split("\n")[0]!
    .trim();

  return { ok: true, commandPath: executablePath, version };
}

function runWithTimeout(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      resolve({
        code: 1,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (result: { code: number; stdout: string; stderr: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), VALIDATE_KILL_MS);
    }, VALIDATE_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(0, VALIDATE_OUTPUT_LIMIT);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(0, VALIDATE_OUTPUT_LIMIT);
    });
    child.on("error", (err) => finish({ code: 1, stdout, stderr: err.message }));
    child.on("close", (code) => {
      clearTimeout(killTimer);
      finish({ code: timedOut ? 1 : (code ?? 1), stdout, stderr });
    });
  });
}

const MAX_COMMAND_PATH_LENGTH = 4_096;
const MAX_PROMPT_LENGTH = 200_000;
const MAX_CWD_LENGTH = 4_096;
const MAX_RUN_ID_LENGTH = 4_096;
const MAX_SESSION_ID_LENGTH = 4_096;

function normalizeHermesCommandPath(
  commandPath: unknown,
): { ok: true; commandPath: string } | HermesValidationResult {
  if (typeof commandPath !== "string") {
    return {
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Hermes command path must be a non-empty string.",
    };
  }

  const trimmed = commandPath.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Hermes command path must be a non-empty string.",
    };
  }

  if (trimmed.length > MAX_COMMAND_PATH_LENGTH) {
    return {
      ok: false,
      commandPath: trimmed.slice(0, MAX_COMMAND_PATH_LENGTH),
      code: "missing",
      message: "Hermes command path is too long.",
    };
  }

  return { ok: true, commandPath: trimmed };
}

function normalizePromptInput(input: unknown): HermesPromptInput {
  if (!isRecord(input)) throw new Error("Invalid Hermes prompt payload.");

  if (typeof input.prompt !== "string") throw new Error("Hermes prompt must be a non-empty string.");
  const prompt = input.prompt.trim();
  if (prompt.length === 0) throw new Error("Hermes prompt must be a non-empty string.");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error("Hermes prompt is too long.");

  const normalized: HermesPromptInput = { prompt };

  if (input.sessionId !== undefined) {
    if (typeof input.sessionId !== "string") throw new Error("Hermes sessionId must be a string.");
    const sessionId = input.sessionId.trim();
    if (sessionId.length > 0 && sessionId.length <= MAX_SESSION_ID_LENGTH) {
      normalized.sessionId = sessionId;
    }
  }

  if (input.cwd !== undefined) {
    if (typeof input.cwd !== "string") throw new Error("Hermes cwd must be a string.");
    const cwd = input.cwd.trim();
    if (cwd.length > 0 && cwd.length <= MAX_CWD_LENGTH) {
      normalized.cwd = cwd;
    }
  }

  return normalized;
}

function normalizeRunId(runId: unknown): string {
  if (typeof runId !== "string") throw new Error("Invalid Hermes run id.");
  const trimmed = runId.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RUN_ID_LENGTH) {
    throw new Error("Invalid Hermes run id.");
  }
  return trimmed;
}

function normalizeSessionId(sessionId: unknown): string {
  if (typeof sessionId !== "string") throw new Error("Invalid Hermes session id.");
  const trimmed = sessionId.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID_LENGTH) {
    throw new Error("Invalid Hermes session id.");
  }
  return trimmed;
}

export function registerHermesIpc(
  configStore: AppConfigStore,
  sessionService: HermesSessionService,
  hermesAdapter: HermesAdapter,
) {
  ipcMain.handle("hermes:validate", (_event, commandPath: unknown) => {
    const normalized = normalizeHermesCommandPath(commandPath);
    if (!normalized.ok) return normalized;
    return validateHermesCommand(normalized.commandPath);
  });

  ipcMain.handle("hermes:sessions:list", () => sessionService.listSessions());
  ipcMain.handle("hermes:sessions:load", (_event, sessionId: unknown) =>
    sessionService.loadSession(normalizeSessionId(sessionId)),
  );

  ipcMain.handle("hermes:config:get", () => configStore.getHermes());
  ipcMain.handle("hermes:config:save", async (_event, config) => {
    const saved = await configStore.saveHermes(config);
    hermesAdapter.setCommandPath(saved.commandPath);
    return saved;
  });

  ipcMain.handle("hermes:prompt", (_event, input: unknown) => {
    return hermesAdapter.runPrompt(
      normalizePromptInput(input),
      (agentEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send("hermes:event", agentEvent);
        }
      },
    );
  });

  ipcMain.handle("hermes:cancel", (_event, runId: unknown) => {
    hermesAdapter.cancelRun(normalizeRunId(runId));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
