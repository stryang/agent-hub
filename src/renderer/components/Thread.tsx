import { Copy, Expand, ThumbsDown, ThumbsUp } from "lucide-react";
import type { AgentKind, AgentUiEvent } from "../../shared/types/agent-events";
import { ClaudeLogo, CodexLogo, HermesLogo } from "./CliSelector";
import { MarkdownMessage } from "./MarkdownMessage";
import { ToolCard } from "./ToolCard";

const AGENT_LABELS: Record<AgentKind, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  hermes: "Hermes",
};

type ThreadProps = {
  activeAgent: AgentKind;
  events: AgentUiEvent[];
};

export function Thread({ activeAgent, events }: ThreadProps) {
  const lastTimestamp = events.at(-1)?.timestamp;
  const label = AGENT_LABELS[activeAgent];

  return (
    <div className="thread">
      {events.length === 0 ? (
        <div className="empty-thread">
          <div className="agent-name">
            <span className="logo">
              {activeAgent === "codex" ? <CodexLogo /> : activeAgent === "hermes" ? <HermesLogo /> : <ClaudeLogo />}
            </span>
            <span className="agent-label-text">{label}</span>
          </div>
          <div className="prose">
            <p>选择历史会话或给 {label} 下达任务。</p>
          </div>
        </div>
      ) : null}
      {events.map((event, index) => (
        <ThreadEvent
          activeAgent={activeAgent}
          event={event}
          key={`${event.timestamp}:${event.type}:${index}`}
        />
      ))}
      {lastTimestamp ? (
        <div className="message-actions">
          <button type="button" aria-label="复制">
            <Copy aria-hidden="true" />
          </button>
          <button type="button" aria-label="点赞">
            <ThumbsUp aria-hidden="true" />
          </button>
          <button type="button" aria-label="踩">
            <ThumbsDown aria-hidden="true" />
          </button>
          <button type="button" aria-label="展开">
            <Expand aria-hidden="true" />
          </button>
          <span>{formatTimestamp(lastTimestamp)}</span>
        </div>
      ) : null}
    </div>
  );
}

function ThreadEvent({ activeAgent, event }: { activeAgent: AgentKind; event: AgentUiEvent }) {
  if (event.type === "user_message") {
    return (
      <div className="user">
        <div className="user-text">{event.text}</div>
      </div>
    );
  }

  if (event.type === "assistant_message") {
    const label = AGENT_LABELS[activeAgent];
    return (
      <div className="agent">
        <div className="agent-name">
          <span className="logo">
            {activeAgent === "codex" ? <CodexLogo /> : activeAgent === "hermes" ? <HermesLogo /> : <ClaudeLogo />}
          </span>
          <span className="agent-label-text">{label}</span>
        </div>
        <div className="prose">
          <MarkdownMessage text={event.text} />
        </div>
      </div>
    );
  }

  return (
    <div className="agent">
      <ToolCard event={event} />
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
