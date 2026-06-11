import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import type { ClaudeValidationResult } from "../../shared/types/claude-config.js";

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: string[],
) => Promise<CommandResult>;

function defaultRunner(
  command: string,
  args: string[],
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export class CommandValidator {
  constructor(private readonly runner: CommandRunner = defaultRunner) {}

  async validate(commandPath: string): Promise<ClaudeValidationResult> {
    try {
      await fs.access(commandPath);
    } catch {
      return {
        ok: false,
        commandPath,
        code: "missing",
        message: "Claude command path does not exist.",
      };
    }

    try {
      await fs.access(commandPath, fs.constants.X_OK);
    } catch {
      return {
        ok: false,
        commandPath,
        code: "not_executable",
        message: "Claude command path is not executable.",
      };
    }

    const version = await this.runner(commandPath, ["--version"]);
    if (version.code !== 0) {
      return {
        ok: false,
        commandPath,
        code: "version_failed",
        message: "Claude version check failed.",
        detail: version.stderr || version.stdout,
      };
    }

    const auth = await this.runner(commandPath, ["auth", "status"]);
    if (auth.code !== 0) {
      return {
        ok: false,
        commandPath,
        code: "auth_failed",
        message: "Claude Code is not authenticated.",
        detail: auth.stderr || auth.stdout,
      };
    }

    return {
      ok: true,
      commandPath,
      version: version.stdout.trim(),
      authenticated: true,
    };
  }
}
