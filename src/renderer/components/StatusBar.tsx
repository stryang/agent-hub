import type { RunStatus } from "../../shared/types/agent-events";

type StatusBarProps = {
  status: RunStatus;
  branch?: string;
};

export function StatusBar({ status, branch }: StatusBarProps) {
  return (
    <div className="status">
      <div className="chip accent">
        <span className="dot" />
        <span>模型</span>
        <strong id="statusModel">Claude Opus 4.1</strong>
      </div>
      <div className="chip">
        <span>状态</span>
        <strong>{statusLabel(status)}</strong>
      </div>
      <div className="chip">
        <span>上下文</span>
        <div className="meter">
          <span id="contextMeter" />
        </div>
        <strong id="statusContext">62%</strong>
      </div>
      <div className="chip">
        <span>额度</span>
        <strong id="statusQuota">78% left</strong>
      </div>
      <span className="spacer" />
      <div className="chip">
        <span>git</span>
        <strong id="statusBranch">{branch ?? "main · clean"}</strong>
      </div>
    </div>
  );
}

function statusLabel(status: RunStatus) {
  if (status === "running") return "运行中";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  return "就绪";
}
