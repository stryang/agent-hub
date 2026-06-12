import type { AgentUiEvent } from "../shared/types/agent-events.js";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../shared/types/claude-config.js";
import type {
  CodexConfig,
  CodexValidationResult,
} from "../shared/types/codex-config.js";
import type {
  ClaudeSessionGroup,
  SessionPreview,
} from "../shared/types/sessions.js";
import type { RuntimeStatus } from "../shared/types/runtime-status.js";

export type AgentHubApi = {
  version: string;

  // Claude Code
  getConfig(): Promise<ClaudeConfig | null>;
  saveConfig(config: ClaudeConfig): Promise<ClaudeConfig>;
  validateClaude(commandPath: string): Promise<ClaudeValidationResult>;
  listSessions(): Promise<ClaudeSessionGroup[]>;
  loadSession(sessionId: string): Promise<SessionPreview>;
  getRuntimeStatus(cwd: string): Promise<RuntimeStatus>;
  sendPrompt(input: {
    prompt: string;
    sessionId?: string;
    cwd?: string;
  }): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<void>;
  onAgentEvent(callback: (event: AgentUiEvent) => void): () => void;

  // Codex
  getCodexConfig(): Promise<CodexConfig | null>;
  saveCodexConfig(config: CodexConfig): Promise<CodexConfig>;
  validateCodex(commandPath: string): Promise<CodexValidationResult>;
  sendCodexPrompt(input: { prompt: string; cwd?: string }): Promise<{ runId: string }>;
  cancelCodexRun(runId: string): Promise<void>;
  onCodexEvent(callback: (event: AgentUiEvent) => void): () => void;
};

declare global {
  interface Window {
    agentHub: AgentHubApi;
  }
}
