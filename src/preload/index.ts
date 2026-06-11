import { contextBridge, ipcRenderer } from "electron";
import type { AgentUiEvent } from "../shared/types/agent-events.js";
import type { ClaudeConfig } from "../shared/types/claude-config.js";
import type { AgentHubApi } from "./global.js";

const api: AgentHubApi = {
  version: "0.1.0",
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: ClaudeConfig) => ipcRenderer.invoke("config:save", config),
  validateClaude: (commandPath: string) =>
    ipcRenderer.invoke("claude:validate", commandPath),
  listSessions: () => ipcRenderer.invoke("claude:sessions:list"),
  loadSession: (sessionId: string) =>
    ipcRenderer.invoke("claude:sessions:load", sessionId),
  sendPrompt: (input) => ipcRenderer.invoke("claude:prompt", input),
  cancelRun: (runId: string) => ipcRenderer.invoke("claude:cancel", runId),
  onAgentEvent: (callback: (event: AgentUiEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: AgentUiEvent,
    ) => callback(payload);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
};

contextBridge.exposeInMainWorld("agentHub", api);
