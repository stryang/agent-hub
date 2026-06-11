import { create } from "zustand";
import type { AgentUiEvent, RunStatus } from "../../shared/types/agent-events";
import type { ClaudeSessionGroup } from "../../shared/types/sessions";
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
    const sessions = await window.agentHub.listSessions();
    set({ sessions });
  },

  async selectSession(sessionId) {
    const preview = await window.agentHub.loadSession(sessionId);
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
      status: "running",
    }));

    try {
      const response = await window.agentHub.sendPrompt({
        prompt: text,
        sessionId: selectedSessionId,
        cwd: config?.defaultWorkingDirectory || undefined,
      });
      set({ runId: response.runId });
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
    if (!runId) {
      set({ status: "cancelled" });
      return;
    }

    await window.agentHub.cancelRun(runId);
    set({ status: "cancelled", runId: undefined });
  },

  appendEvent(event) {
    set((state) => ({
      events: [...state.events, event],
      status: event.type === "error" ? "failed" : state.status,
    }));
  },
}));
