import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentUiEvent } from "../../shared/types/agent-events.js";

const DEFAULT_RAW_OUTPUT_LIMIT = 64 * 1024;
const DEFAULT_SIGTERM_DELAY_MS = 500;
const DEFAULT_SIGKILL_DELAY_MS = 2_000;

export interface HermesAdapterOptions {
  commandPath: string;
  spawnProcess?: SpawnHermesProcess;
  rawOutputLimit?: number;
  sigtermDelayMs?: number;
  sigkillDelayMs?: number;
}

export interface HermesPromptInput {
  prompt: string;
  sessionId?: string;
  cwd?: string;
}

type EmitAgentEvent = (event: AgentUiEvent) => void;
type Timer = ReturnType<typeof setTimeout>;

export interface HermesProcessStream {
  setEncoding(encoding: BufferEncoding): void;
  on(event: "data", listener: (chunk: string) => void): this;
}

export interface HermesProcess {
  stdout: HermesProcessStream;
  stderr: HermesProcessStream;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
  kill(signal: NodeJS.Signals): boolean;
}

export type SpawnHermesProcess = (
  commandPath: string,
  args: string[],
  options: { cwd?: string; stdio: ["ignore", "pipe", "pipe"] },
) => HermesProcess;

interface ActiveRun {
  child: HermesProcess;
  cancelled: boolean;
  responseBuffer: string;
  sigtermTimer?: Timer;
  sigkillTimer?: Timer;
}

export class HermesAdapter {
  private commandPath: string;
  private readonly spawnProcess: SpawnHermesProcess;
  private readonly rawOutputLimit: number;
  private readonly sigtermDelayMs: number;
  private readonly sigkillDelayMs: number;
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(options: HermesAdapterOptions) {
    this.commandPath = options.commandPath;
    this.spawnProcess =
      options.spawnProcess ??
      ((commandPath, args, spawnOptions) =>
        spawn(commandPath, args, spawnOptions) as unknown as HermesProcess);
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

  runPrompt(input: HermesPromptInput, emit: EmitAgentEvent): { runId: string } {
    const runId = randomUUID();
    const args = ["chat", "--quiet", "--yolo", "--query", input.prompt];
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
      responseBuffer: "",
    };

    this.activeRuns.set(runId, activeRun);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      activeRun.responseBuffer += chunk;
      if (activeRun.responseBuffer.length > this.rawOutputLimit) {
        const omitted = activeRun.responseBuffer.length - this.rawOutputLimit;
        emit({
          type: "assistant_message",
          text: activeRun.responseBuffer.slice(0, this.rawOutputLimit) +
            `\n[Hermes output truncated: ${omitted} characters omitted.]`,
          timestamp: Date.now(),
        });
        activeRun.responseBuffer = "";
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (_chunk: string) => {
      // stderr contains "session_id: <ID>" metadata — ignored for display
    });

    child.on("error", (error) => {
      emit({ type: "error", message: error.message, timestamp: Date.now() });
    });

    child.on("close", (code) => {
      this.clearTimers(activeRun);

      if (activeRun.cancelled) {
        emit({ type: "run_done", status: "cancelled", timestamp: Date.now() });
      } else if (code !== 0 && code !== null) {
        emit({
          type: "error",
          message: `Hermes exited with code ${code}.`,
          timestamp: Date.now(),
        });
        emit({ type: "run_done", status: "failed", timestamp: Date.now() });
      } else {
        const text = activeRun.responseBuffer.trim();
        if (text) {
          emit({ type: "assistant_message", text, timestamp: Date.now() });
        }
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

  private clearTimers(run: ActiveRun): void {
    if (run.sigtermTimer) clearTimeout(run.sigtermTimer);
    if (run.sigkillTimer) clearTimeout(run.sigkillTimer);
  }
}
