export type AgentKind = "claude-code" | "codex" | "hermes";

export type ToolKind = "read" | "edit" | "write" | "bash" | "unknown";

export type ToolStatus = "success" | "failed" | "cancelled";

export type AgentUiEvent =
  | { type: "user_message"; text: string; timestamp: number }
  | {
      type: "assistant_message";
      text: string;
      partial?: boolean;
      timestamp: number;
    }
  | {
      type: "tool_start";
      tool: ToolKind;
      target?: string;
      command?: string;
      timestamp: number;
    }
  | { type: "tool_output"; text: string; timestamp: number }
  | { type: "tool_done"; status: ToolStatus; timestamp: number }
  | { type: "run_done"; status: ToolStatus; timestamp: number }
  | { type: "diff"; filePath: string; unifiedDiff: string; timestamp: number }
  | {
      type: "permission_prompt";
      text: string;
      choices?: string[];
      timestamp: number;
    }
  | { type: "raw_output"; text: string; timestamp: number }
  | { type: "error"; message: string; detail?: string; timestamp: number };

export type RunStatus = "idle" | "running" | "failed" | "cancelled";
