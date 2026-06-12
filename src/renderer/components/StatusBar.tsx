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

  return (
    <div className="status">
      <div className="chip accent">
        <span className="dot" />
        <span>模型</span>
        <strong>{modelName}</strong>
      </div>
      <div className="chip">
        <span>状态</span>
        <strong>{statusLabel(status)}</strong>
      </div>
      <span className="spacer" />
      <div className="chip">
        <span>git</span>
        <GitStatus runtimeStatus={runtimeStatus} configured={Boolean(config)} />
      </div>
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
    return <strong id="statusBranch">{configured ? "checking" : "not configured"}</strong>;
  }

  if (!runtimeStatus.git.available) {
    return <strong id="statusBranch">not a repo</strong>;
  }

  const addedFiles = runtimeStatus.git.addedFiles ?? 0;
  const deletedFiles = runtimeStatus.git.deletedFiles ?? 0;

  return (
    <strong className="git-status" id="statusBranch">
      <span>{runtimeStatus.git.branch ?? "detached"}</span>
      <span className="git-sep">·</span>
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
    </strong>
  );
}

function statusLabel(status: RunStatus) {
  if (status === "running") return "运行中";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  return "就绪";
}
