import { spawn } from "node:child_process";
import type { ClaudeValidationResult } from "../../shared/types/claude-config.js";
import {
  resolveClaudeCommandPath,
  type ClaudeCommandResolution,
} from "./claude-command-resolver.js";

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
  timeoutKillMs?: number;
  outputLimit?: number;
  resolveCommandPath?: (commandPath: string) => Promise<ClaudeCommandResolution>;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_TIMEOUT_KILL_MS = 750;
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
    timeoutKillMs = DEFAULT_TIMEOUT_KILL_MS,
    outputLimit = DEFAULT_OUTPUT_LIMIT,
  }: CommandValidatorOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({
        code: 1,
        stdout: "",
        stderr: appendCapped("", formatError(error), outputLimit),
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let escalationTimeout: NodeJS.Timeout | undefined;

    const clearTimers = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      if (escalationTimeout) {
        clearTimeout(escalationTimeout);
      }
    };

    const finish = (result: CommandResult) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimers();
      resolve(result);
    };

    timeout = setTimeout(() => {
      timedOut = true;
      stderr = appendCapped("", "Command timed out", outputLimit);
      child.kill("SIGTERM");
      escalationTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutKillMs);
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
      if (timedOut) {
        finish({ code: 1, stdout, stderr });
        return;
      }

      finish({ code: code ?? 1, stdout, stderr });
    });
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class CommandValidator {
  private readonly runner: CommandRunner;
  private readonly resolveCommandPath: (
    commandPath: string,
  ) => Promise<ClaudeCommandResolution>;

  constructor(
    runner?: CommandRunner,
    options: CommandValidatorOptions = {},
  ) {
    this.runner = runner ?? ((command, args) => defaultRunner(command, args, options));
    this.resolveCommandPath =
      options.resolveCommandPath ?? resolveClaudeCommandPath;
  }

  async validate(commandPath: string): Promise<ClaudeValidationResult> {
    const resolution = await this.resolveCommandPath(commandPath);
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
    const version = await this.runner(executablePath, ["--version"]);
    if (version.code !== 0) {
      return {
        ok: false,
        commandPath: executablePath,
        code: "version_failed",
        message: "Claude version check failed.",
        detail: formatCommandFailure(version),
      };
    }

    const auth = await this.runner(executablePath, ["auth", "status"]);
    if (auth.code !== 0) {
      return {
        ok: false,
        commandPath: executablePath,
        code: "auth_failed",
        message: "Claude Code is not authenticated.",
        detail: formatCommandFailure(auth),
      };
    }

    return {
      ok: true,
      commandPath: executablePath,
      version: version.stdout.trim(),
      authenticated: true,
    };
  }
}

function formatCommandFailure(result: CommandResult): string {
  return (
    result.stderr ||
    result.stdout ||
    `Command exited with code ${result.code}.`
  );
}
