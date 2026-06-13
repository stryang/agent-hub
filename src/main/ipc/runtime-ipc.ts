import { ipcMain } from "electron";
import type { RuntimeStatusService } from "../services/runtime-status-service.js";

const MAX_CWD_LENGTH = 4_096;

export function registerRuntimeIpc(runtimeStatusService: RuntimeStatusService) {
  ipcMain.handle("runtime:status", (_event, cwd: unknown) => {
    if (typeof cwd !== "string") {
      throw new Error("Runtime status cwd must be a string.");
    }

    const trimmed = cwd.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CWD_LENGTH) {
      throw new Error("Runtime status cwd is invalid.");
    }

    return runtimeStatusService.getStatus(trimmed);
  });
}
