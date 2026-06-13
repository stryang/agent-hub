import type { AgentHubApi } from "../../preload/global";

export function getAgentHubApi(): AgentHubApi {
  if (!("agentHub" in window) || !window.agentHub) {
    throw new Error("Agent Hub preload API is unavailable.");
  }

  return window.agentHub;
}
