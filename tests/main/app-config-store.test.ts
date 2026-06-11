import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppConfigStore } from "../../src/main/services/app-config-store";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-config-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("AppConfigStore", () => {
  it("returns null when config has not been saved", async () => {
    const store = new AppConfigStore(tempDir);
    await expect(store.get()).resolves.toBeNull();
  });

  it("saves and reads Claude config", async () => {
    const store = new AppConfigStore(tempDir);
    await store.save({
      commandPath: "/opt/homebrew/bin/claude",
      defaultWorkingDirectory: "/Users/leo/IdeaProjects/yang/agent-hub",
    });
    await expect(store.get()).resolves.toEqual({
      commandPath: "/opt/homebrew/bin/claude",
      defaultWorkingDirectory: "/Users/leo/IdeaProjects/yang/agent-hub",
    });
  });

  it("rejects malformed config on save", async () => {
    const store = new AppConfigStore(tempDir);
    const malformedConfig = null as unknown as Parameters<AppConfigStore["save"]>[0];

    await expect(store.save(malformedConfig)).rejects.toThrow("Agent Hub config has invalid shape");
  });

  it("creates a nested user data directory when saving", async () => {
    const nestedDir = path.join(tempDir, "missing", "nested");
    const store = new AppConfigStore(nestedDir);
    const config = {
      commandPath: "/opt/homebrew/bin/claude",
      defaultWorkingDirectory: "/Users/leo/IdeaProjects/yang/agent-hub",
    };

    await store.save(config);

    await expect(fs.access(path.join(nestedDir, "config.json"))).resolves.toBeUndefined();
    await expect(store.get()).resolves.toEqual(config);
  });

  it("throws a clear error for corrupt JSON", async () => {
    await fs.writeFile(path.join(tempDir, "config.json"), "{bad json", "utf8");
    const store = new AppConfigStore(tempDir);
    await expect(store.get()).rejects.toThrow("Agent Hub config is not valid JSON");
  });

  it("throws a clear error for null JSON", async () => {
    await fs.writeFile(path.join(tempDir, "config.json"), "null", "utf8");
    const store = new AppConfigStore(tempDir);
    await expect(store.get()).rejects.toThrow("Agent Hub config has invalid shape");
  });
});
