import type { AgentUiEvent } from "../../shared/types/agent-events";
import { DiffViewer } from "./DiffViewer";

type ToolCardProps = {
  event: AgentUiEvent;
};

export function ToolCard({ event }: ToolCardProps) {
  if (event.type === "diff") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">edit</span>
          <span className="target">{event.filePath}</span>
          <span className="tag">已保存</span>
        </div>
        <DiffViewer unifiedDiff={event.unifiedDiff} />
      </div>
    );
  }

  if (event.type === "tool_start") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">{event.tool}</span>
          <span className="target">
            {event.target ?? event.command ?? "Claude Code"}
          </span>
          <span className="tag">运行中</span>
        </div>
      </div>
    );
  }

  if (event.type === "tool_output" || event.type === "raw_output") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">
            {event.type === "tool_output" ? "output" : "raw"}
          </span>
          <span className="target">Claude Code</span>
          <span className="tag">完成</span>
        </div>
        <div className="tool-body">{event.text}</div>
      </div>
    );
  }

  if (event.type === "tool_done") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">tool</span>
          <span className="target">Claude Code</span>
          <span className="tag">{labelForStatus(event.status)}</span>
        </div>
      </div>
    );
  }

  if (event.type === "permission_prompt") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">permission</span>
          <span className="target">{event.text}</span>
          <span className="tag">等待</span>
        </div>
        {event.choices && event.choices.length > 0 ? (
          <div className="tool-body">{event.choices.join(" · ")}</div>
        ) : null}
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="kind">error</span>
          <span className="target">{event.message}</span>
          <span className="tag">失败</span>
        </div>
        {event.detail ? <div className="tool-body">{event.detail}</div> : null}
      </div>
    );
  }

  return null;
}

function labelForStatus(status: "success" | "failed" | "cancelled") {
  if (status === "success") return "完成";
  if (status === "cancelled") return "取消";
  return "失败";
}
