import { GitBranch } from "lucide-react";
import type { RunStatus } from "../../shared/types/agent-events";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../../shared/types/claude-config";
import type { RuntimeStatus } from "../../shared/types/runtime-status";

type StatusBarProps = {
  status: RunStatus;
  config: ClaudeConfig | null;
  validation: ClaudeValidationResult | null;
  runtimeStatus: RuntimeStatus | null;
};

export function StatusBar({
  status,
  config,
  validation,
  runtimeStatus,
}: StatusBarProps) {
  const modelName = getModelName(config, validation, runtimeStatus);
  const statusText = statusLabel(status);

  return (
    <div className="status">
      <span className="status-model">{modelName}</span>
      {statusText ? (
        <>
          <span className="status-dot" />
          <span>{statusText}</span>
        </>
      ) : null}
      <GitStatus runtimeStatus={runtimeStatus} configured={Boolean(config)} />
    </div>
  );
}

function getModelName(
  config: ClaudeConfig | null,
  validation: ClaudeValidationResult | null,
  runtimeStatus: RuntimeStatus | null,
) {
  if (!config) return "not configured";
  if (runtimeStatus?.modelName) return runtimeStatus.modelName;
  if (!validation) return "Claude Code";
  if (!validation.ok) return validation.code;
  return validation.version.replace(/\s*\(Claude Code\)\s*$/, "");
}

function GitStatus({
  runtimeStatus,
  configured,
}: {
  runtimeStatus: RuntimeStatus | null;
  configured: boolean;
}) {
  if (!runtimeStatus) {
    return configured ? (
      <strong id="statusBranch">checking</strong>
    ) : null;
  }

  if (!runtimeStatus.git.available) {
    return null;
  }

  const addedFiles = runtimeStatus.git.addedFiles ?? 0;
  const deletedFiles = runtimeStatus.git.deletedFiles ?? 0;

  return (
    <span className="git-status" id="statusBranch">
      <GitBranch className="git-branch-icon" aria-hidden="true" />
      <span>{runtimeStatus.git.branch ?? "detached"}</span>
      {addedFiles === 0 && deletedFiles === 0 ? (
        <span>clean</span>
      ) : (
        <>
          {addedFiles > 0 ? <span className="git-add">+{addedFiles}</span> : null}
          {deletedFiles > 0 ? (
            <span className="git-del">-{deletedFiles}</span>
          ) : null}
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
