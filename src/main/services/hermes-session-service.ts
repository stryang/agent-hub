import os from "node:os";
import path from "node:path";
import type { AgentUiEvent } from "../../shared/types/agent-events.js";
import type {
  ClaudeSession,
  ClaudeSessionGroup,
  SessionPreview,
} from "../../shared/types/sessions.js";

const HERMES_GROUP_PATH = "hermes://sessions";
const HERMES_GROUP_NAME = "Hermes";

type DbSession = {
  id: string;
  title: string | null;
  started_at: string;
  message_count: number;
};

type DbMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
};

export class HermesSessionService {
  constructor(
    private readonly hermesDir = path.join(os.homedir(), ".hermes"),
  ) {}

  async listSessions(): Promise<ClaudeSessionGroup[]> {
    const dbSessions = await this.readSessions();
    if (dbSessions.length === 0) return [];

    const sessions: ClaudeSession[] = dbSessions.map((row) => ({
      id: row.id,
      title: row.title || row.id,
      projectPath: HERMES_GROUP_PATH,
      projectName: HERMES_GROUP_NAME,
      lastModified: safeParseDate(row.started_at),
      messageCount: row.message_count,
      transcriptPath: "",
    }));

    const lastModified = Math.max(...sessions.map((s) => s.lastModified));

    return [
      {
        projectPath: HERMES_GROUP_PATH,
        projectName: HERMES_GROUP_NAME,
        lastModified,
        sessions,
      },
    ];
  }

  async loadSession(sessionId: string): Promise<SessionPreview> {
    const dbMessages = await this.readMessages(sessionId);
    const events = messagesToEvents(dbMessages);

    const dbSessions = await this.readSessions();
    const row = dbSessions.find((s) => s.id === sessionId);

    const session: ClaudeSession = {
      id: sessionId,
      title: row?.title || sessionId,
      projectPath: HERMES_GROUP_PATH,
      projectName: HERMES_GROUP_NAME,
      lastModified: row ? safeParseDate(row.started_at) : 0,
      messageCount: events.filter(
        (e) => e.type === "user_message" || e.type === "assistant_message",
      ).length,
      transcriptPath: "",
    };

    return { session, events };
  }

  private async readSessions(): Promise<DbSession[]> {
    const dbPath = path.join(this.hermesDir, "state.db");
    return new Promise((resolve) => {
      try {
        // Dynamic import to avoid top-level experimental warning in tests
        const { DatabaseSync } = require("node:sqlite") as {
          DatabaseSync: new (path: string) => {
            prepare(sql: string): { all(): unknown[] };
            close(): void;
          };
        };
        const db = new DatabaseSync(dbPath);
        try {
          const rows = db
            .prepare(
              `SELECT id, title, started_at, message_count
               FROM sessions
               WHERE message_count > 0
               ORDER BY started_at DESC
               LIMIT 200`,
            )
            .all() as DbSession[];
          resolve(rows);
        } finally {
          db.close();
        }
      } catch {
        resolve([]);
      }
    });
  }

  private async readMessages(sessionId: string): Promise<DbMessage[]> {
    const dbPath = path.join(this.hermesDir, "state.db");
    return new Promise((resolve) => {
      try {
        const { DatabaseSync } = require("node:sqlite") as {
          DatabaseSync: new (path: string) => {
            prepare(sql: string): { all(...params: unknown[]): unknown[] };
            close(): void;
          };
        };
        const db = new DatabaseSync(dbPath);
        try {
          const rows = db
            .prepare(
              `SELECT id, session_id, role, content, timestamp
               FROM messages
               WHERE session_id = ?
               ORDER BY timestamp ASC`,
            )
            .all(sessionId) as DbMessage[];
          resolve(rows);
        } finally {
          db.close();
        }
      } catch {
        resolve([]);
      }
    });
  }
}

function messagesToEvents(messages: DbMessage[]): AgentUiEvent[] {
  const events: AgentUiEvent[] = [];
  for (const msg of messages) {
    const timestamp = safeParseDate(msg.timestamp);
    const text = extractMessageText(msg.content);
    if (!text) continue;

    if (msg.role === "user") {
      events.push({ type: "user_message", text, timestamp });
    } else if (msg.role === "assistant") {
      events.push({ type: "assistant_message", text, timestamp });
    }
  }
  return events;
}

function extractMessageText(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();

  // Content may be JSON (array of message parts) or plain text
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") return item;
          if (isRecord(item) && typeof item.text === "string") return item.text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    if (isRecord(parsed) && typeof parsed.text === "string") return parsed.text;
  } catch {
    // Not JSON — treat as plain text
  }

  return trimmed;
}

function safeParseDate(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
