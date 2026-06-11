import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

describe("normalizeClaudeCommandPath", () => {
  it("rejects non-string command paths", async () => {
    const { normalizeClaudeCommandPath } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(normalizeClaudeCommandPath(null)).toMatchObject({
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Claude command path must be a non-empty string.",
    });
  });

  it("rejects empty command paths after trimming", async () => {
    const { normalizeClaudeCommandPath } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(normalizeClaudeCommandPath("   ")).toMatchObject({
      ok: false,
      commandPath: "",
      code: "missing",
      message: "Claude command path must be a non-empty string.",
    });
  });

  it("rejects too-long command paths", async () => {
    const { normalizeClaudeCommandPath } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(normalizeClaudeCommandPath("x".repeat(4_097))).toMatchObject({
      ok: false,
      commandPath: "x".repeat(4_096),
      code: "missing",
      message: "Claude command path is too long.",
    });
  });

  it("trims valid command paths", async () => {
    const { normalizeClaudeCommandPath } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(normalizeClaudeCommandPath("  /opt/homebrew/bin/claude  ")).toEqual({
      ok: true,
      commandPath: "/opt/homebrew/bin/claude",
    });
  });
});
