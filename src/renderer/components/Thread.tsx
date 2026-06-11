import type { AgentUiEvent } from "../../shared/types/agent-events";
import { ClaudeLogo } from "./CliSelector";
import { ToolCard } from "./ToolCard";

type ThreadProps = {
  events: AgentUiEvent[];
};

export function Thread({ events }: ThreadProps) {
  return (
    <div className="thread">
      {events.length === 0 ? (
        <div className="agent">
          <div className="agent-name">
            <span className="logo">
              <ClaudeLogo />
            </span>
            <span className="agent-label-text">Claude Code</span>
          </div>
          <div className="prose">
            <p>选择历史会话或给 Claude Code 下达任务。</p>
          </div>
        </div>
      ) : null}
      {events.map((event, index) => (
        <ThreadEvent event={event} key={`${event.timestamp}:${event.type}:${index}`} />
      ))}
    </div>
  );
}

function ThreadEvent({ event }: { event: AgentUiEvent }) {
  if (event.type === "user_message") {
    return (
      <div className="user">
        <div className="bubble">{event.text}</div>
      </div>
    );
  }

  if (event.type === "assistant_message") {
    return (
      <div className="agent">
        <div className="agent-name">
          <span className="logo">
            <ClaudeLogo />
          </span>
          <span className="agent-label-text">Claude Code</span>
        </div>
        <div className="prose">
          <p>{event.text}</p>
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
