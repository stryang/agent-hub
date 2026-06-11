import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/main/services/claude-code-adapter";

describe("ClaudeCodeAdapter", () => {
  it("maps Claude stream lines to agent UI events", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const fixturePath = path.join(
      process.cwd(),
      "tests/fixtures/claude-stream.jsonl",
    );
    const lines = readFileSync(fixturePath, "utf8").trim().split("\n");
    const timestamp = 1_717_171_717;

    const events = lines
      .slice(0, 5)
      .flatMap((line) => adapter.parseLine(line, timestamp));

    expect(events).toEqual([
      {
        type: "assistant_message",
        text: "我会先读取 README。",
        timestamp,
      },
      {
        type: "tool_start",
        tool: "read",
        target: "README.md",
        timestamp,
      },
      {
        type: "tool_output",
        text: "# Agent Hub",
        timestamp,
      },
      {
        type: "tool_done",
        status: "success",
        timestamp,
      },
      {
        type: "tool_start",
        tool: "bash",
        command: "npm test",
        timestamp,
      },
      {
        type: "tool_output",
        text: "Tests passed",
        timestamp,
      },
      {
        type: "tool_done",
        status: "success",
        timestamp,
      },
    ]);
  });

  it("falls back to raw_output for unknown JSON", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const line = '{"type":"result","session_id":"session-id"}';
    const timestamp = 1_717_171_717;

    expect(adapter.parseLine(line, timestamp)).toEqual([
      {
        type: "raw_output",
        text: line,
        timestamp,
      },
    ]);
  });

  it("falls back to raw_output for invalid JSON", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const line = "{not-json";
    const timestamp = 1_717_171_717;

    expect(adapter.parseLine(line, timestamp)).toEqual([
      {
        type: "raw_output",
        text: line,
        timestamp,
      },
    ]);
  });
});
