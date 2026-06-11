import { create } from "zustand";
import type { AgentUiEvent, RunStatus } from "../../shared/types/agent-events";
import type { ClaudeSessionGroup } from "../../shared/types/sessions";
import { getAgentHubApi } from "./agent-hub-api";
import { useConfigStore } from "./config-store";

type AgentStore = {
  events: AgentUiEvent[];
  sessions: ClaudeSessionGroup[];
  selectedSessionId?: string;
  runId?: string;
  status: RunStatus;
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  sendPrompt: (prompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  appendEvent: (event: AgentUiEvent) => void;
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  events: [],
  sessions: [],
  status: "idle",

  async loadSessions() {
    const sessions = await getAgentHubApi().listSessions();
    set({ sessions });
  },

  async selectSession(sessionId) {
    const preview = await getAgentHubApi().loadSession(sessionId);
    set({
      selectedSessionId: preview.session.id,
      events: preview.events,
      status: "idle",
      runId: undefined,
    });
  },

  async sendPrompt(prompt) {
    const text = prompt.trim();
    if (!text) return;

    const config = useConfigStore.getState().config;
    const selectedSessionId = get().selectedSessionId;
    const timestamp = Date.now();

    set((state) => ({
      events: [...state.events, { type: "user_message", text, timestamp }],
    }));

    try {
      const response = await getAgentHubApi().sendPrompt({
        prompt: text,
        sessionId: selectedSessionId,
        cwd: config?.defaultWorkingDirectory || undefined,
      });
      set({ runId: response.runId, status: "running" });
    } catch (error) {
      set((state) => ({
        status: "failed",
        events: [
          ...state.events,
          {
            type: "error",
            message: "Failed to start Claude Code.",
            detail: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          },
        ],
      }));
    }
  },

  async cancel() {
    const { runId } = get();
    if (!runId) return;

    await getAgentHubApi().cancelRun(runId);
  },

  appendEvent(event) {
    set((state) => ({
      events: [...state.events, event],
      status: statusAfterEvent(event, state.status),
      runId: shouldClearRunId(event) ? undefined : state.runId,
    }));
  },
}));

function statusAfterEvent(event: AgentUiEvent, currentStatus: RunStatus): RunStatus {
  if (event.type === "error") return "failed";

  if (event.type === "run_done") {
    if (event.status === "success") return "idle";
    if (event.status === "failed") return "failed";
    return "cancelled";
  }

  return currentStatus;
}

function shouldClearRunId(event: AgentUiEvent) {
  return event.type === "error" || event.type === "run_done";
}
