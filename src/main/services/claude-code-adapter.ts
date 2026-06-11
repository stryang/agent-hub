import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentUiEvent, ToolKind } from "../../shared/types/agent-events.js";

export interface ClaudeCodeAdapterOptions {
  commandPath: string;
}

export interface PromptInput {
  prompt: string;
  sessionId?: string;
  cwd?: string;
}

type EmitAgentEvent = (event: AgentUiEvent) => void;
type ToolStartEvent = Extract<AgentUiEvent, { type: "tool_start" }>;

interface ClaudeContentBlock {
  type?: unknown;
  text?: unknown;
  name?: unknown;
  input?: unknown;
  content?: unknown;
}

interface ClaudeMessageEnvelope {
  message?: {
    content?: unknown;
  };
}

export class ClaudeCodeAdapter {
  private readonly commandPath: string;
  private readonly activeRuns = new Map<string, ChildProcessWithoutNullStreams>();
  private activeTool: ToolKind | null = null;

  constructor(options: ClaudeCodeAdapterOptions) {
    this.commandPath = options.commandPath;
  }

  runPrompt(input: PromptInput, emit: EmitAgentEvent): { runId: string } {
    const runId = randomUUID();
    const args = [
      "-p",
      input.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ];

    if (input.sessionId) {
      args.push("--resume", input.sessionId);
    }

    const child = spawn(this.commandPath, args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.activeRuns.set(runId, child as unknown as ChildProcessWithoutNullStreams);

    let stdoutBuffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.length === 0) continue;
        for (const event of this.parseLine(line, Date.now())) {
          emit(event);
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      emit({ type: "raw_output", text: chunk, timestamp: Date.now() });
    });

    child.on("error", (error) => {
      emit({
        type: "error",
        message: error.message,
        timestamp: Date.now(),
      });
    });

    child.on("close", (code) => {
      if (stdoutBuffer.length > 0) {
        for (const event of this.parseLine(stdoutBuffer, Date.now())) {
          emit(event);
        }
      }

      if (code !== 0 && code !== null) {
        emit({
          type: "error",
          message: `Claude Code exited with code ${code}.`,
          timestamp: Date.now(),
        });
      }

      this.activeRuns.delete(runId);
      this.activeTool = null;
    });

    return { runId };
  }

  cancelRun(runId: string): void {
    const child = this.activeRuns.get(runId);
    if (!child) return;

    child.kill("SIGINT");
    this.activeRuns.delete(runId);
  }

  parseLine(line: string, timestamp: number): AgentUiEvent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return [{ type: "raw_output", text: line, timestamp }];
    }

    const content = (parsed as ClaudeMessageEnvelope).message?.content;
    if (!Array.isArray(content)) {
      return [{ type: "raw_output", text: line, timestamp }];
    }

    const events = content.flatMap((block) =>
      this.contentBlockToEvents(block, timestamp),
    );

    if (events.length === 0) {
      return [{ type: "raw_output", text: line, timestamp }];
    }

    return events;
  }

  private contentBlockToEvents(
    block: ClaudeContentBlock,
    timestamp: number,
  ): AgentUiEvent[] {
    if (block.type === "text" && typeof block.text === "string") {
      return [{ type: "assistant_message", text: block.text, timestamp }];
    }

    if (block.type === "tool_use") {
      const event = this.toolUseToEvent(block, timestamp);
      this.activeTool = event.tool;
      return [event];
    }

    if (block.type === "tool_result" && typeof block.content === "string") {
      const events: AgentUiEvent[] = [
        { type: "tool_output", text: block.content, timestamp },
      ];

      events.push({ type: "tool_done", status: "success", timestamp });
      this.activeTool = null;

      return events;
    }

    return [];
  }

  private toolUseToEvent(
    block: ClaudeContentBlock,
    timestamp: number,
  ): ToolStartEvent {
    const tool = normalizeToolKind(block.name);
    const input = isRecord(block.input) ? block.input : {};
    const event: AgentUiEvent = { type: "tool_start", tool, timestamp };

    if (
      (tool === "read" || tool === "edit" || tool === "write") &&
      typeof input.file_path === "string"
    ) {
      event.target = input.file_path;
    }

    if (tool === "bash" && typeof input.command === "string") {
      event.command = input.command;
    }

    return event;
  }
}

function normalizeToolKind(name: unknown): ToolKind {
  switch (name) {
    case "Read":
      return "read";
    case "Edit":
      return "edit";
    case "Write":
      return "write";
    case "Bash":
      return "bash";
    default:
      return "unknown";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
