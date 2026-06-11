import { spawn } from "node:child_process";

type RunResult = { code: number; stdout: string; stderr: string };

export class GitDiffService {
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
}
