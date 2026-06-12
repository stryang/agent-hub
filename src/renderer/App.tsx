import { useEffect, useMemo, useState } from "react";
import type { RuntimeStatus } from "../shared/types/runtime-status";
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
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

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

  useEffect(() => {
    if (!("agentHub" in window) || projectPath === "~") {
      setRuntimeStatus(null);
      return;
    }

    let cancelled = false;
    window.agentHub
      .getRuntimeStatus(projectPath)
      .then((nextStatus) => {
        if (!cancelled) setRuntimeStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setRuntimeStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath, status]);

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
            <button className="nav-btn" type="button" aria-label="上一页">
              ‹
            </button>
            <button className="nav-btn" type="button" aria-label="下一页">
              ›
            </button>
            <div className="title-stack">
              <div className="conversation-title">
                {selectedSession?.title ?? "新对话"}
              </div>
              <div className="conversation-subtitle">
                {parentPath(projectPath)}
                <strong>{projectName}</strong>
              </div>
            </div>
            <button className="title-more" type="button" aria-label="更多">
              ···
            </button>
            <span className="top-spacer" />
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
              config={config}
              validation={validation}
              runtimeStatus={runtimeStatus}
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
