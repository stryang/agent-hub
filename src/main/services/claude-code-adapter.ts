import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentUiEvent, ToolKind } from "../../shared/types/agent-events.js";

const DEFAULT_STDOUT_BUFFER_LIMIT = 1024 * 1024;
const DEFAULT_RAW_OUTPUT_LIMIT = 64 * 1024;
const DEFAULT_SIGTERM_DELAY_MS = 500;
const DEFAULT_SIGKILL_DELAY_MS = 2_000;

export interface ClaudeCodeAdapterOptions {
  commandPath: string;
  spawnProcess?: SpawnClaudeProcess;
  stdoutBufferLimit?: number;
  rawOutputLimit?: number;
  sigtermDelayMs?: number;
  sigkillDelayMs?: number;
}

export interface PromptInput {
  prompt: string;
  sessionId?: string;
  cwd?: string;
}

type EmitAgentEvent = (event: AgentUiEvent) => void;
type ToolStartEvent = Extract<AgentUiEvent, { type: "tool_start" }>;
type Timer = ReturnType<typeof setTimeout>;

export interface ClaudeProcessStream {
  setEncoding(encoding: BufferEncoding): void;
  on(event: "data", listener: (chunk: string) => void): this;
}

export interface ClaudeProcess {
  stdout: ClaudeProcessStream;
  stderr: ClaudeProcessStream;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
  kill(signal: NodeJS.Signals): boolean;
}

export type SpawnClaudeProcess = (
  commandPath: string,
  args: string[],
  options: { cwd?: string; stdio: ["ignore", "pipe", "pipe"] },
) => ClaudeProcess;

interface ActiveRun {
  child: ClaudeProcess;
  cancelled: boolean;
  activeTool: ToolKind | null;
  stdoutBuffer: string;
  sigtermTimer?: Timer;
  sigkillTimer?: Timer;
}

interface RunParseState {
  activeTool: ToolKind | null;
}

interface ClaudeContentBlock {
  type?: unknown;
  text?: unknown;
  name?: unknown;
  input?: unknown;
  content?: unknown;
}

export class ClaudeCodeAdapter {
  private readonly commandPath: string;
  private readonly spawnProcess: SpawnClaudeProcess;
  private readonly stdoutBufferLimit: number;
  private readonly rawOutputLimit: number;
  private readonly sigtermDelayMs: number;
  private readonly sigkillDelayMs: number;
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(options: ClaudeCodeAdapterOptions) {
    this.commandPath = options.commandPath;
    this.spawnProcess =
      options.spawnProcess ??
      ((commandPath, args, spawnOptions) =>
        spawn(commandPath, args, spawnOptions) as unknown as ClaudeProcess);
    this.stdoutBufferLimit =
      options.stdoutBufferLimit ?? DEFAULT_STDOUT_BUFFER_LIMIT;
    this.rawOutputLimit = options.rawOutputLimit ?? DEFAULT_RAW_OUTPUT_LIMIT;
    this.sigtermDelayMs = options.sigtermDelayMs ?? DEFAULT_SIGTERM_DELAY_MS;
    this.sigkillDelayMs = options.sigkillDelayMs ?? DEFAULT_SIGKILL_DELAY_MS;
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

    const child = this.spawnProcess(this.commandPath, args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const activeRun: ActiveRun = {
      child,
      cancelled: false,
      activeTool: null,
      stdoutBuffer: "",
    };

    this.activeRuns.set(runId, activeRun);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      activeRun.stdoutBuffer += chunk;
      const lines = activeRun.stdoutBuffer.split(/\r?\n/);
      activeRun.stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.length === 0) continue;
        for (const event of this.parseLineForRun(line, Date.now(), activeRun)) {
          emit(event);
        }
      }

      if (activeRun.stdoutBuffer.length > this.stdoutBufferLimit) {
        emit({
          type: "error",
          message: "Claude stdout exceeded the buffer limit.",
          detail: `Discarded ${activeRun.stdoutBuffer.length} characters without a newline.`,
          timestamp: Date.now(),
        });
        emit({
          type: "raw_output",
          text: this.truncateOutput(activeRun.stdoutBuffer, "stdout"),
          timestamp: Date.now(),
        });
        activeRun.stdoutBuffer = "";
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      emit({
        type: "raw_output",
        text: this.truncateOutput(chunk, "stderr"),
        timestamp: Date.now(),
      });
    });

    child.on("error", (error) => {
      emit({
        type: "error",
        message: error.message,
        timestamp: Date.now(),
      });
    });

    child.on("close", (code) => {
      this.clearCancellationTimers(activeRun);

      if (activeRun.stdoutBuffer.length > 0) {
        for (const event of this.parseLineForRun(
          activeRun.stdoutBuffer,
          Date.now(),
          activeRun,
        )) {
          emit(event);
        }
      }

      if (activeRun.cancelled) {
        if (activeRun.activeTool) {
          emit({ type: "tool_done", status: "cancelled", timestamp: Date.now() });
        } else {
          emit({
            type: "raw_output",
            text: "Claude Code run cancelled.",
            timestamp: Date.now(),
          });
        }
      } else if (code !== 0 && code !== null) {
        emit({
          type: "error",
          message: `Claude Code exited with code ${code}.`,
          timestamp: Date.now(),
        });
      }

      this.activeRuns.delete(runId);
    });

    return { runId };
  }

  cancelRun(runId: string): void {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun || activeRun.cancelled) return;

    activeRun.cancelled = true;
    activeRun.child.kill("SIGINT");
    activeRun.sigtermTimer = setTimeout(() => {
      if (this.activeRuns.get(runId) !== activeRun) return;
      activeRun.child.kill("SIGTERM");
    }, this.sigtermDelayMs);

    activeRun.sigkillTimer = setTimeout(() => {
      if (this.activeRuns.get(runId) !== activeRun) return;
      activeRun.child.kill("SIGKILL");
    }, this.sigkillDelayMs);
  }

  parseLine(line: string, timestamp: number): AgentUiEvent[] {
    return this.parseLineWithState(line, timestamp, { activeTool: null });
  }

  private parseLineForRun(
    line: string,
    timestamp: number,
    runState: RunParseState,
  ): AgentUiEvent[] {
    return this.parseLineWithState(line, timestamp, runState);
  }

  private parseLineWithState(
    line: string,
    timestamp: number,
    runState: RunParseState,
  ): AgentUiEvent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return [this.capEventText({ type: "raw_output", text: line, timestamp }, "stdout")];
    }

    if (!isRecord(parsed)) {
      return [this.capEventText({ type: "raw_output", text: line, timestamp }, "stdout")];
    }

    if (parsed.type === "result" && typeof parsed.session_id === "string") {
      return [];
    }

    const message = isRecord(parsed.message) ? parsed.message : undefined;
    const content = message?.content;
    if (!Array.isArray(content)) {
      return [this.capEventText({ type: "raw_output", text: line, timestamp }, "stdout")];
    }

    const events = content.flatMap((block) =>
      this.contentBlockToEvents(block, timestamp, runState),
    );

    if (events.length === 0) {
      return [this.capEventText({ type: "raw_output", text: line, timestamp }, "stdout")];
    }

    return events.map((event) => this.capEventText(event, "stdout"));
  }

  private contentBlockToEvents(
    block: ClaudeContentBlock,
    timestamp: number,
    runState: RunParseState,
  ): AgentUiEvent[] {
    if (!isRecord(block)) {
      return [];
    }

    if (block.type === "text" && typeof block.text === "string") {
      return [{ type: "assistant_message", text: block.text, timestamp }];
    }

    if (block.type === "tool_use") {
      const event = this.toolUseToEvent(block, timestamp);
      runState.activeTool = event.tool;
      return [event];
    }

    if (block.type === "tool_result") {
      const output = toolResultContentToText(block.content);
      const events: AgentUiEvent[] = [
        { type: "tool_output", text: output, timestamp },
      ];

      events.push({ type: "tool_done", status: "success", timestamp });
      runState.activeTool = null;

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

  private capEventText(event: AgentUiEvent, label: "stdout" | "stderr"): AgentUiEvent {
    switch (event.type) {
      case "assistant_message":
      case "tool_output":
      case "permission_prompt":
      case "raw_output":
        return {
          ...event,
          text: this.truncateOutput(event.text, label),
        };
      case "error":
        return {
          ...event,
          message: this.truncateOutput(event.message, label),
          detail:
            event.detail === undefined
              ? undefined
              : this.truncateOutput(event.detail, label),
        };
      case "diff":
        return {
          ...event,
          unifiedDiff: this.truncateOutput(event.unifiedDiff, label),
        };
      default:
        return event;
    }
  }

  private truncateOutput(text: string, label: "stdout" | "stderr"): string {
    if (text.length <= this.rawOutputLimit) {
      return text;
    }

    const omitted = text.length - this.rawOutputLimit;
    return `${text.slice(0, this.rawOutputLimit)}\n[Claude ${label} truncated: ${omitted} characters omitted.]`;
  }

  private clearCancellationTimers(activeRun: ActiveRun): void {
    if (activeRun.sigtermTimer) {
      clearTimeout(activeRun.sigtermTimer);
    }

    if (activeRun.sigkillTimer) {
      clearTimeout(activeRun.sigkillTimer);
    }
  }
}

function normalizeToolKind(name: unknown): ToolKind {
  if (typeof name !== "string") {
    return "unknown";
  }

  switch (name.toLowerCase()) {
    case "read":
      return "read";
    case "edit":
      return "edit";
    case "write":
      return "write";
    case "bash":
      return "bash";
    default:
      return "unknown";
  }
}

function toolResultContentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => toolResultContentToText(item)).join("\n");
  }

  if (isRecord(content)) {
    if (typeof content.text === "string") {
      return content.text;
    }

    if (typeof content.content === "string") {
      return content.content;
    }

    return JSON.stringify(content);
  }

  return String(content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
