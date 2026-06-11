import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentUiEvent } from "../../shared/types/agent-events.js";
import type {
  ClaudeSession,
  ClaudeSessionGroup,
  SessionPreview,
} from "../../shared/types/sessions.js";

type TranscriptMeta = {
  session: ClaudeSession;
  events: AgentUiEvent[];
};

type TranscriptMessage = {
  role?: string;
  content?: unknown;
};

export class ClaudeSessionService {
  constructor(
    private readonly claudeConfigDir =
      process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"),
  ) {}

  async listSessions(): Promise<ClaudeSessionGroup[]> {
    const metas = await this.readAllTranscripts();
    const groups = new Map<string, ClaudeSessionGroup>();

    for (const meta of metas) {
      const existing = groups.get(meta.session.projectPath);
      if (existing) {
        existing.sessions.push(meta.session);
        existing.lastModified = Math.max(
          existing.lastModified,
          meta.session.lastModified,
        );
      } else {
        groups.set(meta.session.projectPath, {
          projectPath: meta.session.projectPath,
          projectName: meta.session.projectName,
          lastModified: meta.session.lastModified,
          sessions: [meta.session],
        });
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort(
          (a, b) => b.lastModified - a.lastModified,
        ),
      }))
      .sort((a, b) => b.lastModified - a.lastModified);
  }

  async loadSession(sessionId: string): Promise<SessionPreview> {
    const metas = await this.readAllTranscripts();
    const meta = metas.find((item) => item.session.id === sessionId);
    if (!meta) throw new Error(`Claude session not found: ${sessionId}`);

    return {
      session: meta.session,
      events: meta.events,
    };
  }

  private async readAllTranscripts(): Promise<TranscriptMeta[]> {
    const projectsDir = path.join(this.claudeConfigDir, "projects");
    let projectDirs: string[];

    try {
      projectDirs = await fs.readdir(projectsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const metas: TranscriptMeta[] = [];

    for (const projectDir of projectDirs) {
      const fullProjectDir = path.join(projectsDir, projectDir);
      const stat = await fs.stat(fullProjectDir);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(fullProjectDir);
      for (const file of files.filter((name) => name.endsWith(".jsonl"))) {
        const transcriptPath = path.join(fullProjectDir, file);
        const meta = await this.readTranscript(transcriptPath);
        if (meta) metas.push(meta);
      }
    }

    return metas;
  }

  private async readTranscript(
    transcriptPath: string,
  ): Promise<TranscriptMeta | null> {
    const raw = await fs.readFile(transcriptPath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    let summary = "";
    let sessionId = path.basename(transcriptPath, ".jsonl");
    let projectPath = "";
    let lastModified = 0;
    let messageCount = 0;
    const events: AgentUiEvent[] = [];

    for (const line of lines) {
      const record = JSON.parse(line) as Record<string, unknown>;
      if (typeof record.summary === "string" && !summary) {
        summary = record.summary;
      }
      if (typeof record.sessionId === "string") sessionId = record.sessionId;
      if (typeof record.cwd === "string") projectPath = record.cwd;

      const timestamp =
        typeof record.timestamp === "string" ? Date.parse(record.timestamp) : 0;
      if (timestamp) lastModified = Math.max(lastModified, timestamp);

      const message = record.message as TranscriptMessage | undefined;
      if (!message?.role) continue;
      messageCount += 1;

      if (message.role === "user") {
        const text = extractUserText(message.content);
        events.push({ type: "user_message", text, timestamp });
      }

      if (message.role === "assistant") {
        const text = extractAssistantText(message.content);
        if (text) events.push({ type: "assistant_message", text, timestamp });
      }
    }

    if (!projectPath) return null;

    const projectName = path.basename(projectPath);

    return {
      session: {
        id: sessionId,
        title: summary || firstUserText(events) || "Untitled Session",
        projectPath,
        projectName,
        lastModified,
        messageCount,
        transcriptPath,
      },
      events,
    };
  }
}

function extractUserText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) =>
      part &&
      typeof part === "object" &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : "",
    )
    .filter(Boolean)
    .join("\n");
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) =>
      part &&
      typeof part === "object" &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : "",
    )
    .filter(Boolean)
    .join("\n");
}

function firstUserText(events: AgentUiEvent[]): string {
  const first = events.find((event) => event.type === "user_message");
  return first?.type === "user_message" ? first.text : "";
}
