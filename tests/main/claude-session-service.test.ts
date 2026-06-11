import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeSessionService } from "../../src/main/services/claude-session-service";

let tempDir: string;

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/claude-transcript.jsonl",
);

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-hub-sessions-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function writeTranscript(
  projectKey: string,
  fileName: string,
  content: string,
) {
  const dir = path.join(tempDir, "projects", projectKey);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), content, "utf8");
}

describe("ClaudeSessionService", () => {
  it("groups sessions by project and derives titles", async () => {
    await writeTranscript(
      "-Users-leo-IdeaProjects-yang-agent-hub",
      "11111111-1111-4111-8111-111111111111.jsonl",
      [
        '{"type":"summary","summary":"重构 CLI 切换模块"}',
        '{"sessionId":"11111111-1111-4111-8111-111111111111","cwd":"/Users/leo/IdeaProjects/yang/agent-hub","timestamp":"2026-06-11T08:00:00.000Z","type":"user","message":{"role":"user","content":"重构 CLI 切换模块"}}',
      ].join("\n"),
    );

    const service = new ClaudeSessionService(tempDir);
    const groups = await service.listSessions();

    expect(groups).toEqual([
      {
        projectPath: "/Users/leo/IdeaProjects/yang/agent-hub",
        projectName: "agent-hub",
        lastModified: Date.parse("2026-06-11T08:00:00.000Z"),
        sessions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "重构 CLI 切换模块",
            projectPath: "/Users/leo/IdeaProjects/yang/agent-hub",
            projectName: "agent-hub",
            lastModified: Date.parse("2026-06-11T08:00:00.000Z"),
            messageCount: 1,
            transcriptPath: path.join(
              tempDir,
              "projects",
              "-Users-leo-IdeaProjects-yang-agent-hub",
              "11111111-1111-4111-8111-111111111111.jsonl",
            ),
          },
        ],
      },
    ]);
  });

  it("loads a session preview as UI events", async () => {
    const fixture = await fs.readFile(fixturePath, "utf8");
    await writeTranscript(
      "-Users-leo-IdeaProjects-yang-agent-hub",
      "11111111-1111-4111-8111-111111111111.jsonl",
      fixture,
    );

    const service = new ClaudeSessionService(tempDir);
    const preview = await service.loadSession(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(preview.events).toEqual([
      {
        type: "user_message",
        text: "重构 CLI 切换模块",
        timestamp: Date.parse("2026-06-11T08:00:00.000Z"),
      },
      {
        type: "assistant_message",
        text: "我会先读取相关文件。",
        timestamp: Date.parse("2026-06-11T08:01:00.000Z"),
      },
    ]);
  });
});
