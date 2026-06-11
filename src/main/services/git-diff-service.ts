import { spawn } from "node:child_process";

type RunResult = { code: number; stdout: string; stderr: string };

type GitDiffServiceOptions = {
  timeoutMs?: number;
  killAfterMs?: number;
  maxStdout?: number;
  maxStderr?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_KILL_AFTER_MS = 750;
const DEFAULT_MAX_STDOUT = 1024 * 1024;
const DEFAULT_MAX_STDERR = 64 * 1024;

function appendCapped(output: string, chunk: string, limit: number) {
  if (output.length >= limit) {
    return output;
  }

  return (output + chunk).slice(0, limit);
}

export class GitDiffService {
  private readonly timeoutMs: number;
  private readonly killAfterMs: number;
  private readonly maxStdout: number;
  private readonly maxStderr: number;

  constructor({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    killAfterMs = DEFAULT_KILL_AFTER_MS,
    maxStdout = DEFAULT_MAX_STDOUT,
    maxStderr = DEFAULT_MAX_STDERR,
  }: GitDiffServiceOptions = {}) {
    this.timeoutMs = timeoutMs;
    this.killAfterMs = killAfterMs;
    this.maxStdout = maxStdout;
    this.maxStderr = maxStderr;
  }

  async diffFile(cwd: string, filePath: string): Promise<string | null> {
    const root = await this.run("git", ["rev-parse", "--show-toplevel"], cwd);
    if (root.code !== 0) return null;

    const diff = await this.run("git", ["diff", "--", filePath], cwd);
    if (diff.code !== 0) return null;
    return diff.stdout.trim() ? diff.stdout : null;
  }

  run(command: string, args: string[], cwd: string): Promise<RunResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

      const finish = (result: RunResult) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();
        resolve(result);
      };

      timeout = setTimeout(() => {
        timedOut = true;
        stderr = appendCapped(stderr, "Command timed out", this.maxStderr);
        child.kill("SIGTERM");
        escalationTimeout = setTimeout(() => {
          child.kill("SIGKILL");
        }, this.killAfterMs);
      }, this.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout = appendCapped(stdout, chunk, this.maxStdout);
      });
      child.stderr.on("data", (chunk) => {
        stderr = appendCapped(stderr, chunk, this.maxStderr);
      });
      child.on("error", (error) => {
        finish({
          code: 1,
          stdout,
          stderr: appendCapped(stderr, error.message, this.maxStderr),
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
}
