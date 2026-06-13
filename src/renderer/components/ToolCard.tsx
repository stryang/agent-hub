import {
  AlertTriangle,
  Check,
  Copy,
  FilePenLine,
  FileText,
  Shield,
  SquareTerminal,
} from "lucide-react";
import { useState } from "react";
import type { AgentUiEvent } from "../../shared/types/agent-events";
import { DiffViewer } from "./DiffViewer";

function isUnifiedDiff(text: string): boolean {
  return text.split("\n").some((l) => /^@@ -.+ \+.+ @@/.test(l));
}

type ToolCardProps = {
  event: AgentUiEvent;
};

export function ToolCard({ event }: ToolCardProps) {
  if (event.type === "diff") {
    const stats = diffStats(event.unifiedDiff);

    return (
      <div className="tool edit-card">
        <div className="tool-head">
          <span className="tool-icon">
            <FilePenLine aria-hidden="true" />
          </span>
          <div className="tool-title">
            <strong>已编辑 1 个文件</strong>
            <span>
              <span className="git-add">+{stats.added}</span>{" "}
              <span className="git-del">-{stats.deleted}</span>
            </span>
          </div>
          <button className="review-btn" type="button">
            审核
          </button>
        </div>
        <div className="file-row">
          <span>{event.filePath}</span>
          <span>
            <span className="git-add">+{stats.added}</span>{" "}
            <span className="git-del">-{stats.deleted}</span>
          </span>
        </div>
        <DiffViewer unifiedDiff={event.unifiedDiff} />
      </div>
    );
  }

  if (event.type === "tool_start") {
    if (event.tool === "edit" || event.tool === "write" || event.tool === "read" || event.tool === "unknown") return null;
    const subtitle = event.tool !== "bash" ? (event.target ?? "Claude Code") : null;
    return (
      <div className="tool">
        <div className={`tool-head${event.tool === "bash" ? " compact" : ""}`}>
          <span className="tool-icon">
            <ToolIcon kind={event.tool} />
          </span>
          <div className="tool-title">
            <strong>{labelForTool(event.tool)}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          {event.tool === "bash" && event.command ? (
            <CopyButton text={event.command} />
          ) : null}
        </div>
        {event.tool === "bash" && event.command ? (
          <div className="tool-body">{event.command}</div>
        ) : null}
      </div>
    );
  }

  if (event.type === "tool_output" || event.type === "raw_output") {
    const isDiff = isUnifiedDiff(event.text);
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="tool-icon">
            <SquareTerminal aria-hidden="true" />
          </span>
          <div className="tool-title">
            <strong>{event.type === "tool_output" ? "命令输出" : "Claude 输出"}</strong>
            <span>Claude Code</span>
          </div>
          <span className="tag">完成</span>
        </div>
        {isDiff ? <DiffViewer unifiedDiff={event.text} /> : <div className="tool-body">{event.text}</div>}
      </div>
    );
  }

  if (event.type === "tool_done") {
    return null;
  }

  if (event.type === "permission_prompt") {
    return (
      <div className="tool">
        <div className="tool-head">
          <span className="tool-icon">
            <Shield aria-hidden="true" />
          </span>
          <div className="tool-title">
            <strong>权限请求</strong>
            <span>{event.text}</span>
          </div>
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
          <span className="tool-icon error-icon">
            <AlertTriangle aria-hidden="true" />
          </span>
          <div className="tool-title">
            <strong>错误</strong>
            <span>{event.message}</span>
          </div>
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

function labelForTool(tool: string) {
  if (tool === "read") return "读取文件";
  if (tool === "edit") return "编辑文件";
  if (tool === "write") return "写入文件";
  if (tool === "bash") return "运行命令";
  return "工具调用";
}

function diffStats(unifiedDiff: string) {
  let added = 0;
  let deleted = 0;

  for (const line of unifiedDiff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    if (line.startsWith("-")) deleted += 1;
  }

  return { added, deleted };
}

function ToolIcon({ kind }: { kind: string }) {
  if (kind === "bash") return <SquareTerminal aria-hidden="true" />;
  if (kind === "read") {
    return <FileText aria-hidden="true" />;
  }
  return <FilePenLine aria-hidden="true" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button type="button" className="copy-btn" aria-label="复制命令" onClick={handleCopy}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}
