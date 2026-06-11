import type { AgentUiEvent } from "./agent-events.js";

export type ClaudeSession = {
  id: string;
  title: string;
  projectPath: string;
  projectName: string;
  lastModified: number;
  messageCount: number;
  gitBranch?: string;
  transcriptPath?: string;
};

export type ClaudeSessionGroup = {
  projectPath: string;
  projectName: string;
  lastModified: number;
  sessions: ClaudeSession[];
};

export type SessionPreview = {
  session: ClaudeSession;
  events: AgentUiEvent[];
};
