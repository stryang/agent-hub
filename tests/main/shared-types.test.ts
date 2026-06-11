import { describe, expect, it } from "vitest";
import type { AgentUiEvent } from "../../src/shared/types/agent-events";

describe("AgentUiEvent", () => {
  it("accepts a tool start event", () => {
    const event: AgentUiEvent = {
      type: "tool_start",
      tool: "read",
      target: "README.md",
      timestamp: 1,
    };

    expect(event.type).toBe("tool_start");
  });
});
