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

describe("normalizeClaudeSessionId", () => {
  it("rejects non-string session ids", async () => {
    const { normalizeClaudeSessionId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeSessionId(null)).toThrow(
      "Invalid Claude session id.",
    );
  });

  it("rejects empty session ids after trimming", async () => {
    const { normalizeClaudeSessionId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeSessionId("   ")).toThrow(
      "Invalid Claude session id.",
    );
  });

  it("rejects too-long session ids", async () => {
    const { normalizeClaudeSessionId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeSessionId("x".repeat(4_097))).toThrow(
      "Invalid Claude session id.",
    );
  });

  it("trims valid session ids", async () => {
    const { normalizeClaudeSessionId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(
      normalizeClaudeSessionId("  11111111-1111-4111-8111-111111111111  "),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("normalizeClaudePromptInput", () => {
  it("rejects non-object payloads", async () => {
    const { normalizeClaudePromptInput } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudePromptInput(null)).toThrow(
      "Invalid Claude prompt payload.",
    );
  });

  it("rejects empty prompts", async () => {
    const { normalizeClaudePromptInput } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudePromptInput({ prompt: "   " })).toThrow(
      "Claude prompt must be a non-empty string.",
    );
  });

  it("rejects too-long prompts", async () => {
    const { normalizeClaudePromptInput } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() =>
      normalizeClaudePromptInput({ prompt: "x".repeat(200_001) }),
    ).toThrow("Claude prompt is too long.");
  });

  it("rejects invalid cwd", async () => {
    const { normalizeClaudePromptInput } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() =>
      normalizeClaudePromptInput({ prompt: "hello", cwd: "   " }),
    ).toThrow("Claude cwd must be a non-empty string.");
  });

  it("normalizes prompt input", async () => {
    const { normalizeClaudePromptInput } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(
      normalizeClaudePromptInput({
        prompt: "  hello  ",
        sessionId: "  11111111-1111-4111-8111-111111111111  ",
        cwd: "  /tmp  ",
      }),
    ).toEqual({
      prompt: "hello",
      sessionId: "11111111-1111-4111-8111-111111111111",
      cwd: "/tmp",
    });
  });
});

describe("normalizeClaudeRunId", () => {
  it("rejects non-string run ids", async () => {
    const { normalizeClaudeRunId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeRunId(null)).toThrow("Invalid Claude run id.");
  });

  it("rejects empty run ids", async () => {
    const { normalizeClaudeRunId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeRunId("   ")).toThrow(
      "Invalid Claude run id.",
    );
  });

  it("rejects too-long run ids", async () => {
    const { normalizeClaudeRunId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(() => normalizeClaudeRunId("x".repeat(4_097))).toThrow(
      "Invalid Claude run id.",
    );
  });

  it("trims valid run ids", async () => {
    const { normalizeClaudeRunId } = await import(
      "../../src/main/ipc/claude-ipc"
    );

    expect(normalizeClaudeRunId("  run-id  ")).toBe("run-id");
  });
});
