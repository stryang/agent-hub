import { useEffect, useMemo, useState } from "react";
import { LayoutList, PanelRight, Play, Square } from "lucide-react";
import type { AgentKind } from "../shared/types/agent-events";
import type { RuntimeStatus } from "../shared/types/runtime-status";
import { Composer } from "./components/Composer";
import { ModelPicker, CLAUDE_MODELS } from "./components/ModelPicker";
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
    selectedModel,
    setActiveAgent,
    setSelectedModel,
    loadSessions,
    selectSession,
    sendPrompt,
    cancel,
    appendEvent,
  } = useAgentStore();
  const {
    config, validation,
    codexConfig, codexValidation,
    hermesConfig, hermesValidation,
    loadConfig, loadCodexConfig, loadHermesConfig,
    validate, validateCodex, validateHermes,
    save, saveCodex, saveHermes,
  } = useConfigStore();
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
    void loadHermesConfig();
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

    const unsubscribeHermes = window.agentHub.onHermesEvent((event) => {
      if (useAgentStore.getState().activeAgent === "hermes") {
        appendEvent(event);
      }
    });

    return () => {
      unsubscribeClaude();
      unsubscribeCodex();
      unsubscribeHermes();
    };
  }, [appendEvent, loadConfig, loadCodexConfig, loadHermesConfig, loadSessions]);

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
      : activeAgent === "hermes"
        ? hermesConfig?.defaultWorkingDirectory
        : config?.defaultWorkingDirectory) ??
    "~";

  const modelDisplayLabel = useMemo(() => {
    const rawId = selectedModel ?? selectedSession?.modelName;
    if (!rawId) return "Sonnet 4.6";
    const found = CLAUDE_MODELS.find((m) => m.id === rawId);
    if (found) return found.label;
    const match = rawId.toLowerCase().match(/^claude-([a-z]+)-(\d+)-(\d+)(?:-([a-z0-9]+))?/);
    if (!match) return rawId;
    const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const suffix = match[4] && /^[a-z]+$/.test(match[4])
      ? ` ${match[4].charAt(0).toUpperCase() + match[4].slice(1)}`
      : "";
    return `${family} ${match[2]}.${match[3]}${suffix}`;
  }, [selectedModel, selectedSession?.modelName]);

  // Only Claude Code being unconfigured blocks the UI entirely.
  // Codex is optional — the user can always close its settings and switch back.
  const needsConfig = config === null;

  const activeCommandPath =
    activeAgent === "codex"
      ? codexConfig?.commandPath
      : activeAgent === "hermes"
        ? hermesConfig?.commandPath
        : config?.commandPath;

  const activeValidation =
    activeAgent === "codex"
      ? codexValidation
      : activeAgent === "hermes"
        ? hermesValidation
        : validation;

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
          hermesCommandPath={hermesConfig?.commandPath}
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
            <Thread activeAgent={activeAgent} events={events} />
          </section>

          <footer className="input-area">
            <Composer
              disabled={
                (activeAgent === "codex"
                  ? codexConfig === null
                  : activeAgent === "hermes"
                    ? hermesConfig === null
                    : config === null) ||
                status === "running"
              }
              modelPicker={
                activeAgent === "claude-code" ? (
                  <ModelPicker
                    selectedModel={selectedModel}
                    displayLabel={modelDisplayLabel}
                    onSelect={setSelectedModel}
                  />
                ) : null
              }
              statusBar={
                <StatusBar
                  status={status}
                  config={activeAgent === "claude-code" ? config : null}
                  runtimeStatus={runtimeStatus}
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
          initialConfig={activeAgent === "claude-code" ? config : null}
          initialCodexConfig={activeAgent === "codex" ? codexConfig : null}
          initialHermesConfig={activeAgent === "hermes" ? hermesConfig : null}
          validation={activeAgent === "claude-code" ? validation : null}
          codexValidation={activeAgent === "codex" ? codexValidation : null}
          hermesValidation={activeAgent === "hermes" ? hermesValidation : null}
          onValidate={validate}
          onValidateCodex={validateCodex}
          onValidateHermes={validateHermes}
          onSave={async (nextConfig) => {
            await save(nextConfig);
            setSettingsOpen(false);
            await loadSessions();
          }}
          onSaveCodex={async (nextConfig) => {
            await saveCodex(nextConfig);
            setSettingsOpen(false);
          }}
          onSaveHermes={async (nextConfig) => {
            await saveHermes(nextConfig);
            setSettingsOpen(false);
          }}
          onClose={
            activeAgent !== "claude-code" || !needsConfig
              ? () => setSettingsOpen(false)
              : undefined
          }
        />
      ) : null}
    </>
  );
}
