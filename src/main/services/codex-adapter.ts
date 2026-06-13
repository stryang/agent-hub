import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentUiEvent, ToolKind } from "../../shared/types/agent-events.js";

const DEFAULT_STDOUT_BUFFER_LIMIT = 1024 * 1024;
const DEFAULT_RAW_OUTPUT_LIMIT = 64 * 1024;
const DEFAULT_SIGTERM_DELAY_MS = 500;
const DEFAULT_SIGKILL_DELAY_MS = 2_000;

export interface CodexAdapterOptions {
  commandPath: string;
  spawnProcess?: SpawnCodexProcess;
  stdoutBufferLimit?: number;
  rawOutputLimit?: number;
  sigtermDelayMs?: number;
  sigkillDelayMs?: number;
}

export interface CodexPromptInput {
  prompt: string;
  cwd?: string;
}

type EmitAgentEvent = (event: AgentUiEvent) => void;
type Timer = ReturnType<typeof setTimeout>;

export interface CodexProcessStream {
  setEncoding(encoding: BufferEncoding): void;
  on(event: "data", listener: (chunk: string) => void): this;
}

export interface CodexProcess {
  stdout: CodexProcessStream;
  stderr: CodexProcessStream;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
  kill(signal: NodeJS.Signals): boolean;
}

export type SpawnCodexProcess = (
  commandPath: string,
  args: string[],
  options: { cwd?: string; stdio: ["ignore", "pipe", "pipe"] },
) => CodexProcess;

interface ActiveRun {
  child: CodexProcess;
  cancelled: boolean;
  activeTool: ToolKind | null;
  stdoutBuffer: string;
  sigtermTimer?: Timer;
  sigkillTimer?: Timer;
}

interface CodexContentItem {
  type?: unknown;
  text?: unknown;
}

export class CodexAdapter {
  private commandPath: string;
  private readonly spawnProcess: SpawnCodexProcess;
  private readonly stdoutBufferLimit: number;
  private readonly rawOutputLimit: number;
  private readonly sigtermDelayMs: number;
  private readonly sigkillDelayMs: number;
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(options: CodexAdapterOptions) {
    this.commandPath = options.commandPath;
    this.spawnProcess =
      options.spawnProcess ??
      ((commandPath, args, spawnOptions) =>
        spawn(commandPath, args, spawnOptions) as unknown as CodexProcess);
    this.stdoutBufferLimit = options.stdoutBufferLimit ?? DEFAULT_STDOUT_BUFFER_LIMIT;
    this.rawOutputLimit = options.rawOutputLimit ?? DEFAULT_RAW_OUTPUT_LIMIT;
    this.sigtermDelayMs = options.sigtermDelayMs ?? DEFAULT_SIGTERM_DELAY_MS;
    this.sigkillDelayMs = options.sigkillDelayMs ?? DEFAULT_SIGKILL_DELAY_MS;
  }

  setCommandPath(commandPath: string): void {
    this.commandPath = commandPath;
  }

  getCommandPath(): string {
    return this.commandPath;
  }

  runPrompt(input: CodexPromptInput, emit: EmitAgentEvent): { runId: string } {
    const runId = randomUUID();
    const args = ["--json", "--quiet", "--full-auto", input.prompt];

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
        for (const event of this.parseLine(line, Date.now(), activeRun)) {
          emit(event);
        }
      }

      if (activeRun.stdoutBuffer.length > this.stdoutBufferLimit) {
        emit({
          type: "error",
          message: "Codex stdout exceeded the buffer limit.",
          detail: `Discarded ${activeRun.stdoutBuffer.length} characters without a newline.`,
          timestamp: Date.now(),
        });
        emit({
          type: "raw_output",
          text: this.truncate(activeRun.stdoutBuffer),
          timestamp: Date.now(),
        });
        activeRun.stdoutBuffer = "";
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      emit({ type: "raw_output", text: this.truncate(chunk), timestamp: Date.now() });
    });

    child.on("error", (error) => {
      emit({ type: "error", message: error.message, timestamp: Date.now() });
    });

    child.on("close", (code) => {
      this.clearTimers(activeRun);

      if (activeRun.stdoutBuffer.length > 0) {
        for (const event of this.parseLine(activeRun.stdoutBuffer, Date.now(), activeRun)) {
          emit(event);
        }
      }

      if (activeRun.cancelled) {
        if (activeRun.activeTool) {
          emit({ type: "tool_done", status: "cancelled", timestamp: Date.now() });
        } else {
          emit({ type: "raw_output", text: "Codex run cancelled.", timestamp: Date.now() });
        }
        emit({ type: "run_done", status: "cancelled", timestamp: Date.now() });
      } else if (code !== 0 && code !== null) {
        emit({ type: "error", message: `Codex exited with code ${code}.`, timestamp: Date.now() });
        emit({ type: "run_done", status: "failed", timestamp: Date.now() });
      } else {
        emit({ type: "run_done", status: "success", timestamp: Date.now() });
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

  private parseLine(line: string, timestamp: number, run: ActiveRun): AgentUiEvent[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return [{ type: "raw_output", text: this.truncate(line), timestamp }];
    }

    if (!isRecord(parsed)) {
      return [{ type: "raw_output", text: this.truncate(line), timestamp }];
    }

    // OpenAI responses-API style: {"type":"message","role":"assistant","content":[...]}
    if (parsed.type === "message" && parsed.role === "assistant") {
      const text = extractContentText(parsed.content);
      if (text) return [{ type: "assistant_message", text: this.truncate(text), timestamp }];
    }

    // Function / tool call: {"type":"function_call","name":"shell","arguments":{...}}
    if (parsed.type === "function_call" && typeof parsed.name === "string") {
      const tool = normalizeCodexToolKind(parsed.name);
      const args = isRecord(parsed.arguments) ? parsed.arguments : {};
      const event: AgentUiEvent = { type: "tool_start", tool, timestamp };
      if ((tool === "read" || tool === "edit" || tool === "write") && typeof args.path === "string") {
        event.target = args.path;
      }
      if (tool === "bash" && typeof args.command === "string") {
        event.command = args.command;
      }
      run.activeTool = tool;
      return [event];
    }

    // Function output: {"type":"function_call_output","output":"..."}
    if (parsed.type === "function_call_output") {
      const output = typeof parsed.output === "string" ? parsed.output : JSON.stringify(parsed.output);
      run.activeTool = null;
      return [
        { type: "tool_output", text: this.truncate(output), timestamp },
        { type: "tool_done", status: "success", timestamp },
      ];
    }

    // Plain text output: {"type":"output_text","text":"..."}
    if (parsed.type === "output_text" && typeof parsed.text === "string") {
      return [{ type: "assistant_message", text: this.truncate(parsed.text), timestamp }];
    }

    return [{ type: "raw_output", text: this.truncate(line), timestamp }];
  }

  private truncate(text: string): string {
    if (text.length <= this.rawOutputLimit) return text;
    const omitted = text.length - this.rawOutputLimit;
    return `${text.slice(0, this.rawOutputLimit)}\n[Codex output truncated: ${omitted} characters omitted.]`;
  }

  private clearTimers(run: ActiveRun): void {
    if (run.sigtermTimer) clearTimeout(run.sigtermTimer);
    if (run.sigkillTimer) clearTimeout(run.sigkillTimer);
  }
}

function normalizeCodexToolKind(name: string): ToolKind {
  switch (name.toLowerCase()) {
    case "read_file":
    case "read":
      return "read";
    case "write_file":
    case "write":
      return "write";
    case "edit_file":
    case "edit":
    case "apply_patch":
      return "edit";
    case "shell":
    case "bash":
    case "execute_command":
      return "bash";
    default:
      return "unknown";
  }
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item: unknown) => {
      if (!isRecord(item)) return "";
      const ci = item as CodexContentItem;
      if (ci.type === "output_text" && typeof ci.text === "string") return ci.text;
      if (typeof ci.text === "string") return ci.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
