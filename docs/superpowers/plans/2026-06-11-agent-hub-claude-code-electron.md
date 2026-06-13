# Agent Hub Claude Code Electron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Agent Hub milestone: an Electron macOS desktop app that configures local Claude Code, loads Claude sessions, runs Claude with structured output, and renders the existing Agent Hub UI.

**Architecture:** Electron owns process execution, filesystem access, config storage, Claude session indexing, and git diff collection in the main process. React owns rendering and state in the renderer, with a preload bridge exposing a narrow typed IPC surface. Claude Code remains the source of truth for agent behavior and conversation state.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Testing Library, Node `child_process`, local JSON config, CSS adapted from `agent-hub-export.html`.

---

## File Structure

Create this structure during the plan:

```txt
package.json
package-lock.json
index.html
vite.config.ts
vitest.config.ts
tsconfig.json
tsconfig.node.json
src/
  main/
    index.ts
    ipc/
      claude-ipc.ts
      config-ipc.ts
    services/
      app-config-store.ts
      claude-code-adapter.ts
      claude-session-service.ts
      command-validator.ts
      git-diff-service.ts
  preload/
    index.ts
  renderer/
    App.tsx
    main.tsx
    components/
      CliSelector.tsx
      Composer.tsx
      DiffViewer.tsx
      SettingsDialog.tsx
      Sidebar.tsx
      StatusBar.tsx
      Thread.tsx
      ToolCard.tsx
    state/
      agent-store.ts
      config-store.ts
    styles/
      app.css
      theme.css
    test/
      setup.ts
  shared/
    types/
      agent-events.ts
      claude-config.ts
      sessions.ts
tests/
  fixtures/
    claude-stream.jsonl
    claude-transcript.jsonl
  main/
    app-config-store.test.ts
    claude-code-adapter.test.ts
    claude-session-service.test.ts
    command-validator.test.ts
    git-diff-service.test.ts
  renderer/
    thread.test.tsx
```

Responsibilities:

- `src/main/index.ts`: Electron app lifecycle and window creation.
- `src/preload/index.ts`: safe typed bridge exposed as `window.agentHub`.
- `src/main/ipc/*`: IPC handlers; no business logic.
- `src/main/services/*`: command validation, config persistence, Claude integration, session indexing, diff collection.
- `src/shared/types/*`: main/preload/renderer shared contracts.
- `src/renderer/components/*`: visual UI only.
- `src/renderer/state/*`: renderer state reducers and IPC calls.

---

### Task 1: Scaffold Electron, React, TypeScript, and Tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/test/setup.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agent-hub",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.node.json && vite build",
    "build:main": "tsc -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^6.0.2",
    "electron": "^42.4.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^25.9.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Create TypeScript and Vite config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src/renderer", "src/shared", "src/preload"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/main", "src/preload", "src/shared"]
}
```

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
```

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/renderer/test/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Create the minimal renderer**

`index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Hub</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

`src/renderer/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/renderer/App.tsx`:

```tsx
export function App() {
  return <div>Agent Hub</div>;
}
```

`src/renderer/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create minimal Electron main and preload**

`src/main/index.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

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
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

`src/preload/index.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("agentHub", {
  version: "0.1.0",
});
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: scaffold electron react app"
```

---

### Task 2: Define Shared Types and Preload API Contract

**Files:**
- Create: `src/shared/types/agent-events.ts`
- Create: `src/shared/types/claude-config.ts`
- Create: `src/shared/types/sessions.ts`
- Modify: `src/preload/index.ts`
- Create: `src/preload/global.d.ts`
- Test: `tests/main/shared-types.test.ts`

- [ ] **Step 1: Add shared event types**

`src/shared/types/agent-events.ts`:

```ts
export type ToolKind = "read" | "edit" | "write" | "bash" | "unknown";

export type ToolStatus = "success" | "failed" | "cancelled";

export type AgentUiEvent =
  | { type: "user_message"; text: string; timestamp: number }
  | { type: "assistant_message"; text: string; partial?: boolean; timestamp: number }
  | {
      type: "tool_start";
      tool: ToolKind;
      target?: string;
      command?: string;
      timestamp: number;
    }
  | { type: "tool_output"; text: string; timestamp: number }
  | { type: "tool_done"; status: ToolStatus; timestamp: number }
  | { type: "diff"; filePath: string; unifiedDiff: string; timestamp: number }
  | { type: "permission_prompt"; text: string; choices?: string[]; timestamp: number }
  | { type: "raw_output"; text: string; timestamp: number }
  | { type: "error"; message: string; detail?: string; timestamp: number };

export type RunStatus = "idle" | "running" | "failed" | "cancelled";
```

- [ ] **Step 2: Add config and session types**

`src/shared/types/claude-config.ts`:

```ts
export type ClaudeConfig = {
  commandPath: string;
  defaultWorkingDirectory: string;
};

export type ClaudeValidationResult =
  | {
      ok: true;
      commandPath: string;
      version: string;
      authenticated: true;
    }
  | {
      ok: false;
      commandPath: string;
      code:
        | "missing"
        | "not_executable"
        | "version_failed"
        | "auth_failed"
        | "unsupported";
      message: string;
      detail?: string;
    };
```

`src/shared/types/sessions.ts`:

```ts
import type { AgentUiEvent } from "./agent-events";

export type ClaudeSession = {
  id: string;
  title: string;
  projectPath: string;
  projectName: string;
  lastModified: number;
  messageCount: number;
  gitBranch?: string;
  transcriptPath?: string;
};

export type ClaudeSessionGroup = {
  projectPath: string;
  projectName: string;
  lastModified: number;
  sessions: ClaudeSession[];
};

export type SessionPreview = {
  session: ClaudeSession;
  events: AgentUiEvent[];
};
```

- [ ] **Step 3: Define preload API type**

`src/preload/global.d.ts`:

```ts
import type { AgentUiEvent } from "../shared/types/agent-events";
import type { ClaudeConfig, ClaudeValidationResult } from "../shared/types/claude-config";
import type { ClaudeSessionGroup, SessionPreview } from "../shared/types/sessions";

export type AgentHubApi = {
  version: string;
  getConfig(): Promise<ClaudeConfig | null>;
  saveConfig(config: ClaudeConfig): Promise<ClaudeConfig>;
  validateClaude(commandPath: string): Promise<ClaudeValidationResult>;
  listSessions(): Promise<ClaudeSessionGroup[]>;
  loadSession(sessionId: string): Promise<SessionPreview>;
  sendPrompt(input: { prompt: string; sessionId?: string; cwd?: string }): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<void>;
  onAgentEvent(callback: (event: AgentUiEvent) => void): () => void;
};

declare global {
  interface Window {
    agentHub: AgentHubApi;
  }
}
```

- [ ] **Step 4: Update preload implementation**

`src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AgentUiEvent } from "../shared/types/agent-events";
import type { ClaudeConfig } from "../shared/types/claude-config";
import type { AgentHubApi } from "./global";

const api: AgentHubApi = {
  version: "0.1.0",
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: ClaudeConfig) => ipcRenderer.invoke("config:save", config),
  validateClaude: (commandPath: string) => ipcRenderer.invoke("claude:validate", commandPath),
  listSessions: () => ipcRenderer.invoke("claude:sessions:list"),
  loadSession: (sessionId: string) => ipcRenderer.invoke("claude:sessions:load", sessionId),
  sendPrompt: (input) => ipcRenderer.invoke("claude:prompt", input),
  cancelRun: (runId: string) => ipcRenderer.invoke("claude:cancel", runId),
  onAgentEvent: (callback: (event: AgentUiEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AgentUiEvent) => callback(payload);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
};

contextBridge.exposeInMainWorld("agentHub", api);
```

- [ ] **Step 5: Add type smoke test**

`tests/main/shared-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AgentUiEvent } from "../../src/shared/types/agent-events";

describe("AgentUiEvent", () => {
  it("accepts a tool start event", () => {
    const event: AgentUiEvent = {
      type: "tool_start",
      tool: "read",
      target: "README.md",
      timestamp: 1,
    };

    expect(event.type).toBe("tool_start");
  });
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/shared src/preload tests/main/shared-types.test.ts
git commit -m "feat: define agent hub ipc contracts"
```

---

### Task 3: Implement App Config Store

**Files:**
- Create: `src/main/services/app-config-store.ts`
- Create: `src/main/ipc/config-ipc.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/app-config-store.test.ts`

- [ ] **Step 1: Write failing config store tests**

`tests/main/app-config-store.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppConfigStore } from "../../src/main/services/app-config-store";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-config-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("AppConfigStore", () => {
  it("returns null when config has not been saved", async () => {
    const store = new AppConfigStore(tempDir);

    await expect(store.get()).resolves.toBeNull();
  });

  it("saves and reads Claude config", async () => {
    const store = new AppConfigStore(tempDir);

    await store.save({
      commandPath: "/opt/homebrew/bin/claude",
      defaultWorkingDirectory: "/Users/leo/IdeaProjects/yang/agent-hub",
    });

    await expect(store.get()).resolves.toEqual({
      commandPath: "/opt/homebrew/bin/claude",
      defaultWorkingDirectory: "/Users/leo/IdeaProjects/yang/agent-hub",
    });
  });

  it("throws a clear error for corrupt JSON", async () => {
    await fs.writeFile(path.join(tempDir, "config.json"), "{bad json", "utf8");
    const store = new AppConfigStore(tempDir);

    await expect(store.get()).rejects.toThrow("Agent Hub config is not valid JSON");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/app-config-store.test.ts
```

Expected: FAIL because `app-config-store.ts` does not exist.

- [ ] **Step 3: Implement config store**

`src/main/services/app-config-store.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { ClaudeConfig } from "../../shared/types/claude-config";

export class AppConfigStore {
  private readonly filePath: string;

  constructor(private readonly userDataDir: string) {
    this.filePath = path.join(userDataDir, "config.json");
  }

  async get(): Promise<ClaudeConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ClaudeConfig>;
      if (typeof parsed.commandPath !== "string" || typeof parsed.defaultWorkingDirectory !== "string") {
        throw new Error("Agent Hub config has invalid shape");
      }
      return {
        commandPath: parsed.commandPath,
        defaultWorkingDirectory: parsed.defaultWorkingDirectory,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        throw new Error("Agent Hub config is not valid JSON");
      }
      throw error;
    }
  }

  async save(config: ClaudeConfig): Promise<ClaudeConfig> {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), "utf8");
    return config;
  }
}
```

- [ ] **Step 4: Add config IPC**

`src/main/ipc/config-ipc.ts`:

```ts
import { ipcMain } from "electron";
import type { AppConfigStore } from "../services/app-config-store";

export function registerConfigIpc(configStore: AppConfigStore) {
  ipcMain.handle("config:get", () => configStore.get());
  ipcMain.handle("config:save", (_event, config) => configStore.save(config));
}
```

Modify `src/main/index.ts` to register config IPC:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerConfigIpc } from "./ipc/config-ipc";
import { AppConfigStore } from "./services/app-config-store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

registerConfigIpc(new AppConfigStore(app.getPath("userData")));

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
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/main/app-config-store.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/app-config-store.ts src/main/ipc/config-ipc.ts src/main/index.ts tests/main/app-config-store.test.ts
git commit -m "feat: persist claude app configuration"
```

---

### Task 4: Implement Claude Command Validation

**Files:**
- Create: `src/main/services/command-validator.ts`
- Create: `src/main/ipc/claude-ipc.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/command-validator.test.ts`

- [ ] **Step 1: Write failing validator tests**

`tests/main/command-validator.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandValidator } from "../../src/main/services/command-validator";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-command-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("CommandValidator", () => {
  it("reports missing command path", async () => {
    const validator = new CommandValidator(async () => ({ code: 0, stdout: "", stderr: "" }));

    await expect(validator.validate("/missing/claude")).resolves.toMatchObject({
      ok: false,
      code: "missing",
    });
  });

  it("reports non executable command path", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o644);
    const validator = new CommandValidator(async () => ({ code: 0, stdout: "", stderr: "" }));

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "not_executable",
    });
  });

  it("validates version and auth status", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o755);
    const runner = vi.fn(async (_command: string, args: string[]) => {
      if (args.includes("--version")) return { code: 0, stdout: "1.2.3\n", stderr: "" };
      if (args[0] === "auth" && args[1] === "status") return { code: 0, stdout: "Logged in\n", stderr: "" };
      return { code: 1, stdout: "", stderr: "unexpected" };
    });
    const validator = new CommandValidator(runner);

    await expect(validator.validate(file)).resolves.toEqual({
      ok: true,
      commandPath: file,
      version: "1.2.3",
      authenticated: true,
    });
  });

  it("reports auth failure", async () => {
    const file = path.join(tempDir, "claude");
    await fs.writeFile(file, "#!/bin/sh\n", "utf8");
    await fs.chmod(file, 0o755);
    const validator = new CommandValidator(async (_command, args) => {
      if (args.includes("--version")) return { code: 0, stdout: "1.2.3\n", stderr: "" };
      return { code: 1, stdout: "", stderr: "not logged in" };
    });

    await expect(validator.validate(file)).resolves.toMatchObject({
      ok: false,
      code: "auth_failed",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/command-validator.test.ts
```

Expected: FAIL because `command-validator.ts` does not exist.

- [ ] **Step 3: Implement validator**

`src/main/services/command-validator.ts`:

```ts
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type { ClaudeValidationResult } from "../../shared/types/claude-config";

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

function defaultRunner(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export class CommandValidator {
  constructor(private readonly runner: CommandRunner = defaultRunner) {}

  async validate(commandPath: string): Promise<ClaudeValidationResult> {
    try {
      await fs.access(commandPath);
    } catch {
      return {
        ok: false,
        commandPath,
        code: "missing",
        message: "Claude command path does not exist.",
      };
    }

    try {
      await fs.access(commandPath, fs.constants.X_OK);
    } catch {
      return {
        ok: false,
        commandPath,
        code: "not_executable",
        message: "Claude command path is not executable.",
      };
    }

    const version = await this.runner(commandPath, ["--version"]);
    if (version.code !== 0) {
      return {
        ok: false,
        commandPath,
        code: "version_failed",
        message: "Claude version check failed.",
        detail: version.stderr || version.stdout,
      };
    }

    const auth = await this.runner(commandPath, ["auth", "status"]);
    if (auth.code !== 0) {
      return {
        ok: false,
        commandPath,
        code: "auth_failed",
        message: "Claude Code is not authenticated.",
        detail: auth.stderr || auth.stdout,
      };
    }

    return {
      ok: true,
      commandPath,
      version: version.stdout.trim(),
      authenticated: true,
    };
  }
}
```

- [ ] **Step 4: Register Claude validation IPC**

`src/main/ipc/claude-ipc.ts`:

```ts
import { ipcMain } from "electron";
import type { CommandValidator } from "../services/command-validator";

export function registerClaudeIpc(commandValidator: CommandValidator) {
  ipcMain.handle("claude:validate", (_event, commandPath: string) => {
    return commandValidator.validate(commandPath);
  });
}
```

Modify `src/main/index.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerClaudeIpc } from "./ipc/claude-ipc";
import { registerConfigIpc } from "./ipc/config-ipc";
import { AppConfigStore } from "./services/app-config-store";
import { CommandValidator } from "./services/command-validator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

registerConfigIpc(new AppConfigStore(app.getPath("userData")));
registerClaudeIpc(new CommandValidator());

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
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/main/command-validator.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/command-validator.ts src/main/ipc/claude-ipc.ts src/main/index.ts tests/main/command-validator.test.ts
git commit -m "feat: validate local claude command"
```

---

### Task 5: Implement Claude Session Indexing

**Files:**
- Create: `src/main/services/claude-session-service.ts`
- Modify: `src/main/ipc/claude-ipc.ts`
- Modify: `src/main/index.ts`
- Create: `tests/fixtures/claude-transcript.jsonl`
- Test: `tests/main/claude-session-service.test.ts`

- [ ] **Step 1: Add transcript fixture**

`tests/fixtures/claude-transcript.jsonl`:

```jsonl
{"type":"summary","summary":"重构 CLI 切换模块","leafUuid":"11111111-1111-4111-8111-111111111111"}
{"uuid":"22222222-2222-4222-8222-222222222222","sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:00:00.000Z","type":"user","message":{"role":"user","content":"重构 CLI 切换模块"}}
{"uuid":"33333333-3333-4333-8333-333333333333","sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:01:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"我会先读取相关文件。"}]}}
```

- [ ] **Step 2: Write failing session service tests**

`tests/main/claude-session-service.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeSessionService } from "../../src/main/services/claude-session-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-sessions-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function writeTranscript(projectKey: string, fileName: string, content: string) {
  const dir = path.join(tempDir, "projects", projectKey);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), content, "utf8");
}

describe("ClaudeSessionService", () => {
  it("groups sessions by project and derives titles", async () => {
    await writeTranscript(
      "-Users-leo-IdeaProjects-yang-agent-hub",
      "11111111-1111-4111-8111-111111111111.jsonl",
      [
        '{"type":"summary","summary":"重构 CLI 切换模块"}',
        '{"sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:00:00.000Z","type":"user","message":{"role":"user","content":"重构 CLI 切换模块"}}',
      ].join("\\n"),
    );

    const service = new ClaudeSessionService(tempDir);
    const groups = await service.listSessions();

    expect(groups).toEqual([
      {
        projectPath: "/Users/leo/IdeaProjects/yang/agent-hub",
        projectName: "agent-hub",
        lastModified: Date.parse("2026-06-11T08:00:00.000Z"),
        sessions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "重构 CLI 切换模块",
            projectPath: "/Users/leo/IdeaProjects/yang/agent-hub",
            projectName: "agent-hub",
            lastModified: Date.parse("2026-06-11T08:00:00.000Z"),
            messageCount: 1,
            transcriptPath: path.join(
              tempDir,
              "projects",
              "-Users-leo-IdeaProjects-yang-agent-hub",
              "11111111-1111-4111-8111-111111111111.jsonl",
            ),
          },
        ],
      },
    ]);
  });

  it("loads a session preview as UI events", async () => {
    await writeTranscript(
      "-Users-leo-IdeaProjects-yang-agent-hub",
      "11111111-1111-4111-8111-111111111111.jsonl",
      [
        '{"type":"summary","summary":"重构 CLI 切换模块"}',
        '{"sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:00:00.000Z","type":"user","message":{"role":"user","content":"重构 CLI 切换模块"}}',
        '{"sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:01:00.000Z","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"我会先读取相关文件。"}]}}',
      ].join("\\n"),
    );

    const service = new ClaudeSessionService(tempDir);
    const preview = await service.loadSession("11111111-1111-4111-8111-111111111111");

    expect(preview.events).toEqual([
      { type: "user_message", text: "重构 CLI 切换模块", timestamp: Date.parse("2026-06-11T08:00:00.000Z") },
      {
        type: "assistant_message",
        text: "我会先读取相关文件。",
        timestamp: Date.parse("2026-06-11T08:01:00.000Z"),
      },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/claude-session-service.test.ts
```

Expected: FAIL because `claude-session-service.ts` does not exist.

- [ ] **Step 4: Implement session service**

`src/main/services/claude-session-service.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentUiEvent } from "../../shared/types/agent-events";
import type { ClaudeSession, ClaudeSessionGroup, SessionPreview } from "../../shared/types/sessions";

type TranscriptMeta = {
  session: ClaudeSession;
  events: AgentUiEvent[];
};

export class ClaudeSessionService {
  constructor(private readonly claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")) {}

  async listSessions(): Promise<ClaudeSessionGroup[]> {
    const metas = await this.readAllTranscripts();
    const groups = new Map<string, ClaudeSessionGroup>();

    for (const meta of metas) {
      const existing = groups.get(meta.session.projectPath);
      if (existing) {
        existing.sessions.push(meta.session);
        existing.lastModified = Math.max(existing.lastModified, meta.session.lastModified);
      } else {
        groups.set(meta.session.projectPath, {
          projectPath: meta.session.projectPath,
          projectName: meta.session.projectName,
          lastModified: meta.session.lastModified,
          sessions: [meta.session],
        });
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort((a, b) => b.lastModified - a.lastModified),
      }))
      .sort((a, b) => b.lastModified - a.lastModified);
  }

  async loadSession(sessionId: string): Promise<SessionPreview> {
    const metas = await this.readAllTranscripts();
    const meta = metas.find((item) => item.session.id === sessionId);
    if (!meta) throw new Error(`Claude session not found: ${sessionId}`);
    return {
      session: meta.session,
      events: meta.events,
    };
  }

  private async readAllTranscripts(): Promise<TranscriptMeta[]> {
    const projectsDir = path.join(this.claudeConfigDir, "projects");
    let projectDirs: string[];
    try {
      projectDirs = await fs.readdir(projectsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const metas: TranscriptMeta[] = [];
    for (const projectDir of projectDirs) {
      const fullProjectDir = path.join(projectsDir, projectDir);
      const stat = await fs.stat(fullProjectDir);
      if (!stat.isDirectory()) continue;
      const files = await fs.readdir(fullProjectDir);
      for (const file of files.filter((name) => name.endsWith(".jsonl"))) {
        const transcriptPath = path.join(fullProjectDir, file);
        const meta = await this.readTranscript(transcriptPath);
        if (meta) metas.push(meta);
      }
    }

    return metas;
  }

  private async readTranscript(transcriptPath: string): Promise<TranscriptMeta | null> {
    const raw = await fs.readFile(transcriptPath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    let summary = "";
    let sessionId = path.basename(transcriptPath, ".jsonl");
    let projectPath = "";
    let lastModified = 0;
    let messageCount = 0;
    const events: AgentUiEvent[] = [];

    for (const line of lines) {
      const record = JSON.parse(line) as Record<string, unknown>;
      if (typeof record.summary === "string" && !summary) summary = record.summary;
      if (typeof record.sessionId === "string") sessionId = record.sessionId;
      if (typeof record.cwd === "string") projectPath = record.cwd;
      const timestamp = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : 0;
      if (timestamp) lastModified = Math.max(lastModified, timestamp);

      const message = record.message as { role?: string; content?: unknown } | undefined;
      if (!message?.role) continue;
      messageCount += 1;

      if (message.role === "user") {
        const text = typeof message.content === "string" ? message.content : "";
        events.push({ type: "user_message", text, timestamp });
      }

      if (message.role === "assistant") {
        const text = extractAssistantText(message.content);
        if (text) events.push({ type: "assistant_message", text, timestamp });
      }
    }

    if (!projectPath) return null;

    const title = summary || firstUserText(events) || "Untitled Session";
    const projectName = path.basename(projectPath);

    return {
      session: {
        id: sessionId,
        title,
        projectPath,
        projectName,
        lastModified,
        messageCount,
        transcriptPath,
      },
      events,
    };
  }
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function firstUserText(events: AgentUiEvent[]): string {
  const first = events.find((event) => event.type === "user_message");
  return first?.type === "user_message" ? first.text : "";
}
```

- [ ] **Step 5: Wire session IPC**

Modify `src/main/ipc/claude-ipc.ts`:

```ts
import { ipcMain } from "electron";
import type { ClaudeSessionService } from "../services/claude-session-service";
import type { CommandValidator } from "../services/command-validator";

export function registerClaudeIpc(commandValidator: CommandValidator, sessionService: ClaudeSessionService) {
  ipcMain.handle("claude:validate", (_event, commandPath: string) => {
    return commandValidator.validate(commandPath);
  });
  ipcMain.handle("claude:sessions:list", () => sessionService.listSessions());
  ipcMain.handle("claude:sessions:load", (_event, sessionId: string) => sessionService.loadSession(sessionId));
}
```

Modify `src/main/index.ts` to instantiate `ClaudeSessionService`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerClaudeIpc } from "./ipc/claude-ipc";
import { registerConfigIpc } from "./ipc/config-ipc";
import { AppConfigStore } from "./services/app-config-store";
import { ClaudeSessionService } from "./services/claude-session-service";
import { CommandValidator } from "./services/command-validator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";

registerConfigIpc(new AppConfigStore(app.getPath("userData")));
registerClaudeIpc(new CommandValidator(), new ClaudeSessionService());

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
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/main/claude-session-service.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/claude-session-service.ts src/main/ipc/claude-ipc.ts src/main/index.ts tests/fixtures/claude-transcript.jsonl tests/main/claude-session-service.test.ts
git commit -m "feat: index claude code sessions"
```

---

### Task 6: Implement Git Diff Service

**Files:**
- Create: `src/main/services/git-diff-service.ts`
- Test: `tests/main/git-diff-service.test.ts`

- [ ] **Step 1: Write failing git diff tests**

`tests/main/git-diff-service.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitDiffService } from "../../src/main/services/git-diff-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-git-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("GitDiffService", () => {
  it("returns null outside a git repository", async () => {
    const service = new GitDiffService();

    await expect(service.diffFile(tempDir, "README.md")).resolves.toBeNull();
  });

  it("returns unified diff for a modified tracked file", async () => {
    const service = new GitDiffService();
    await service.run("git", ["init"], tempDir);
    await service.run("git", ["config", "user.email", "test@example.com"], tempDir);
    await service.run("git", ["config", "user.name", "Test User"], tempDir);
    await fs.writeFile(path.join(tempDir, "README.md"), "old\n", "utf8");
    await service.run("git", ["add", "README.md"], tempDir);
    await service.run("git", ["commit", "-m", "initial"], tempDir);
    await fs.writeFile(path.join(tempDir, "README.md"), "new\n", "utf8");

    const diff = await service.diffFile(tempDir, "README.md");

    expect(diff).toContain("--- a/README.md");
    expect(diff).toContain("+++ b/README.md");
    expect(diff).toContain("-old");
    expect(diff).toContain("+new");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/git-diff-service.test.ts
```

Expected: FAIL because `git-diff-service.ts` does not exist.

- [ ] **Step 3: Implement git diff service**

`src/main/services/git-diff-service.ts`:

```ts
import { spawn } from "node:child_process";

type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export class GitDiffService {
  async diffFile(cwd: string, filePath: string): Promise<string | null> {
    const root = await this.run("git", ["rev-parse", "--show-toplevel"], cwd);
    if (root.code !== 0) return null;

    const diff = await this.run("git", ["diff", "--", filePath], cwd);
    if (diff.code !== 0) return null;
    return diff.stdout.trim() ? diff.stdout : null;
  }

  run(command: string, args: string[], cwd: string): Promise<RunResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        resolve({ code: 1, stdout, stderr: error.message });
      });
      child.on("close", (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/main/git-diff-service.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/git-diff-service.ts tests/main/git-diff-service.test.ts
git commit -m "feat: collect git diffs for edited files"
```

---

### Task 7: Implement Claude Code Adapter

**Files:**
- Create: `src/main/services/claude-code-adapter.ts`
- Modify: `src/main/ipc/claude-ipc.ts`
- Modify: `src/main/index.ts`
- Create: `tests/fixtures/claude-stream.jsonl`
- Test: `tests/main/claude-code-adapter.test.ts`

- [ ] **Step 1: Add stream fixture**

`tests/fixtures/claude-stream.jsonl`:

```jsonl
{"type":"assistant","message":{"content":[{"type":"text","text":"我会先读取 README。"}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"README.md"}}]}}
{"type":"user","message":{"content":[{"type":"tool_result","content":"# Agent Hub"}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"npm test"}}]}}
{"type":"user","message":{"content":[{"type":"tool_result","content":"Tests passed"}]}}
{"type":"result","session_id":"11111111-1111-4111-8111-111111111111"}
```

- [ ] **Step 2: Write failing adapter tests**

`tests/main/claude-code-adapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/main/services/claude-code-adapter";

describe("ClaudeCodeAdapter", () => {
  it("maps stream-json lines into UI events", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "/bin/echo" });
    const lines = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"我会先读取 README。"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"README.md"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","content":"# Agent Hub"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"npm test"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","content":"Tests passed"}]}}',
    ];

    const events = lines.flatMap((line) => adapter.parseLine(line, 1000));

    expect(events).toEqual([
      { type: "assistant_message", text: "我会先读取 README。", timestamp: 1000 },
      { type: "tool_start", tool: "read", target: "README.md", timestamp: 1000 },
      { type: "tool_output", text: "# Agent Hub", timestamp: 1000 },
      { type: "tool_done", status: "success", timestamp: 1000 },
      { type: "tool_start", tool: "bash", command: "npm test", timestamp: 1000 },
      { type: "tool_output", text: "Tests passed", timestamp: 1000 },
      { type: "tool_done", status: "success", timestamp: 1000 },
    ]);
  });

  it("falls back to raw output for unknown JSON", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "/bin/echo" });

    expect(adapter.parseLine('{"unexpected":true}', 1000)).toEqual([
      { type: "raw_output", text: '{"unexpected":true}', timestamp: 1000 },
    ]);
  });

  it("falls back to raw output for invalid JSON", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "/bin/echo" });

    expect(adapter.parseLine("not-json", 1000)).toEqual([
      { type: "raw_output", text: "not-json", timestamp: 1000 },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/claude-code-adapter.test.ts
```

Expected: FAIL because `claude-code-adapter.ts` does not exist.

- [ ] **Step 4: Implement adapter parser and runner**

`src/main/services/claude-code-adapter.ts`:

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AgentUiEvent, ToolKind } from "../../shared/types/agent-events";

export type ClaudeCodeAdapterOptions = {
  commandPath: string;
};

export type PromptInput = {
  prompt: string;
  sessionId?: string;
  cwd?: string;
};

export class ClaudeCodeAdapter {
  private activeRuns = new Map<string, ChildProcessWithoutNullStreams>();
  private activeTool: ToolKind | null = null;

  constructor(private readonly options: ClaudeCodeAdapterOptions) {}

  runPrompt(input: PromptInput, emit: (event: AgentUiEvent) => void): { runId: string } {
    const runId = randomUUID();
    const args = ["-p", input.prompt, "--output-format", "stream-json", "--verbose"];
    if (input.sessionId) args.push("--resume", input.sessionId);

    const child = spawn(this.options.commandPath, args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.activeRuns.set(runId, child);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let buffer = "";
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        for (const event of this.parseLine(line, Date.now())) emit(event);
      }
    });

    child.stderr.on("data", (chunk: string) => {
      emit({ type: "raw_output", text: chunk, timestamp: Date.now() });
    });

    child.on("error", (error) => {
      emit({ type: "error", message: "Claude Code process failed to start.", detail: error.message, timestamp: Date.now() });
      this.activeRuns.delete(runId);
    });

    child.on("close", (code) => {
      if (code && code !== 0) {
        emit({ type: "error", message: `Claude Code exited with code ${code}.`, timestamp: Date.now() });
      }
      this.activeRuns.delete(runId);
      this.activeTool = null;
    });

    return { runId };
  }

  cancelRun(runId: string): void {
    const child = this.activeRuns.get(runId);
    if (!child) return;
    child.kill("SIGINT");
    this.activeRuns.delete(runId);
  }

  parseLine(line: string, timestamp: number): AgentUiEvent[] {
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return [{ type: "raw_output", text: line, timestamp }];
    }

    const content = (record.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return [{ type: "raw_output", text: line, timestamp }];

    const events: AgentUiEvent[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const typed = part as Record<string, unknown>;

      if (typed.type === "text" && typeof typed.text === "string") {
        events.push({ type: "assistant_message", text: typed.text, timestamp });
      }

      if (typed.type === "tool_use" && typeof typed.name === "string") {
        const event = this.toolUseToEvent(typed.name, typed.input, timestamp);
        this.activeTool = event.tool;
        events.push(event);
      }

      if (typed.type === "tool_result" && typeof typed.content === "string") {
        events.push({ type: "tool_output", text: typed.content, timestamp });
        events.push({ type: "tool_done", status: "success", timestamp });
        this.activeTool = null;
      }
    }

    return events.length ? events : [{ type: "raw_output", text: line, timestamp }];
  }

  private toolUseToEvent(name: string, input: unknown, timestamp: number): AgentUiEvent {
    const normalized = normalizeToolName(name);
    const fields = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

    if (normalized === "bash") {
      return {
        type: "tool_start",
        tool: "bash",
        command: typeof fields.command === "string" ? fields.command : undefined,
        timestamp,
      };
    }

    return {
      type: "tool_start",
      tool: normalized,
      target:
        typeof fields.file_path === "string"
          ? fields.file_path
          : typeof fields.path === "string"
            ? fields.path
            : undefined,
      timestamp,
    };
  }
}

function normalizeToolName(name: string): ToolKind {
  const lower = name.toLowerCase();
  if (lower === "read") return "read";
  if (lower === "edit") return "edit";
  if (lower === "write") return "write";
  if (lower === "bash") return "bash";
  return "unknown";
}
```

- [ ] **Step 5: Wire prompt/cancel IPC**

Modify `src/main/ipc/claude-ipc.ts`:

```ts
import { BrowserWindow, ipcMain } from "electron";
import type { ClaudeCodeAdapter } from "../services/claude-code-adapter";
import type { ClaudeSessionService } from "../services/claude-session-service";
import type { CommandValidator } from "../services/command-validator";

export function registerClaudeIpc(
  commandValidator: CommandValidator,
  sessionService: ClaudeSessionService,
  claudeCodeAdapter: ClaudeCodeAdapter,
) {
  ipcMain.handle("claude:validate", (_event, commandPath: string) => {
    return commandValidator.validate(commandPath);
  });
  ipcMain.handle("claude:sessions:list", () => sessionService.listSessions());
  ipcMain.handle("claude:sessions:load", (_event, sessionId: string) => sessionService.loadSession(sessionId));
  ipcMain.handle("claude:prompt", (_event, input) => {
    return claudeCodeAdapter.runPrompt(input, (agentEvent) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("agent:event", agentEvent);
      }
    });
  });
  ipcMain.handle("claude:cancel", (_event, runId: string) => {
    claudeCodeAdapter.cancelRun(runId);
  });
}
```

Modify `src/main/index.ts` so `registerClaudeIpc` receives an adapter. Use a placeholder command path until config loading is wired into runtime:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerClaudeIpc } from "./ipc/claude-ipc";
import { registerConfigIpc } from "./ipc/config-ipc";
import { AppConfigStore } from "./services/app-config-store";
import { ClaudeCodeAdapter } from "./services/claude-code-adapter";
import { ClaudeSessionService } from "./services/claude-session-service";
import { CommandValidator } from "./services/command-validator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === "development";
const configStore = new AppConfigStore(app.getPath("userData"));

registerConfigIpc(configStore);
registerClaudeIpc(
  new CommandValidator(),
  new ClaudeSessionService(),
  new ClaudeCodeAdapter({ commandPath: "claude" }),
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
      sandbox: false,
    },
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/main/claude-code-adapter.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/claude-code-adapter.ts src/main/ipc/claude-ipc.ts src/main/index.ts tests/fixtures/claude-stream.jsonl tests/main/claude-code-adapter.test.ts
git commit -m "feat: parse claude structured output"
```

---

### Task 8: Build Renderer State and Core UI Components

**Files:**
- Create: `src/renderer/state/agent-store.ts`
- Create: `src/renderer/state/config-store.ts`
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/CliSelector.tsx`
- Create: `src/renderer/components/Thread.tsx`
- Create: `src/renderer/components/ToolCard.tsx`
- Create: `src/renderer/components/DiffViewer.tsx`
- Create: `src/renderer/components/Composer.tsx`
- Create: `src/renderer/components/StatusBar.tsx`
- Create: `src/renderer/components/SettingsDialog.tsx`
- Modify: `src/renderer/App.tsx`
- Create: `tests/renderer/thread.test.tsx`

- [ ] **Step 1: Write Thread smoke test**

`tests/renderer/thread.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Thread } from "../../src/renderer/components/Thread";
import type { AgentUiEvent } from "../../src/shared/types/agent-events";

describe("Thread", () => {
  it("renders messages and tool cards", () => {
    const events: AgentUiEvent[] = [
      { type: "user_message", text: "读取 README", timestamp: 1 },
      { type: "assistant_message", text: "我会读取文件。", timestamp: 2 },
      { type: "tool_start", tool: "read", target: "README.md", timestamp: 3 },
      { type: "tool_done", status: "success", timestamp: 4 },
      { type: "diff", filePath: "README.md", unifiedDiff: "@@ -1 +1 @@\n-old\n+new", timestamp: 5 },
    ];

    render(<Thread events={events} agentName="Claude Code" />);

    expect(screen.getByText("读取 README")).toBeInTheDocument();
    expect(screen.getByText("我会读取文件。")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("+new")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/thread.test.tsx
```

Expected: FAIL because renderer components do not exist.

- [ ] **Step 3: Implement renderer stores**

`src/renderer/state/agent-store.ts`:

```ts
import { create } from "zustand";
import type { AgentUiEvent, RunStatus } from "../../shared/types/agent-events";
import type { ClaudeSessionGroup, SessionPreview } from "../../shared/types/sessions";

type AgentState = {
  events: AgentUiEvent[];
  sessions: ClaudeSessionGroup[];
  selectedSessionId?: string;
  runId?: string;
  status: RunStatus;
  loadSessions(): Promise<void>;
  selectSession(sessionId: string): Promise<void>;
  sendPrompt(prompt: string): Promise<void>;
  cancel(): Promise<void>;
  appendEvent(event: AgentUiEvent): void;
};

export const useAgentStore = create<AgentState>((set, get) => ({
  events: [],
  sessions: [],
  status: "idle",
  async loadSessions() {
    const sessions = await window.agentHub.listSessions();
    set({ sessions });
  },
  async selectSession(sessionId: string) {
    const preview: SessionPreview = await window.agentHub.loadSession(sessionId);
    set({ selectedSessionId: sessionId, events: preview.events });
  },
  async sendPrompt(prompt: string) {
    const userEvent: AgentUiEvent = { type: "user_message", text: prompt, timestamp: Date.now() };
    set((state) => ({ events: [...state.events, userEvent], status: "running" }));
    const result = await window.agentHub.sendPrompt({ prompt, sessionId: get().selectedSessionId });
    set({ runId: result.runId });
  },
  async cancel() {
    const runId = get().runId;
    if (!runId) return;
    await window.agentHub.cancelRun(runId);
    set({ status: "cancelled", runId: undefined });
  },
  appendEvent(event: AgentUiEvent) {
    set((state) => ({ events: [...state.events, event], status: event.type === "error" ? "failed" : state.status }));
  },
}));
```

`src/renderer/state/config-store.ts`:

```ts
import { create } from "zustand";
import type { ClaudeConfig, ClaudeValidationResult } from "../../shared/types/claude-config";

type ConfigState = {
  config: ClaudeConfig | null;
  validation: ClaudeValidationResult | null;
  loadConfig(): Promise<void>;
  validate(commandPath: string): Promise<ClaudeValidationResult>;
  save(config: ClaudeConfig): Promise<void>;
};

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  validation: null,
  async loadConfig() {
    const config = await window.agentHub.getConfig();
    set({ config });
  },
  async validate(commandPath: string) {
    const validation = await window.agentHub.validateClaude(commandPath);
    set({ validation });
    return validation;
  },
  async save(config: ClaudeConfig) {
    const saved = await window.agentHub.saveConfig(config);
    set({ config: saved });
  },
}));
```

- [ ] **Step 4: Implement components**

`src/renderer/components/DiffViewer.tsx`:

```tsx
export function DiffViewer({ diff }: { diff: string }) {
  return (
    <div className="diff">
      {diff.split("\n").map((line, index) => {
        const cls = line.startsWith("+") ? "row add" : line.startsWith("-") ? "row del" : "row";
        return (
          <div className={cls} key={`${index}-${line}`}>
            <span className="ln">{index + 1}</span>
            <span className="sign">{line.startsWith("+") || line.startsWith("-") ? line[0] : " "}</span>
            <span className="code">{line}</span>
          </div>
        );
      })}
    </div>
  );
}
```

`src/renderer/components/ToolCard.tsx`:

```tsx
import type { AgentUiEvent } from "../../shared/types/agent-events";
import { DiffViewer } from "./DiffViewer";

export function ToolCard({ event }: { event: AgentUiEvent }) {
  if (event.type === "diff") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">diff</span>
          <span className="target">{event.filePath}</span>
          <span className="tag">变更</span>
        </div>
        <DiffViewer diff={event.unifiedDiff} />
      </div>
    );
  }

  if (event.type === "tool_start") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">{event.tool}</span>
          <span className="target">{event.target ?? event.command ?? "unknown"}</span>
          <span className="tag">运行中</span>
        </div>
      </div>
    );
  }

  if (event.type === "tool_output" || event.type === "raw_output") {
    return <div className="bash">{event.text}</div>;
  }

  if (event.type === "error") {
    return <div className="tool error-card">{event.message}</div>;
  }

  return null;
}
```

`src/renderer/components/Thread.tsx`:

```tsx
import type { AgentUiEvent } from "../../shared/types/agent-events";
import { ToolCard } from "./ToolCard";

export function Thread({ events, agentName }: { events: AgentUiEvent[]; agentName: string }) {
  return (
    <section className="chat">
      <div className="thread">
        {events.map((event, index) => {
          if (event.type === "user_message") {
            return (
              <div className="user" key={index}>
                <div className="bubble">{event.text}</div>
              </div>
            );
          }

          if (event.type === "assistant_message") {
            return (
              <div className="agent" key={index}>
                <div className="agent-name">
                  <span className="logo">⌘</span>
                  <span>{agentName}</span>
                </div>
                <div className="prose">{event.text}</div>
              </div>
            );
          }

          return <ToolCard event={event} key={index} />;
        })}
      </div>
    </section>
  );
}
```

`src/renderer/components/Sidebar.tsx`:

```tsx
import type { ClaudeSessionGroup } from "../../shared/types/sessions";

export function Sidebar({
  groups,
  selectedSessionId,
  onSelectSession,
}: {
  groups: ClaudeSessionGroup[];
  selectedSessionId?: string;
  onSelectSession(sessionId: string): void;
}) {
  return (
    <aside className="sidebar">
      <div className="side-head">
        <div className="mark">▦</div>
        <div className="brand">Agent Hub</div>
      </div>
      <div className="sessions">
        {groups.map((group) => (
          <div className="proj" key={group.projectPath}>
            <button className="proj-head">
              <span className="proj-name">{group.projectName}</span>
              <span className="count">{group.sessions.length}</span>
            </button>
            <div className="sess-list">
              {group.sessions.map((session) => (
                <button
                  className={session.id === selectedSessionId ? "sess active" : "sess"}
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                >
                  {session.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="foot">
        <div className="avatar">L</div>
        <span className="foot-name">leo</span>
      </div>
    </aside>
  );
}
```

`src/renderer/components/CliSelector.tsx`:

```tsx
export function CliSelector() {
  return (
    <div className="cli-wrap">
      <button className="cli-btn">
        <span className="logo">⌘</span>
        <span className="cli-name">Claude Code</span>
        <span className="caret">▾</span>
      </button>
    </div>
  );
}
```

`src/renderer/components/Composer.tsx`:

```tsx
import { useState } from "react";

export function Composer({ onSend, disabled }: { onSend(text: string): void; disabled: boolean }) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="composer">
      <textarea
        value={text}
        placeholder="给 Claude Code 下达任务..."
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="bar">
        <button className="barbtn">+ 添加文件</button>
        <button className="barbtn">@引用</button>
        <span className="spacer" />
        <button className="run" onClick={submit} disabled={disabled}>
          ▶
        </button>
      </div>
    </div>
  );
}
```

`src/renderer/components/StatusBar.tsx`:

```tsx
import type { RunStatus } from "../../shared/types/agent-events";

export function StatusBar({ status }: { status: RunStatus }) {
  return (
    <div className="status">
      <div className="chip accent">
        <span className="dot" />
        <span>模型</span>
        <strong>Claude Code</strong>
      </div>
      <div className="chip">
        <span>状态</span>
        <strong>{status}</strong>
      </div>
      <span className="spacer" />
      <div className="chip">
        <span>git</span>
        <strong>local</strong>
      </div>
    </div>
  );
}
```

`src/renderer/components/SettingsDialog.tsx`:

```tsx
import { useState } from "react";
import type { ClaudeValidationResult } from "../../shared/types/claude-config";

export function SettingsDialog({
  onSave,
}: {
  onSave(commandPath: string, defaultWorkingDirectory: string): Promise<ClaudeValidationResult>;
}) {
  const [commandPath, setCommandPath] = useState("/opt/homebrew/bin/claude");
  const [cwd, setCwd] = useState("");
  const [result, setResult] = useState<ClaudeValidationResult | null>(null);

  return (
    <div className="settings">
      <label>
        Claude command
        <input value={commandPath} onChange={(event) => setCommandPath(event.target.value)} />
      </label>
      <label>
        Default working directory
        <input value={cwd} onChange={(event) => setCwd(event.target.value)} />
      </label>
      <button
        onClick={async () => {
          const validation = await onSave(commandPath, cwd);
          setResult(validation);
        }}
      >
        Save Claude Code
      </button>
      {result ? <p>{result.ok ? `Claude ready: ${result.version}` : result.message}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Wire App**

`src/renderer/App.tsx`:

```tsx
import { useEffect } from "react";
import { CliSelector } from "./components/CliSelector";
import { Composer } from "./components/Composer";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Thread } from "./components/Thread";
import { useAgentStore } from "./state/agent-store";
import { useConfigStore } from "./state/config-store";
import "./styles/theme.css";
import "./styles/app.css";

export function App() {
  const config = useConfigStore((state) => state.config);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const validate = useConfigStore((state) => state.validate);
  const saveConfig = useConfigStore((state) => state.save);
  const events = useAgentStore((state) => state.events);
  const sessions = useAgentStore((state) => state.sessions);
  const selectedSessionId = useAgentStore((state) => state.selectedSessionId);
  const status = useAgentStore((state) => state.status);
  const loadSessions = useAgentStore((state) => state.loadSessions);
  const selectSession = useAgentStore((state) => state.selectSession);
  const sendPrompt = useAgentStore((state) => state.sendPrompt);
  const appendEvent = useAgentStore((state) => state.appendEvent);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) void loadSessions();
  }, [config, loadSessions]);

  useEffect(() => {
    return window.agentHub.onAgentEvent(appendEvent);
  }, [appendEvent]);

  if (!config) {
    return (
      <SettingsDialog
        onSave={async (commandPath, defaultWorkingDirectory) => {
          const result = await validate(commandPath);
          if (result.ok) {
            await saveConfig({ commandPath, defaultWorkingDirectory });
            await loadSessions();
          }
          return result;
        }}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar groups={sessions} selectedSessionId={selectedSessionId} onSelectSession={(id) => void selectSession(id)} />
      <main className="main">
        <header className="top">
          <span className="path">~/projects/<strong>agent-hub</strong></span>
          <CliSelector />
        </header>
        <Thread events={events} agentName="Claude Code" />
        <footer className="input-area">
          <StatusBar status={status} />
          <Composer onSend={(text) => void sendPrompt(text)} disabled={status === "running"} />
        </footer>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/renderer/thread.test.tsx
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/renderer tests/renderer/thread.test.tsx
git commit -m "feat: add agent hub renderer shell"
```

---

### Task 9: Port Agent Hub Styling

**Files:**
- Create: `src/renderer/styles/theme.css`
- Create: `src/renderer/styles/app.css`
- Modify: `src/renderer/components/*` as needed for class names

- [ ] **Step 1: Add theme CSS**

`src/renderer/styles/theme.css`:

```css
:root {
  --accent: #d97757;
  --accent-dim: #fff1eb;
  --accent-text: #8b3d24;
  --bg: #f9f9fb;
  --surface: #fff;
  --sidebar: #f4f4f7;
  --hover: #ebebef;
  --active: #e3e3e9;
  --fg: #111118;
  --fg2: #44444e;
  --fg3: #7f7f8e;
  --border: #e0e0e8;
  --border2: #ebebf0;
  --green: #23bd5a;
  --diff: #0d1117;
  --add: #091a10;
  --del: #200b0b;
  --red: #f97583;
  --mono: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
}
```

- [ ] **Step 2: Add app CSS**

`src/renderer/styles/app.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  font: 13px/1.5 var(--font);
  color: var(--fg);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

button,
textarea,
input {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
  background: none;
  border: 0;
}

.app {
  height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
}

.sidebar {
  background: var(--sidebar);
  border-right: 1px solid var(--border2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-head,
.top {
  height: 46px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.side-head {
  padding: 10px;
}

.top {
  border-bottom: 1px solid var(--border2);
  padding: 0 18px;
}

.mark {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: #111118;
  color: white;
  display: grid;
  place-items: center;
}

.brand {
  font-weight: 650;
  flex: 1;
}

.cli-wrap {
  padding: 0 8px 8px;
}

.cli-btn {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cli-name {
  flex: 1;
  text-align: left;
  font-weight: 570;
}

.sessions {
  flex: 1;
  overflow: auto;
  padding: 2px 6px;
}

.proj-head,
.sess {
  width: 100%;
  border-radius: 5px;
  text-align: left;
}

.proj-head {
  padding: 5px 7px;
  display: flex;
  gap: 6px;
  color: var(--fg2);
  font-weight: 620;
}

.sess {
  padding: 5px 10px;
  color: var(--fg2);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sess.active {
  background: var(--active);
  color: var(--fg);
  font-weight: 510;
}

.count {
  font-size: 10px;
  color: var(--fg3);
  background: var(--active);
  padding: 1px 5px;
  border-radius: 999px;
}

.foot {
  height: 42px;
  border-top: 1px solid var(--border2);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e2e2e8;
  display: grid;
  place-items: center;
  font-weight: 650;
}

.main {
  height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.path {
  flex: 1;
  min-width: 0;
  font: 12px var(--mono);
  color: var(--fg3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat {
  flex: 1;
  overflow: auto;
  padding: 20px 24px 8px;
}

.thread {
  max-width: 740px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.user {
  display: flex;
  justify-content: flex-end;
}

.bubble {
  max-width: 68%;
  background: #f0f0f5;
  color: var(--fg);
  padding: 10px 14px;
  border-radius: 14px 14px 3px 14px;
}

.agent {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-name {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 630;
}

.prose {
  font-size: 13px;
  line-height: 1.68;
}

.tool {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  font: 11.5px var(--mono);
}

.tool-head {
  padding: 6px 12px;
  background: #f6f6f9;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

.kind {
  font-size: 10px;
  font-weight: 750;
  text-transform: uppercase;
  color: var(--fg3);
}

.target {
  flex: 1;
  color: var(--fg2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e1f5e9;
  color: #1a6b35;
  font-weight: 600;
}

.diff {
  background: var(--diff);
  font: 12px/1.7 var(--mono);
  max-height: 300px;
  overflow: auto;
}

.row {
  display: grid;
  grid-template-columns: 42px 18px 1fr;
  min-height: 22px;
}

.row.add {
  background: var(--add);
}

.row.del {
  background: var(--del);
}

.ln {
  padding-right: 10px;
  text-align: right;
  color: #484f58;
  border-right: 1px solid #21262d;
}

.sign {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.code {
  padding-left: 4px;
  white-space: pre;
}

.add .sign,
.add .code {
  color: var(--green);
}

.del .sign,
.del .code {
  color: var(--red);
}

.bash {
  background: #161b22;
  color: #e6edf3;
  padding: 10px 14px;
  font: 12px/1.65 var(--mono);
  white-space: pre-wrap;
}

.input-area {
  padding: 10px 24px 16px;
}

.status {
  max-width: 740px;
  margin: 0 auto 6px;
  min-height: 28px;
  padding: 4px 7px;
  border: 1px solid var(--border2);
  border-radius: 8px;
  background: #fbfbfd;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fg3);
  font: 10.5px var(--mono);
}

.chip {
  height: 20px;
  padding: 0 7px;
  border: 1px solid var(--border2);
  border-radius: 999px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.chip.accent {
  background: var(--accent-dim);
  color: var(--accent-text);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
}

.spacer {
  flex: 1;
}

.composer {
  max-width: 740px;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.composer textarea {
  width: 100%;
  min-height: 46px;
  max-height: 160px;
  padding: 11px 14px 4px;
  resize: none;
  outline: 0;
  font-size: 13.5px;
  border: 0;
}

.bar {
  padding: 5px 8px 7px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.barbtn {
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  color: var(--fg3);
}

.run {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  background: var(--fg);
  color: #f5f5fa;
  display: grid;
  place-items: center;
}

.settings {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 12px;
}

.settings label {
  display: grid;
  gap: 6px;
}

.settings input {
  width: min(520px, 80vw);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
```

- [ ] **Step 3: Run UI test and type checks**

Run:

```bash
npm test -- tests/renderer/thread.test.tsx
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/styles src/renderer/components src/renderer/App.tsx
git commit -m "style: port agent hub interface"
```

---

### Task 10: Wire Runtime Config Into Claude Adapter

**Files:**
- Modify: `src/main/ipc/claude-ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/services/claude-code-adapter.ts`
- Test: `tests/main/claude-code-adapter.test.ts`

- [ ] **Step 1: Extend adapter to support command path updates**

Modify `src/main/services/claude-code-adapter.ts` constructor/options area:

```ts
export class ClaudeCodeAdapter {
  private activeRuns = new Map<string, ChildProcessWithoutNullStreams>();
  private activeTool: ToolKind | null = null;
  private commandPath: string;

  constructor(options: ClaudeCodeAdapterOptions) {
    this.commandPath = options.commandPath;
  }

  setCommandPath(commandPath: string): void {
    this.commandPath = commandPath;
  }
```

Modify the `spawn` call:

```ts
const child = spawn(this.commandPath, args, {
  cwd: input.cwd,
  stdio: ["ignore", "pipe", "pipe"],
});
```

- [ ] **Step 2: Add test for command path update**

Append to `tests/main/claude-code-adapter.test.ts`:

```ts
  it("updates the command path", () => {
    const adapter = new ClaudeCodeAdapter({ commandPath: "/old/claude" });

    adapter.setCommandPath("/new/claude");

    expect(adapter.getCommandPath()).toBe("/new/claude");
  });
```

Add this method to `ClaudeCodeAdapter`:

```ts
getCommandPath(): string {
  return this.commandPath;
}
```

- [ ] **Step 3: Update config IPC to refresh adapter**

Modify `src/main/ipc/config-ipc.ts`:

```ts
import { ipcMain } from "electron";
import type { AppConfigStore } from "../services/app-config-store";
import type { ClaudeCodeAdapter } from "../services/claude-code-adapter";

export function registerConfigIpc(configStore: AppConfigStore, claudeCodeAdapter: ClaudeCodeAdapter) {
  ipcMain.handle("config:get", () => configStore.get());
  ipcMain.handle("config:save", async (_event, config) => {
    const saved = await configStore.save(config);
    claudeCodeAdapter.setCommandPath(saved.commandPath);
    return saved;
  });
}
```

Modify `src/main/index.ts` service construction:

```ts
const configStore = new AppConfigStore(app.getPath("userData"));
const claudeCodeAdapter = new ClaudeCodeAdapter({ commandPath: "claude" });

registerConfigIpc(configStore, claudeCodeAdapter);
registerClaudeIpc(new CommandValidator(), new ClaudeSessionService(), claudeCodeAdapter);
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/main/claude-code-adapter.test.ts
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/claude-code-adapter.ts src/main/ipc/config-ipc.ts src/main/index.ts tests/main/claude-code-adapter.test.ts
git commit -m "feat: use configured claude command"
```

---

### Task 11: Final Verification and Developer Run Instructions

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update README with local development commands**

Append this section to `README.md`:

````md
## Development

Install dependencies:

```bash
npm install
```

Run type checks and tests:

```bash
npm run lint
npm test
```

Run the renderer dev server:

```bash
npm run dev
```

Build the app bundles:

```bash
npm run build
```

The first milestone expects a locally installed and authenticated Claude Code command. In the app settings, point Agent Hub at the full `claude` command path, such as `/opt/homebrew/bin/claude`.
````

- [ ] **Step 2: Update AGENTS with execution notes**

Append to `AGENTS.md`:

```md
## Development Commands

- `npm install` installs project dependencies.
- `npm run lint` runs TypeScript checks.
- `npm test` runs Vitest.
- `npm run build` builds main, preload, and renderer outputs.

## Local Files

`agent-hub-export.html` is intentionally ignored. Use it only as visual reference.
```

- [ ] **Step 3: Run final checks**

Run:

```bash
npm run lint
npm test
npm run build
git status --short --ignored
```

Expected:

- Type checks pass.
- Tests pass.
- Build passes.
- `agent-hub-export.html` remains ignored.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: add development instructions"
```

- [ ] **Step 5: Push**

```bash
git push
```

Expected: local `main` pushes to `origin/main`.

---

## Self-Review

Spec coverage:

- Electron, React, TypeScript, and Node scaffold: Task 1.
- Secure main/preload/renderer boundaries: Tasks 1 and 2.
- Claude command path setup and validation: Tasks 3, 4, and 10.
- Claude historical session sidebar: Task 5 and Task 8.
- Structured output parsing: Task 7.
- Tool cards, raw output, and diff rendering: Tasks 6, 8, and 9.
- Existing UI visual direction: Tasks 8 and 9.
- Local config only, no LLM state ownership: Tasks 3 and 5.
- Tests around risky boundaries: Tasks 3 through 8.

Placeholder scan:

- No unresolved placeholder or vague edge-case instructions are required to execute the plan.
- Each code-changing task includes concrete files, code blocks, commands, and expected outcomes.

Type consistency:

- `AgentUiEvent`, `ClaudeConfig`, `ClaudeValidationResult`, `ClaudeSessionGroup`, and `SessionPreview` are defined before use.
- Preload API methods match renderer store calls.
- IPC channel names match preload invocations.
