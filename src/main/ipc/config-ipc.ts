import { ipcMain } from "electron";
import type { AppConfigStore } from "../services/app-config-store.js";
import type { ClaudeCodeAdapter } from "../services/claude-code-adapter.js";

export function registerConfigIpc(
  configStore: AppConfigStore,
  claudeCodeAdapter: ClaudeCodeAdapter,
) {
  ipcMain.handle("config:get", () => configStore.get());
  ipcMain.handle("config:save", async (_event, config) => {
    const saved = await configStore.save(config);
    claudeCodeAdapter.setCommandPath(saved.commandPath);
    return saved;
  });
}
