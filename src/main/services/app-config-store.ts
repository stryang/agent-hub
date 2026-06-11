import fs from "node:fs/promises";
import path from "node:path";
import type { ClaudeConfig } from "../../shared/types/claude-config.js";

function parseClaudeConfig(value: unknown): ClaudeConfig {
  if (
    value === null ||
    typeof value !== "object" ||
    !("commandPath" in value) ||
    !("defaultWorkingDirectory" in value) ||
    typeof value.commandPath !== "string" ||
    typeof value.defaultWorkingDirectory !== "string"
  ) {
    throw new Error("Agent Hub config has invalid shape");
  }

  return {
    commandPath: value.commandPath,
    defaultWorkingDirectory: value.defaultWorkingDirectory,
  };
}

export class AppConfigStore {
  private readonly filePath: string;

  constructor(private readonly userDataDir: string) {
    this.filePath = path.join(userDataDir, "config.json");
  }

  async get(): Promise<ClaudeConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return parseClaudeConfig(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        throw new Error("Agent Hub config is not valid JSON");
      }
      throw error;
    }
  }

  async save(config: ClaudeConfig): Promise<ClaudeConfig> {
    const parsed = parseClaudeConfig(config);
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(parsed, null, 2), "utf8");
    return parsed;
  }
}
