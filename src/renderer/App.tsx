import { useEffect, useMemo, useState } from "react";
import { LayoutList, PanelRight, Play, Square } from "lucide-react";
import type { AgentKind } from "../shared/types/agent-events";
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
    activeAgent,
    events,
    sessions,
    selectedSessionId,
    status,
    setActiveAgent,
    loadSessions,
    selectSession,
    sendPrompt,
    cancel,
    appendEvent,
  } = useAgentStore();
  const { config, validation, codexConfig, codexValidation, loadConfig, loadCodexConfig, validate, validateCodex, save, saveCodex } = useConfigStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  // Sync agent theme token on root element
  useEffect(() => {
    document.documentElement.dataset.agent = activeAgent;
  }, [activeAgent]);

  useEffect(() => {
    if (!("agentHub" in window)) return;

    void loadConfig();
    void loadCodexConfig();
    void loadSessions();

    const unsubscribeClaude = window.agentHub.onAgentEvent((event) => {
      if (useAgentStore.getState().activeAgent === "claude-code") {
        appendEvent(event);
      }
    });

    const unsubscribeCodex = window.agentHub.onCodexEvent((event) => {
      if (useAgentStore.getState().activeAgent === "codex") {
        appendEvent(event);
      }
    });

    return () => {
      unsubscribeClaude();
      unsubscribeCodex();
    };
  }, [appendEvent, loadConfig, loadCodexConfig, loadSessions]);

  const selectedSession = useMemo(() => {
    for (const group of sessions) {
      const session = group.sessions.find((item) => item.id === selectedSessionId);
      if (session) return session;
    }
    return undefined;
  }, [selectedSessionId, sessions]);

  const projectPath =
    selectedSession?.projectPath ??
    (activeAgent === "codex"
      ? codexConfig?.defaultWorkingDirectory
      : config?.defaultWorkingDirectory) ??
    "~";

  const needsConfig =
    activeAgent === "codex" ? codexConfig === null : config === null;

  const activeCommandPath =
    activeAgent === "codex" ? codexConfig?.commandPath : config?.commandPath;

  const activeValidation =
    activeAgent === "codex" ? codexValidation : validation;

  function handleSelectAgent(agent: AgentKind) {
    setActiveAgent(agent);
  }

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
          activeAgent={activeAgent}
          commandPath={config?.commandPath}
          codexCommandPath={codexConfig?.commandPath}
          groups={sessions}
          selectedSessionId={selectedSessionId}
          onSelectAgent={handleSelectAgent}
          onSelectSession={(sessionId) => {
            void selectSession(sessionId);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="main">
          <header className="top">
            <div className="title-stack">
              <div className="conversation-title">
                {selectedSession?.title ?? "新对话"}
              </div>
            </div>
            <button className="title-more" type="button" aria-label="更多">
              ···
            </button>
            <span className="top-spacer" />
            <button className="top-action" type="button" aria-label="视图">
              <LayoutList aria-hidden="true" />
            </button>
            <button className="top-action" type="button" aria-label="面板">
              <PanelRight aria-hidden="true" />
            </button>
            <button
              className="top-action"
              type="button"
              aria-label={status === "running" ? "取消" : "运行"}
              onClick={() => {
                if (status === "running") void cancel();
              }}
            >
              {status === "running" ? (
                <Square aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
          </header>

          <section className="chat">
            <Thread events={events} />
          </section>

          <footer className="input-area">
            <Composer
              disabled={needsConfig || status === "running"}
              statusBar={
                <StatusBar
                  status={status}
                  config={activeAgent === "codex" ? null : config}
                  validation={activeValidation}
                  runtimeStatus={runtimeStatus}
                  activeAgent={activeAgent}
                  commandPath={activeCommandPath}
                />
              }
              onSubmit={(prompt) => {
                void sendPrompt(prompt);
              }}
            />
          </footer>
        </main>
      </div>

      {needsConfig || settingsOpen ? (
        <SettingsDialog
          activeAgent={activeAgent}
          initialConfig={activeAgent === "codex" ? null : config}
          initialCodexConfig={activeAgent === "codex" ? codexConfig : null}
          validation={activeAgent === "codex" ? null : validation}
          codexValidation={activeAgent === "codex" ? codexValidation : null}
          onValidate={validate}
          onValidateCodex={validateCodex}
          onSave={async (nextConfig) => {
            await save(nextConfig);
            setSettingsOpen(false);
            await loadSessions();
          }}
          onSaveCodex={async (nextConfig) => {
            await saveCodex(nextConfig);
            setSettingsOpen(false);
          }}
          onClose={needsConfig ? undefined : () => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}
