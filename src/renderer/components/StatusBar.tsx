import { GitBranch } from "lucide-react";
import type { RunStatus } from "../../shared/types/agent-events";
import type { ClaudeConfig } from "../../shared/types/claude-config";
import type { RuntimeStatus } from "../../shared/types/runtime-status";

type StatusBarProps = {
  status: RunStatus;
  commandPath?: string;
  config: ClaudeConfig | null;
  runtimeStatus: RuntimeStatus | null;
};

export function StatusBar({
  status,
  runtimeStatus,
  config,
  commandPath,
}: StatusBarProps) {
  const statusText = statusLabel(status);

  return (
    <div className="status">
      {statusText ? (
        <>
          <span>{statusText}</span>
          <span className="status-dot" />
        </>
      ) : null}
      <GitStatus runtimeStatus={runtimeStatus} configured={Boolean(config) || Boolean(commandPath)} />
    </div>
  );
}


function GitStatus({
  runtimeStatus,
  configured,
}: {
  runtimeStatus: RuntimeStatus | null;
  configured: boolean;
}) {
  if (!runtimeStatus) {
    return configured ? <strong id="statusBranch">checking</strong> : null;
  }

  if (!runtimeStatus.git.available) {
    return null;
  }

  const newFiles = runtimeStatus.git.newFiles ?? 0;
  const modifiedFiles = runtimeStatus.git.modifiedFiles ?? 0;
  const deletedFiles = runtimeStatus.git.deletedFiles ?? 0;
  const clean = newFiles === 0 && modifiedFiles === 0 && deletedFiles === 0;

  return (
    <span className="git-status" id="statusBranch">
      <GitBranch className="git-branch-icon" aria-hidden="true" />
      <span>{runtimeStatus.git.branch ?? "detached"}</span>
      {clean ? (
        <span>clean</span>
      ) : (
        <>
          {newFiles > 0 ? <span className="git-add">+{newFiles}</span> : null}
          {modifiedFiles > 0 ? <span className="git-mod">~{modifiedFiles}</span> : null}
          {deletedFiles > 0 ? <span className="git-del">-{deletedFiles}</span> : null}
        </>
      )}
    </span>
  );
}

function statusLabel(status: RunStatus) {
  if (status === "running") return "运行中";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  return "";
}
