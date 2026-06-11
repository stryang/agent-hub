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

type CommandValidatorOptions = {
  timeoutMs?: number;
  outputLimit?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT = 8_192;

function appendCapped(output: string, chunk: string, limit: number) {
  if (output.length >= limit) {
    return output;
  }

  return (output + chunk).slice(0, limit);
}

function defaultRunner(
  command: string,
  args: string[],
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    outputLimit = DEFAULT_OUTPUT_LIMIT,
  }: CommandValidatorOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: CommandResult) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      stderr = appendCapped("Command timed out", stderr, outputLimit);
      child.kill();
      finish({ code: 1, stdout, stderr });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = appendCapped(stdout, chunk, outputLimit);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendCapped(stderr, chunk, outputLimit);
    });
    child.on("error", (error) => {
      finish({
        code: 1,
        stdout,
        stderr: appendCapped("", error.message, outputLimit),
      });
    });
    child.on("close", (code) => {
      finish({ code: code ?? 1, stdout, stderr });
    });
  });
}

export class CommandValidator {
  private readonly runner: CommandRunner;

  constructor(
    runner?: CommandRunner,
    options: CommandValidatorOptions = {},
  ) {
    this.runner = runner ?? ((command, args) => defaultRunner(command, args, options));
  }

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
