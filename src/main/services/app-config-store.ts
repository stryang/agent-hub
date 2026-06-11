import fs from "node:fs/promises";
import path from "node:path";
import type { ClaudeConfig } from "../../shared/types/claude-config.js";

export class AppConfigStore {
  private readonly filePath: string;

  constructor(private readonly userDataDir: string) {
    this.filePath = path.join(userDataDir, "config.json");
  }

  async get(): Promise<ClaudeConfig | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ClaudeConfig>;
      if (
        typeof parsed.commandPath !== "string" ||
        typeof parsed.defaultWorkingDirectory !== "string"
      ) {
        throw new Error("Agent Hub config has invalid shape");
      }
      return {
        commandPath: parsed.commandPath,
        defaultWorkingDirectory: parsed.defaultWorkingDirectory,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        throw new Error("Agent Hub config is not valid JSON");
      }
      throw error;
    }
  }

  async save(config: ClaudeConfig): Promise<ClaudeConfig> {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(config, null, 2), "utf8");
    return config;
  }
}
