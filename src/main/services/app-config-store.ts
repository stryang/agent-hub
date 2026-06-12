import fs from "node:fs/promises";
import path from "node:path";
import type { ClaudeConfig } from "../../shared/types/claude-config.js";
import type { CodexConfig } from "../../shared/types/codex-config.js";

type StoredConfig = {
  commandPath: string;
  defaultWorkingDirectory: string;
  codex?: {
    commandPath: string;
    defaultWorkingDirectory: string;
  };
};

function parseStoredConfig(value: unknown): StoredConfig {
  if (
    value === null ||
    typeof value !== "object" ||
    !("commandPath" in value) ||
    !("defaultWorkingDirectory" in value) ||
    typeof (value as Record<string, unknown>).commandPath !== "string" ||
    typeof (value as Record<string, unknown>).defaultWorkingDirectory !== "string"
  ) {
    throw new Error("Agent Hub config has invalid shape");
  }

  const raw = value as Record<string, unknown>;
  const result: StoredConfig = {
    commandPath: raw.commandPath as string,
    defaultWorkingDirectory: raw.defaultWorkingDirectory as string,
  };

  if (
    raw.codex &&
    typeof raw.codex === "object" &&
    "commandPath" in raw.codex &&
    "defaultWorkingDirectory" in raw.codex &&
    typeof (raw.codex as Record<string, unknown>).commandPath === "string" &&
    typeof (raw.codex as Record<string, unknown>).defaultWorkingDirectory === "string"
  ) {
    const codex = raw.codex as Record<string, unknown>;
    result.codex = {
      commandPath: codex.commandPath as string,
      defaultWorkingDirectory: codex.defaultWorkingDirectory as string,
    };
  }

  return result;
}

export class AppConfigStore {
  private readonly filePath: string;

  constructor(private readonly userDataDir: string) {
    this.filePath = path.join(userDataDir, "config.json");
  }

  private async readStored(): Promise<StoredConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return parseStoredConfig(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        throw new Error("Agent Hub config is not valid JSON");
      }
      throw error;
    }
  }

  private async writeStored(config: StoredConfig): Promise<void> {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), "utf8");
  }

  async get(): Promise<ClaudeConfig | null> {
    const stored = await this.readStored();
    if (!stored) return null;
    return { commandPath: stored.commandPath, defaultWorkingDirectory: stored.defaultWorkingDirectory };
  }

  async save(config: ClaudeConfig): Promise<ClaudeConfig> {
    if (
      config === null ||
      typeof config !== "object" ||
      typeof (config as Record<string, unknown>).commandPath !== "string" ||
      typeof (config as Record<string, unknown>).defaultWorkingDirectory !== "string"
    ) {
      throw new Error("Agent Hub config has invalid shape");
    }

    const stored = await this.readStored().catch(() => null);
    const next: StoredConfig = {
      commandPath: config.commandPath,
      defaultWorkingDirectory: config.defaultWorkingDirectory,
      ...(stored?.codex ? { codex: stored.codex } : {}),
    };
    await this.writeStored(next);
    return { commandPath: next.commandPath, defaultWorkingDirectory: next.defaultWorkingDirectory };
  }

  async getCodex(): Promise<CodexConfig | null> {
    const stored = await this.readStored();
    if (!stored?.codex) return null;
    return stored.codex;
  }

  async saveCodex(config: CodexConfig): Promise<CodexConfig> {
    const stored = await this.readStored().catch(() => null);
    const next: StoredConfig = {
      commandPath: stored?.commandPath ?? "",
      defaultWorkingDirectory: stored?.defaultWorkingDirectory ?? "",
      codex: { commandPath: config.commandPath, defaultWorkingDirectory: config.defaultWorkingDirectory },
    };
    await this.writeStored(next);
    return next.codex!;
  }
}
