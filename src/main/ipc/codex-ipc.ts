import { spawn } from "node:child_process";
import { BrowserWindow, ipcMain } from "electron";
import type { CodexAdapter, CodexPromptInput } from "../services/codex-adapter.js";
import type { AppConfigStore } from "../services/app-config-store.js";
import { resolveClaudeCommandPath } from "../services/claude-command-resolver.js";
import type { CodexValidationResult } from "../../shared/types/codex-config.js";

const VALIDATE_TIMEOUT_MS = 5_000;
const VALIDATE_KILL_MS = 750;
const VALIDATE_OUTPUT_LIMIT = 8_192;

async function validateCodexCommand(commandPath: string): Promise<CodexValidationResult> {
  const resolution = await resolveClaudeCommandPath(commandPath);
  if (!resolution.ok) {
    return { ok: false, commandPath: resolution.commandPath, code: resolution.code, message: resolution.message, detail: resolution.detail };
  }

  const executablePath = resolution.commandPath;
  const result = await runWithTimeout(executablePath, ["--version"]);

  if (result.code !== 0) {
    return {
      ok: false,
      commandPath: executablePath,
      code: "version_failed",
      message: "Codex version check failed.",
      detail: result.stderr || result.stdout || `Exited with code ${result.code}.`,
    };
  }

  return { ok: true, commandPath: executablePath, version: result.stdout.trim() || result.stderr.trim() || "unknown" };
}

function runWithTimeout(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      resolve({ code: 1, stdout: "", stderr: err instanceof Error ? err.message : String(err) });
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
    child.stdout.on("data", (chunk: string) => { stdout = (stdout + chunk).slice(0, VALIDATE_OUTPUT_LIMIT); });
    child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(0, VALIDATE_OUTPUT_LIMIT); });
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

export function normalizeCodexCommandPath(
  commandPath: unknown,
): { ok: true; commandPath: string } | CodexValidationResult {
  if (typeof commandPath !== "string") {
    return { ok: false, commandPath: "", code: "missing", message: "Codex command path must be a non-empty string." };
  }

  const trimmed = commandPath.trim();
  if (trimmed.length === 0) {
    return { ok: false, commandPath: "", code: "missing", message: "Codex command path must be a non-empty string." };
  }

  if (trimmed.length > MAX_COMMAND_PATH_LENGTH) {
    return { ok: false, commandPath: trimmed.slice(0, MAX_COMMAND_PATH_LENGTH), code: "missing", message: "Codex command path is too long." };
  }

  return { ok: true, commandPath: trimmed };
}

function normalizePromptInput(input: unknown): CodexPromptInput {
  if (!isRecord(input)) throw new Error("Invalid Codex prompt payload.");

  if (typeof input.prompt !== "string") throw new Error("Codex prompt must be a non-empty string.");
  const prompt = input.prompt.trim();
  if (prompt.length === 0) throw new Error("Codex prompt must be a non-empty string.");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error("Codex prompt is too long.");

  const normalized: CodexPromptInput = { prompt };

  if (input.cwd !== undefined) {
    if (typeof input.cwd !== "string") throw new Error("Codex cwd must be a non-empty string.");
    const cwd = input.cwd.trim();
    if (cwd.length === 0) throw new Error("Codex cwd must be a non-empty string.");
    if (cwd.length > MAX_CWD_LENGTH) throw new Error("Codex cwd is too long.");
    normalized.cwd = cwd;
  }

  return normalized;
}

function normalizeRunId(runId: unknown): string {
  if (typeof runId !== "string") throw new Error("Invalid Codex run id.");
  const trimmed = runId.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RUN_ID_LENGTH) throw new Error("Invalid Codex run id.");
  return trimmed;
}

export function registerCodexIpc(
  configStore: AppConfigStore,
  codexAdapter: CodexAdapter,
) {
  ipcMain.handle("codex:validate", (_event, commandPath: unknown) => {
    const normalized = normalizeCodexCommandPath(commandPath);
    if (!normalized.ok) return normalized;
    return validateCodexCommand(normalized.commandPath);
  });

  ipcMain.handle("codex:config:get", () => configStore.getCodex());
  ipcMain.handle("codex:config:save", async (_event, config) => {
    const saved = await configStore.saveCodex(config);
    codexAdapter.setCommandPath(saved.commandPath);
    return saved;
  });

  ipcMain.handle("codex:prompt", (_event, input: unknown) => {
    return codexAdapter.runPrompt(
      normalizePromptInput(input),
      (agentEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send("codex:event", agentEvent);
        }
      },
    );
  });

  ipcMain.handle("codex:cancel", (_event, runId: unknown) => {
    codexAdapter.cancelRun(normalizeRunId(runId));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
