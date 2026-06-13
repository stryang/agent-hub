import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { AgentUiEvent } from "../../shared/types/agent-events.js";
import type {
  ClaudeSession,
  ClaudeSessionGroup,
  SessionPreview,
} from "../../shared/types/sessions.js";


type DbSession = {
  id: string;
  title: string | null;
  started_at: string | number;
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
    const dbSessions = this.readSessions();
    if (dbSessions.length === 0) return [];

    return dbSessions.map((row) => {
      const name = row.title || row.id;
      const groupPath = `hermes://session/${row.id}`;
      const lastModified = safeParseDate(row.started_at);
      const session: ClaudeSession = {
        id: row.id,
        title: name,
        projectPath: groupPath,
        projectName: name,
        lastModified,
        messageCount: row.message_count,
        transcriptPath: "",
      };
      return { projectPath: groupPath, projectName: name, lastModified, sessions: [session] };
    });
  }

  async loadSession(sessionId: string): Promise<SessionPreview> {
    const dbMessages = this.readMessages(sessionId);
    const events = messagesToEvents(dbMessages);

    const dbSessions = this.readSessions();
    const row = dbSessions.find((s) => s.id === sessionId);

    const name = row?.title || sessionId;
    const session: ClaudeSession = {
      id: sessionId,
      title: name,
      projectPath: `hermes://session/${sessionId}`,
      projectName: name,
      lastModified: row ? safeParseDate(row.started_at) : 0,
      messageCount: events.filter(
        (e) => e.type === "user_message" || e.type === "assistant_message",
      ).length,
      transcriptPath: "",
    };

    return { session, events };
  }

  private readSessions(): DbSession[] {
    const dbPath = path.join(this.hermesDir, "state.db");
    try {
      const sql =
        "SELECT id, title, started_at, message_count FROM sessions WHERE message_count > 0 ORDER BY started_at DESC LIMIT 200";
      const out = execSync(`sqlite3 -json ${sq(dbPath)} ${sq(sql)}`, {
        encoding: "utf8",
        timeout: 5000,
      });
      if (!out.trim()) return [];
      return JSON.parse(out) as DbSession[];
    } catch {
      return [];
    }
  }

  private readMessages(sessionId: string): DbMessage[] {
    const dbPath = path.join(this.hermesDir, "state.db");
    try {
      const escaped = sessionId.replace(/'/g, "''");
      const sql = `SELECT id, session_id, role, content, timestamp FROM messages WHERE session_id = '${escaped}' ORDER BY timestamp ASC`;
      const out = execSync(`sqlite3 -json ${sq(dbPath)} ${sq(sql)}`, {
        encoding: "utf8",
        timeout: 5000,
      });
      if (!out.trim()) return [];
      return JSON.parse(out) as DbMessage[];
    } catch {
      return [];
    }
  }
}

function sq(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
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

function safeParseDate(value: string | number): number {
  if (typeof value === "number") {
    const ms = value * 1000;
    return Number.isFinite(ms) ? ms : 0;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
