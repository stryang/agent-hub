import { ipcMain } from "electron";
import type { AppConfigStore } from "../services/app-config-store.js";

export function registerConfigIpc(configStore: AppConfigStore) {
  ipcMain.handle("config:get", () => configStore.get());
  ipcMain.handle("config:save", (_event, config) => configStore.save(config));
}
