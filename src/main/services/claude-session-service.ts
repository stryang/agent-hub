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

type ReadTranscriptOptions = {
  includeEvents: boolean;
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
    const transcriptPath = await this.findTranscriptPathByFileName(sessionId);
    if (transcriptPath) {
      const meta = await this.readTranscript(transcriptPath, {
        includeEvents: true,
      });
      if (meta) return meta;
      throw new Error(`Claude session not found: ${sessionId}`);
    }

    const metas = await this.readAllTranscripts();
    const meta = metas.find((item) => item.session.id === sessionId);
    if (!meta) throw new Error(`Claude session not found: ${sessionId}`);

    if (!meta.session.transcriptPath) return meta;
    const preview = await this.readTranscript(meta.session.transcriptPath, {
      includeEvents: true,
    });
    if (!preview) throw new Error(`Claude session not found: ${sessionId}`);

    return preview;
  }

  private async readAllTranscripts(): Promise<TranscriptMeta[]> {
    const projectsDir = path.join(this.claudeConfigDir, "projects");
    let projectDirs: string[];

    try {
      projectDirs = await fs.readdir(projectsDir);
    } catch {
      return [];
    }

    const metas: TranscriptMeta[] = [];

    for (const projectDir of projectDirs) {
      const fullProjectDir = path.join(projectsDir, projectDir);
      let stat;
      try {
        stat = await fs.stat(fullProjectDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      let files: string[];
      try {
        files = await fs.readdir(fullProjectDir);
      } catch {
        continue;
      }

      for (const file of files.filter((name) => name.endsWith(".jsonl"))) {
        const transcriptPath = path.join(fullProjectDir, file);
        const meta = await this.tryReadTranscript(transcriptPath, {
          includeEvents: false,
        });
        if (meta) metas.push(meta);
      }
    }

    return metas;
  }

  private async findTranscriptPathByFileName(
    sessionId: string,
  ): Promise<string | null> {
    const projectsDir = path.join(this.claudeConfigDir, "projects");
    let projectDirs: string[];

    try {
      projectDirs = await fs.readdir(projectsDir);
    } catch {
      return null;
    }

    const transcriptFile = `${sessionId}.jsonl`;
    for (const projectDir of projectDirs) {
      const fullProjectDir = path.join(projectsDir, projectDir);
      let stat;
      try {
        stat = await fs.stat(fullProjectDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      let files: string[];
      try {
        files = await fs.readdir(fullProjectDir);
      } catch {
        continue;
      }

      if (files.includes(transcriptFile)) {
        return path.join(fullProjectDir, transcriptFile);
      }
    }

    return null;
  }

  private async tryReadTranscript(
    transcriptPath: string,
    options: ReadTranscriptOptions,
  ): Promise<TranscriptMeta | null> {
    try {
      return await this.readTranscript(transcriptPath, options);
    } catch {
      return null;
    }
  }

  private async readTranscript(
    transcriptPath: string,
    options: ReadTranscriptOptions,
  ): Promise<TranscriptMeta | null> {
    const raw = await fs.readFile(transcriptPath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    let summary = "";
    let sessionId = path.basename(transcriptPath, ".jsonl");
    let projectPath = "";
    let lastModified = 0;
    let messageCount = 0;
    let firstUserText = "";
    let sanitizedSummary = "";
    const events: AgentUiEvent[] = [];

    for (const line of lines) {
      const record = parseJsonObject(line);
      if (!record) continue;

      if (typeof record.summary === "string" && !summary) {
        summary = record.summary;
        sanitizedSummary = sanitizeUserVisibleText(record.summary);
      }
      if (typeof record.sessionId === "string") sessionId = record.sessionId;
      if (typeof record.cwd === "string") projectPath = record.cwd;

      const timestamp =
        typeof record.timestamp === "string" ? Date.parse(record.timestamp) : 0;
      const finiteTimestamp = Number.isFinite(timestamp) ? timestamp : 0;
      if (Number.isFinite(timestamp)) {
        lastModified = Math.max(lastModified, timestamp);
      }

      const message = record.message as TranscriptMessage | undefined;
      if (!message?.role) continue;

      if (message.role === "user") {
        const extracted = extractUserTranscriptEvent(record, message.content);
        if (!extracted) continue;

        messageCount += 1;
        if (extracted.type === "user_message" && !firstUserText) {
          firstUserText = extracted.text;
        }
        if (options.includeEvents) {
          events.push({ ...extracted, timestamp: finiteTimestamp });
        }
      }

      if (message.role === "assistant") {
        const text = extractAssistantText(message.content);
        if (!text) continue;

        messageCount += 1;
        if (text && options.includeEvents) {
          events.push({
            type: "assistant_message",
            text,
            timestamp: finiteTimestamp,
          });
        }
      }
    }

    if (!projectPath || !firstUserText) return null;

    const projectName = path.basename(projectPath);

    return {
      session: {
        id: sessionId,
        title: sanitizedSummary || firstUserText,
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

function parseJsonObject(line: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
}

function extractUserTranscriptEvent(
  record: Record<string, unknown>,
  content: unknown,
): AgentUiEvent | null {
  if (!isUserAuthoredRecord(record)) return null;
  const text = extractTextContent(content);
  if (!text) return null;

  const localCommandOutput = extractTaggedContent(text, "local-command-stdout");
  if (localCommandOutput) {
    return {
      type: "raw_output",
      text: localCommandOutput,
      timestamp: 0,
    };
  }

  const userText = sanitizeUserVisibleText(text);
  if (!userText) return null;

  return { type: "user_message", text: userText, timestamp: 0 };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  if (content.some((part) => isRecord(part) && part.type === "tool_result")) {
    return "";
  }

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

function isUserAuthoredRecord(record: Record<string, unknown>): boolean {
  if (record.type !== "user") return false;
  if (record.isMeta === true) return false;
  if ("toolUseResult" in record) return false;
  if (typeof record.sourceToolAssistantUUID === "string") return false;
  return true;
}

function sanitizeUserVisibleText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (isInternalUserText(trimmed)) {
    return "";
  }

  return stripLocalCommandTags(trimmed).trim();
}

function isInternalUserText(text: string): boolean {
  return [
    "<local-command-caveat>",
    "<system-reminder>",
    "<ide-context>",
    "<tool-result>",
  ].some((prefix) => text.startsWith(prefix));
}

function stripLocalCommandTags(text: string): string {
  return text
    .replace(/<\/?command-message>/g, "")
    .replace(/<\/?command-name>/g, "")
    .replace(/<\/?command-args>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "");
}

function extractTaggedContent(text: string, tagName: string): string | null {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`<${escapedTagName}>([\\s\\S]*?)<\\/${escapedTagName}>`),
  );
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
