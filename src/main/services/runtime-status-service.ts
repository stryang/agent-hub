import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RuntimeStatus } from "../../shared/types/runtime-status.js";

type RunResult = { code: number; stdout: string; stderr: string };

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_OUTPUT_LIMIT = 16 * 1024;

export class RuntimeStatusService {
  async getStatus(cwd: string): Promise<RuntimeStatus> {
    const normalizedCwd = await normalizeCwd(cwd);
    const modelName = await readLatestClaudeModelName();
    const branch = await this.runGit(["branch", "--show-current"], normalizedCwd);

    if (branch.code !== 0) {
      return {
        cwd: normalizedCwd,
        modelName,
        git: { available: false },
      };
    }

    const nameStatus = await this.runGit(
      ["status", "--porcelain=v1"],
      normalizedCwd,
    );
    const fileStats =
      nameStatus.code === 0
        ? parseGitPorcelainFileStats(nameStatus.stdout)
        : { addedFiles: 0, deletedFiles: 0 };

    return {
      cwd: normalizedCwd,
      modelName,
      git: {
        available: true,
        branch: branch.stdout.trim() || "detached",
        addedFiles: fileStats.addedFiles,
        deletedFiles: fileStats.deletedFiles,
      },
    };
  }

  private runGit(args: string[], cwd: string): Promise<RunResult> {
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      } catch (error) {
        resolve({
          code: 1,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      let stdout = "";
      let stderr = "";
      let settled = false;
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        finish({ code: 1, stdout, stderr: "Command timed out" });
      }, DEFAULT_TIMEOUT_MS);

      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout = appendCapped(stdout, chunk, DEFAULT_OUTPUT_LIMIT);
      });
      child.stderr.on("data", (chunk) => {
        stderr = appendCapped(stderr, chunk, DEFAULT_OUTPUT_LIMIT);
      });
      child.on("error", (error) => {
        finish({ code: 1, stdout, stderr: error.message });
      });
      child.on("close", (code) => {
        finish({ code: code ?? 1, stdout, stderr });
      });
    });
  }
}

async function normalizeCwd(cwd: string): Promise<string> {
  const trimmed = cwd.trim();
  const expanded =
    trimmed === "~"
      ? os.homedir()
      : trimmed.startsWith("~/")
        ? path.join(os.homedir(), trimmed.slice(2))
        : trimmed;

  const stat = await fs.stat(expanded);
  if (!stat.isDirectory()) {
    throw new Error("Runtime status cwd must be a directory.");
  }

  return expanded;
}

function appendCapped(output: string, chunk: string, limit: number) {
  if (output.length >= limit) {
    return output;
  }

  return (output + chunk).slice(0, limit);
}

function parseGitPorcelainFileStats(output: string): {
  addedFiles: number;
  deletedFiles: number;
} {
  let addedFiles = 0;
  let deletedFiles = 0;

  for (const line of output.split(/\r?\n/)) {
    if (line.length < 3) continue;

    const indexStatus = line[0];
    const worktreeStatus = line[1];
    if (indexStatus === "D" || worktreeStatus === "D") {
      deletedFiles += 1;
      continue;
    }

    if (
      indexStatus === "A" ||
      indexStatus === "M" ||
      indexStatus === "R" ||
      indexStatus === "C" ||
      worktreeStatus === "A" ||
      worktreeStatus === "M" ||
      line.startsWith("??")
    ) {
      addedFiles += 1;
    }
  }

  return { addedFiles, deletedFiles };
}

async function readLatestClaudeModelName(): Promise<string | undefined> {
  const costsPath = path.join(os.homedir(), ".claude", "metrics", "costs.jsonl");
  let raw: string;

  try {
    raw = await fs.readFile(costsPath, "utf8");
  } catch {
    return undefined;
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const record = parseJsonObject(lines[index]);
    if (!record) continue;

    if (
      typeof record.model === "string" &&
      record.model.trim().length > 0 &&
      record.model !== "unknown"
    ) {
      return record.model;
    }
  }

  return undefined;
}

function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
