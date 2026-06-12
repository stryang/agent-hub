import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerClaudeIpc } from "./ipc/claude-ipc.js";
import { registerCodexIpc } from "./ipc/codex-ipc.js";
import { registerConfigIpc } from "./ipc/config-ipc.js";
import { registerRuntimeIpc } from "./ipc/runtime-ipc.js";
import { AppConfigStore } from "./services/app-config-store.js";
import { ClaudeCodeAdapter } from "./services/claude-code-adapter.js";
import { ClaudeSessionService } from "./services/claude-session-service.js";
import { CodexAdapter } from "./services/codex-adapter.js";
import { CommandValidator } from "./services/command-validator.js";
import { RuntimeStatusService } from "./services/runtime-status-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

const configStore = new AppConfigStore(app.getPath("userData"));
const claudeCodeAdapter = new ClaudeCodeAdapter({ commandPath: "claude" });
const codexAdapter = new CodexAdapter({ commandPath: "codex" });

registerConfigIpc(configStore, claudeCodeAdapter);
registerClaudeIpc(
  new CommandValidator(),
  new ClaudeSessionService(),
  claudeCodeAdapter,
);
registerCodexIpc(configStore, new CommandValidator(), codexAdapter);
registerRuntimeIpc(new RuntimeStatusService());

async function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    title: "Agent Hub",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 17 },
    transparent: true,
    backgroundColor: "#00000000",
    vibrancy: "sidebar",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setBackgroundColor("#00000000");
  if (process.platform === "darwin") {
    win.setVibrancy("sidebar");
    win.setWindowButtonPosition({ x: 18, y: 17 });
  }

  const repaint = () => {
    win.webContents.invalidate();
  };
  const setDockTransition = (enabled: boolean) => {
    const action = enabled ? "add" : "remove";
    void win.webContents
      .executeJavaScript(
        `document.documentElement.classList.${action}("dock-transition")`,
        true,
      )
      .catch(() => undefined);
  };
  win.on("minimize", () => {
    setDockTransition(true);
    repaint();
  });
  win.on("restore", () => {
    repaint();
    setTimeout(() => setDockTransition(false), 320);
  });
  win.on("show", () => {
    repaint();
    setTimeout(() => setDockTransition(false), 120);
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function initializeCommandPaths() {
  try {
    const claudeConfig = await configStore.get();
    if (claudeConfig) {
      claudeCodeAdapter.setCommandPath(claudeConfig.commandPath);
    }
  } catch (error) {
    console.warn("Unable to load saved Claude config.", error);
  }

  try {
    const codexConfig = await configStore.getCodex();
    if (codexConfig) {
      codexAdapter.setCommandPath(codexConfig.commandPath);
    }
  } catch (error) {
    console.warn("Unable to load saved Codex config.", error);
  }
}

app.whenReady().then(async () => {
  await initializeCommandPaths();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
