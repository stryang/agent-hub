import { contextBridge, ipcRenderer } from "electron";
import type { AgentUiEvent } from "../shared/types/agent-events.js";
import type { ClaudeConfig } from "../shared/types/claude-config.js";
import type { CodexConfig } from "../shared/types/codex-config.js";
import type { HermesConfig } from "../shared/types/hermes-config.js";
import type { AgentHubApi } from "./global.js";

const api: AgentHubApi = {
  version: "0.1.0",
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke("shell:show-item-in-folder", filePath),

  // Claude Code
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: ClaudeConfig) => ipcRenderer.invoke("config:save", config),
  validateClaude: (commandPath: string) =>
    ipcRenderer.invoke("claude:validate", commandPath),
  listSessions: () => ipcRenderer.invoke("claude:sessions:list"),
  loadSession: (sessionId: string) =>
    ipcRenderer.invoke("claude:sessions:load", sessionId),
  getRuntimeStatus: (cwd: string) => ipcRenderer.invoke("runtime:status", cwd),
  listAgentCommands: (agent, cwd) => ipcRenderer.invoke("commands:list", agent, cwd),
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

  // Codex
  getCodexConfig: () => ipcRenderer.invoke("codex:config:get"),
  saveCodexConfig: (config: CodexConfig) =>
    ipcRenderer.invoke("codex:config:save", config),
  validateCodex: (commandPath: string) =>
    ipcRenderer.invoke("codex:validate", commandPath),
  listCodexSessions: () => ipcRenderer.invoke("codex:sessions:list"),
  loadCodexSession: (sessionId: string) =>
    ipcRenderer.invoke("codex:sessions:load", sessionId),
  sendCodexPrompt: (input) => ipcRenderer.invoke("codex:prompt", input),
  cancelCodexRun: (runId: string) => ipcRenderer.invoke("codex:cancel", runId),
  onCodexEvent: (callback: (event: AgentUiEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: AgentUiEvent,
    ) => callback(payload);
    ipcRenderer.on("codex:event", listener);
    return () => ipcRenderer.removeListener("codex:event", listener);
  },

  // Hermes
  getHermesConfig: () => ipcRenderer.invoke("hermes:config:get"),
  saveHermesConfig: (config: HermesConfig) =>
    ipcRenderer.invoke("hermes:config:save", config),
  validateHermes: (commandPath: string) =>
    ipcRenderer.invoke("hermes:validate", commandPath),
  listHermesSessions: () => ipcRenderer.invoke("hermes:sessions:list"),
  loadHermesSession: (sessionId: string) =>
    ipcRenderer.invoke("hermes:sessions:load", sessionId),
  sendHermesPrompt: (input) => ipcRenderer.invoke("hermes:prompt", input),
  cancelHermesRun: (runId: string) => ipcRenderer.invoke("hermes:cancel", runId),
  onHermesEvent: (callback: (event: AgentUiEvent) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: AgentUiEvent,
    ) => callback(payload);
    ipcRenderer.on("hermes:event", listener);
    return () => ipcRenderer.removeListener("hermes:event", listener);
  },
};

contextBridge.exposeInMainWorld("agentHub", api);
