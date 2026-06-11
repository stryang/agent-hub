import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandValidator } from "../../src/main/services/command-validator";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-command-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("CommandValidator", () => {
  it("reports missing command path", async () => {
    const validator = new CommandValidator(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
    }));

    await expect(validator.validate("/missing/claude")).resolves.toMatchObject({
      ok: false,
      code: "missing",
    });
  });

  it("reports non executable command path", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o644);

    const validator = new CommandValidator(async () => ({
      code: 0,
      stdout: "",
      stderr: "",
    }));

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "not_executable",
    });
  });

  it("validates version and auth status", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o755);
    const runner = vi.fn(async (_command: string, args: string[]) => {
      if (args.includes("--version")) {
        return { code: 0, stdout: "1.2.3\n", stderr: "" };
      }

      if (args[0] === "auth" && args[1] === "status") {
        return { code: 0, stdout: "Logged in\n", stderr: "" };
      }

      return { code: 1, stdout: "", stderr: "unexpected" };
    });
    const validator = new CommandValidator(runner);

    await expect(validator.validate(file)).resolves.toEqual({
      ok: true,
      commandPath: file,
      version: "1.2.3",
      authenticated: true,
    });
  });

  it("reports auth failure", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o755);
    const validator = new CommandValidator(async (_command, args) => {
      if (args.includes("--version")) {
        return { code: 0, stdout: "1.2.3\n", stderr: "" };
      }

      return { code: 1, stdout: "", stderr: "not logged in" };
    });

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "auth_failed",
    });
  });

  it("times out slow command validation", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(
      file,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then while :; do :; done; fi\n',
      "utf8",
    );
    await fs.chmod(file, 0o755);
    const validator = new CommandValidator(undefined, { timeoutMs: 20 });

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "version_failed",
      detail: "Command timed out",
    });
  });

  it("caps command output diagnostics", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(
      file,
      [
        "#!/bin/sh",
        'if [ "$1" = "--version" ]; then',
        "  head -c 20000 /dev/zero | tr '\\0' x",
        "  exit 1",
        "fi",
        "",
      ].join("\n"),
      "utf8",
    );
    await fs.chmod(file, 0o755);
    const validator = new CommandValidator(undefined, { outputLimit: 32 });

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "version_failed",
      detail: "x".repeat(32),
    });
  });
});
