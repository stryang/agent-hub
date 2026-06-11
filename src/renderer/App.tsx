import { useEffect, useMemo, useState } from "react";
import { ClaudeLogo } from "./components/CliSelector";
import { Composer } from "./components/Composer";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Thread } from "./components/Thread";
import { useAgentStore } from "./state/agent-store";
import { useConfigStore } from "./state/config-store";

export function App() {
  const {
    events,
    sessions,
    selectedSessionId,
    status,
    loadSessions,
    selectSession,
    sendPrompt,
    cancel,
    appendEvent,
  } = useAgentStore();
  const { config, validation, loadConfig, validate, save } = useConfigStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!("agentHub" in window)) return;

    void loadConfig();
    void loadSessions();

    const unsubscribe = window.agentHub.onAgentEvent((event) => {
      appendEvent(event);
    });

    return unsubscribe;
  }, [appendEvent, loadConfig, loadSessions]);

  const selectedSession = useMemo(() => {
    for (const group of sessions) {
      const session = group.sessions.find((item) => item.id === selectedSessionId);
      if (session) return session;
    }
    return undefined;
  }, [selectedSessionId, sessions]);

  const projectPath =
    selectedSession?.projectPath ?? config?.defaultWorkingDirectory ?? "~";
  const projectName =
    selectedSession?.projectName ?? lastPathSegment(projectPath) ?? "agent-hub";
  const needsConfig = config === null;

  return (
    <>
      <div className="app">
        <Sidebar
          commandPath={config?.commandPath}
          groups={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={(sessionId) => {
            void selectSession(sessionId);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="main">
          <header className="top">
            <span className="path">
              {parentPath(projectPath)}
              <strong>{projectName}</strong>
            </span>
            <span className="sep" />
            <div className="pill">
              <span className="logo" id="pillLogo">
                <ClaudeLogo />
              </span>
              <span id="pillName">Claude Code</span>
            </div>
            <button className="icon" type="button" aria-label="菜单">
              ☰
            </button>
            <button
              className="icon"
              type="button"
              aria-label={status === "running" ? "取消" : "运行"}
              onClick={() => {
                if (status === "running") void cancel();
              }}
            >
              {status === "running" ? "■" : "▸"}
            </button>
          </header>

          <section className="chat">
            <Thread events={events} />
          </section>

          <footer className="input-area">
            <StatusBar
              status={status}
              branch={selectedSession?.gitBranch ?? "main · clean"}
            />
            <Composer
              disabled={needsConfig || status === "running"}
              onSubmit={(prompt) => {
                void sendPrompt(prompt);
              }}
            />
          </footer>
        </main>
      </div>

      {needsConfig || settingsOpen ? (
        <SettingsDialog
          initialConfig={config}
          validation={validation}
          onValidate={validate}
          onSave={async (nextConfig) => {
            await save(nextConfig);
            setSettingsOpen(false);
            await loadSessions();
          }}
          onClose={needsConfig ? undefined : () => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}

function lastPathSegment(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments.at(-1);
}

function parentPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index < 0) return "";
  return `${normalized.slice(0, index + 1)}`;
}
