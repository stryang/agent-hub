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
});
