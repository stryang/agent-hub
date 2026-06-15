import { ipcMain } from "electron";
import path from "node:path";
import type { AgentKind } from "../../shared/types/agent-events.js";
import type { CommandService } from "../services/command-service.js";

const VALID_AGENTS = new Set<string>(["claude-code", "codex", "hermes"]);
const MAX_CWD_LENGTH = 4_096;

export function registerCommandIpc(commandService: CommandService) {
  ipcMain.handle("commands:list", (_event, agent: unknown, cwd: unknown) => {
    if (typeof agent !== "string" || !VALID_AGENTS.has(agent)) {
      throw new Error("commands:list — invalid agent");
    }

    let resolvedCwd: string | undefined;
    if (
      typeof cwd === "string" &&
      cwd.length <= MAX_CWD_LENGTH &&
      path.isAbsolute(cwd.trim())
    ) {
      resolvedCwd = cwd.trim();
    }

    return commandService.listCommands(agent as AgentKind, resolvedCwd);
  });
}
