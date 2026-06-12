import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentUiEvent } from "../../shared/types/agent-events.js";
import type {
  ClaudeSession,
  ClaudeSessionGroup,
  SessionPreview,
} from "../../shared/types/sessions.js";

type SessionIndexEntry = {
  id: string;
  thread_name: string;
  updated_at: string;
};

type SessionFileMeta = {
  filePath: string;
  cwd: string;
};

export class CodexSessionService {
  constructor(
    private readonly codexDir = path.join(os.homedir(), ".codex"),
  ) {}

  async listSessions(): Promise<ClaudeSessionGroup[]> {
    const [index, fileMap] = await Promise.all([
      this.readSessionIndex(),
      this.buildFileMap(),
    ]);

    const groups = new Map<string, ClaudeSessionGroup>();

    for (const entry of index) {
      const fileMeta = fileMap.get(entry.id);
      if (!fileMeta) continue;

      const lastModified = safeParseDate(entry.updated_at);
      const projectName = path.basename(fileMeta.cwd);
      const session: ClaudeSession = {
        id: entry.id,
        title: entry.thread_name || entry.id,
        projectPath: fileMeta.cwd,
        projectName,
        lastModified,
        messageCount: 0,
        transcriptPath: fileMeta.filePath,
      };

      const existing = groups.get(fileMeta.cwd);
      if (existing) {
        existing.sessions.push(session);
        existing.lastModified = Math.max(existing.lastModified, lastModified);
      } else {
        groups.set(fileMeta.cwd, {
          projectPath: fileMeta.cwd,
          projectName,
          lastModified,
          sessions: [session],
        });
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort((a, b) => b.lastModified - a.lastModified),
      }))
      .sort((a, b) => b.lastModified - a.lastModified);
  }

  async loadSession(sessionId: string): Promise<SessionPreview> {
    const fileMap = await this.buildFileMap();
    const fileMeta = fileMap.get(sessionId);
    if (!fileMeta) throw new Error(`Codex session not found: ${sessionId}`);

    const raw = await fs.readFile(fileMeta.filePath, "utf8");
    const events = parseSessionEvents(raw);

    const index = await this.readSessionIndex();
    const entry = index.find((e) => e.id === sessionId);
    const lastModified = entry ? safeParseDate(entry.updated_at) : 0;

    const session: ClaudeSession = {
      id: sessionId,
      title: entry?.thread_name || sessionId,
      projectPath: fileMeta.cwd,
      projectName: path.basename(fileMeta.cwd),
      lastModified,
      messageCount: events.filter(
        (e) => e.type === "user_message" || e.type === "assistant_message",
      ).length,
      transcriptPath: fileMeta.filePath,
    };

    return { session, events };
  }

  private async readSessionIndex(): Promise<SessionIndexEntry[]> {
    const indexPath = path.join(this.codexDir, "session_index.jsonl");
    try {
      const raw = await fs.readFile(indexPath, "utf8");
      return raw
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .flatMap((l) => {
          try {
            const obj = JSON.parse(l);
            if (obj && typeof obj.id === "string" && typeof obj.thread_name === "string") {
              return [obj as SessionIndexEntry];
            }
            return [];
          } catch {
            return [];
          }
        })
        .reverse(); // newest first
    } catch {
      return [];
    }
  }

  private async buildFileMap(): Promise<Map<string, SessionFileMeta>> {
    const sessionsDir = path.join(this.codexDir, "sessions");
    const result = new Map<string, SessionFileMeta>();

    let years: string[];
    try {
      years = await fs.readdir(sessionsDir);
    } catch {
      return result;
    }

    for (const year of years) {
      const yearDir = path.join(sessionsDir, year);
      const months = await fs.readdir(yearDir).catch(() => [] as string[]);
      for (const month of months) {
        const monthDir = path.join(yearDir, month);
        const days = await fs.readdir(monthDir).catch(() => [] as string[]);
        for (const day of days) {
          const dayDir = path.join(monthDir, day);
          const files = await fs.readdir(dayDir).catch(() => [] as string[]);
          for (const file of files.filter((f) => f.endsWith(".jsonl"))) {
            const filePath = path.join(dayDir, file);
            const meta = await readFirstLineMeta(filePath);
            if (meta) result.set(meta.id, { filePath, cwd: meta.cwd });
          }
        }
      }
    }

    return result;
  }
}

async function readFirstLineMeta(
  filePath: string,
): Promise<{ id: string; cwd: string } | null> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, "r");
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buf, 0, 8192, 0);
    const text = buf.subarray(0, bytesRead).toString("utf8");
    const firstLine = text.split("\n")[0];
    const obj = JSON.parse(firstLine);
    if (
      obj?.type === "session_meta" &&
      typeof obj?.payload?.id === "string" &&
      typeof obj?.payload?.cwd === "string"
    ) {
      return { id: obj.payload.id, cwd: obj.payload.cwd };
    }
  } catch {
    // unreadable or unexpected format
  } finally {
    await handle?.close();
  }
  return null;
}

function parseSessionEvents(raw: string): AgentUiEvent[] {
  const events: AgentUiEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (!isRecord(obj) || obj.type !== "event_msg") continue;
    const payload = isRecord(obj.payload) ? obj.payload : null;
    if (!payload) continue;

    const ts =
      typeof payload.created_at === "number"
        ? payload.created_at
        : safeParseDate(String(payload.created_at ?? ""));

    if (payload.type === "user_message" && typeof payload.message === "string") {
      const text = payload.message.trim();
      if (text) events.push({ type: "user_message", text, timestamp: ts });
    }

    if (payload.type === "agent_message" && typeof payload.message === "string") {
      const text = payload.message.trim();
      if (text) events.push({ type: "assistant_message", text, timestamp: ts });
    }
  }
  return events;
}

function safeParseDate(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
