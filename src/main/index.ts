import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerClaudeIpc } from "./ipc/claude-ipc.js";
import { registerConfigIpc } from "./ipc/config-ipc.js";
import { AppConfigStore } from "./services/app-config-store.js";
import { ClaudeCodeAdapter } from "./services/claude-code-adapter.js";
import { ClaudeSessionService } from "./services/claude-session-service.js";
import { CommandValidator } from "./services/command-validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

const configStore = new AppConfigStore(app.getPath("userData"));
const claudeCodeAdapter = new ClaudeCodeAdapter({ commandPath: "claude" });

registerConfigIpc(configStore, claudeCodeAdapter);
registerClaudeIpc(
  new CommandValidator(),
  new ClaudeSessionService(),
  claudeCodeAdapter,
);

async function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    title: "Agent Hub",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function initializeClaudeCommandPath() {
  try {
    const savedConfig = await configStore.get();
    if (savedConfig) {
      claudeCodeAdapter.setCommandPath(savedConfig.commandPath);
    }
  } catch (error) {
    console.warn("Unable to load saved Agent Hub config.", error);
  }
}

app.whenReady().then(async () => {
  await initializeClaudeCommandPath();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
