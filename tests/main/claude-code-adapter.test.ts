import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaudeCodeAdapter } from "../../src/main/services/claude-code-adapter";
import type {
  ClaudeProcess,
  ClaudeProcessStream,
} from "../../src/main/services/claude-code-adapter";

class FakeStream extends EventEmitter implements ClaudeProcessStream {
  setEncoding(_encoding: BufferEncoding): void {}

  emitData(chunk: string): void {
    this.emit("data", chunk);
  }
}

class FakeClaudeProcess extends EventEmitter implements ClaudeProcess {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly killedSignals: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals): boolean {
    this.killedSignals.push(signal);
    return true;
  }

  emitClose(code: number | null): void {
    this.emit("close", code);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it("ignores result metadata lines", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const line = '{"type":"result","session_id":"session-id"}';
    const timestamp = 1_717_171_717;

    expect(adapter.parseLine(line, timestamp)).toEqual([]);
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

  it("falls back to raw_output for JSON null", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const timestamp = 1_717_171_717;

    expect(adapter.parseLine("null", timestamp)).toEqual([
      {
        type: "raw_output",
        text: "null",
        timestamp,
      },
    ]);
  });

  it("maps tool names case-insensitively", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const timestamp = 1_717_171_717;

    expect(
      adapter.parseLine(
        '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"read","input":{"file_path":"README.md"}}]}}',
        timestamp,
      ),
    ).toEqual([
      {
        type: "tool_start",
        tool: "read",
        target: "README.md",
        timestamp,
      },
    ]);
  });

  it("converts array tool_result content to text output", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const timestamp = 1_717_171_717;

    expect(
      adapter.parseLine(
        '{"type":"user","message":{"content":[{"type":"tool_result","content":[{"type":"text","text":"one"},{"content":"two"},{"value":3}]}]}}',
        timestamp,
      ),
    ).toEqual([
      {
        type: "tool_output",
        text: 'one\ntwo\n{"value":3}',
        timestamp,
      },
      {
        type: "tool_done",
        status: "success",
        timestamp,
      },
    ]);
  });

  it("converts object tool_result content to readable output", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "claude" });
    const timestamp = 1_717_171_717;

    expect(
      adapter.parseLine(
        '{"type":"user","message":{"content":[{"type":"tool_result","content":{"stdout":"ok","exitCode":0}}]}}',
        timestamp,
      ),
    ).toEqual([
      {
        type: "tool_output",
        text: '{"stdout":"ok","exitCode":0}',
        timestamp,
      },
      {
        type: "tool_done",
        status: "success",
        timestamp,
      },
    ]);
  });

  it("caps buffered stdout when no newline arrives", () => {
    const fakeProcess = new FakeClaudeProcess();
    const adapter = new ClaudeCodeAdapter({
      commandPath: "claude",
      spawnProcess: () => fakeProcess,
      stdoutBufferLimit: 8,
      rawOutputLimit: 4,
    });
    const events: unknown[] = [];

    adapter.runPrompt({ prompt: "hello" }, (event) => events.push(event));
    fakeProcess.stdout.emitData("123456789");

    expect(events).toMatchObject([
      {
        type: "error",
        message: "Claude stdout exceeded the buffer limit.",
      },
      {
        type: "raw_output",
        text: "1234\n[Claude stdout truncated: 5 characters omitted.]",
      },
    ]);
  });

  it("keeps cancelled runs active until close and suppresses nonzero exit errors", () => {
    vi.useFakeTimers();

    const fakeProcess = new FakeClaudeProcess();
    const adapter = new ClaudeCodeAdapter({
      commandPath: "claude",
      spawnProcess: () => fakeProcess,
      sigtermDelayMs: 10,
      sigkillDelayMs: 20,
    });
    const events: unknown[] = [];

    const { runId } = adapter.runPrompt({ prompt: "hello" }, (event) =>
      events.push(event),
    );

    fakeProcess.stdout.emitData(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"npm test"}}]}}\n',
    );
    adapter.cancelRun(runId);
    adapter.cancelRun(runId);
    vi.advanceTimersByTime(20);
    fakeProcess.emitClose(130);

    expect(fakeProcess.killedSignals).toEqual(["SIGINT", "SIGTERM", "SIGKILL"]);
    expect(events).toEqual([
      {
        type: "tool_start",
        tool: "bash",
        command: "npm test",
        timestamp: expect.any(Number),
      },
      {
        type: "tool_done",
        status: "cancelled",
        timestamp: expect.any(Number),
      },
    ]);
  });
});
