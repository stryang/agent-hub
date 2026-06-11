import { ipcMain } from "electron";
import type { CommandValidator } from "../services/command-validator.js";

export function registerClaudeIpc(commandValidator: CommandValidator) {
  ipcMain.handle("claude:validate", (_event, commandPath: string) =>
    commandValidator.validate(commandPath),
  );
}
