import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitDiffService } from "../../src/main/services/git-diff-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-git-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("GitDiffService", () => {
  it("returns null outside a git repository", async () => {
    const service = new GitDiffService();
    await expect(service.diffFile(tempDir, "README.md")).resolves.toBeNull();
  });

  it("returns unified diff for a modified tracked file", async () => {
    const service = new GitDiffService();
    await service.run("git", ["init"], tempDir);
    await service.run("git", ["config", "user.email", "test@example.com"], tempDir);
    await service.run("git", ["config", "user.name", "Test User"], tempDir);
    await service.run("git", ["config", "commit.gpgsign", "false"], tempDir);
    await fs.writeFile(path.join(tempDir, "README.md"), "old\n", "utf8");
    await service.run("git", ["add", "README.md"], tempDir);
    await service.run("git", ["commit", "-m", "initial"], tempDir);
    await fs.writeFile(path.join(tempDir, "README.md"), "new\n", "utf8");

    const diff = await service.diffFile(tempDir, "README.md");

    expect(diff).toContain("--- a/README.md");
    expect(diff).toContain("+++ b/README.md");
    expect(diff).toContain("-old");
    expect(diff).toContain("+new");
  });

  it("times out commands and waits for process close", async () => {
    const service = new GitDiffService({ timeoutMs: 100, killAfterMs: 100 });
    const started = Date.now();

    const result = await service.run(
      process.execPath,
      ["-e", "setTimeout(() => {}, 10_000)"],
      tempDir,
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Command timed out");
    expect(Date.now() - started).toBeGreaterThanOrEqual(90);
  });

  it("caps stdout and stderr output", async () => {
    const service = new GitDiffService({ maxStdout: 8, maxStderr: 6 });

    const result = await service.run(
      process.execPath,
      [
        "-e",
        [
          "process.stdout.write('abcdefghijklmnop');",
          "process.stderr.write('qrstuvwxyz');",
        ].join(""),
      ],
      tempDir,
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("abcdefgh");
    expect(result.stderr).toBe("qrstuv");
  });
});
