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
  HermesConfig,
  HermesValidationResult,
} from "../shared/types/hermes-config.js";
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
  listCodexSessions(): Promise<ClaudeSessionGroup[]>;
  loadCodexSession(sessionId: string): Promise<SessionPreview>;
  sendCodexPrompt(input: { prompt: string; cwd?: string }): Promise<{ runId: string }>;
  cancelCodexRun(runId: string): Promise<void>;
  onCodexEvent(callback: (event: AgentUiEvent) => void): () => void;

  // Hermes
  getHermesConfig(): Promise<HermesConfig | null>;
  saveHermesConfig(config: HermesConfig): Promise<HermesConfig>;
  validateHermes(commandPath: string): Promise<HermesValidationResult>;
  listHermesSessions(): Promise<ClaudeSessionGroup[]>;
  loadHermesSession(sessionId: string): Promise<SessionPreview>;
  sendHermesPrompt(input: {
    prompt: string;
    sessionId?: string;
    cwd?: string;
  }): Promise<{ runId: string }>;
  cancelHermesRun(runId: string): Promise<void>;
  onHermesEvent(callback: (event: AgentUiEvent) => void): () => void;
};

declare global {
  interface Window {
    agentHub: AgentHubApi;
  }
}
