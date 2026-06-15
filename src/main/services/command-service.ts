import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentKind } from "../../shared/types/agent-events.js";
import type { AgentCommand } from "../../shared/types/agent-commands.js";

const CLAUDE_BUILTIN_COMMANDS: AgentCommand[] = [
  { name: "clear", description: "清除会话历史，释放上下文空间", source: "builtin" },
  { name: "compact", description: "压缩会话历史", argumentHint: "[说明]", source: "builtin" },
  { name: "config", description: "打开配置设置", source: "builtin" },
  { name: "cost", description: "显示 Token 用量和 API 费用", source: "builtin" },
  { name: "doctor", description: "检查 Claude Code 安装健康状态", source: "builtin" },
  { name: "exit", description: "退出当前会话", source: "builtin" },
  { name: "help", description: "显示可用命令和帮助", source: "builtin" },
  { name: "init", description: "为当前项目初始化 CLAUDE.md", source: "builtin" },
  { name: "login", description: "登录 Anthropic 账户", source: "builtin" },
  { name: "logout", description: "退出登录", source: "builtin" },
  { name: "mcp", description: "管理 MCP 服务器连接", source: "builtin" },
  { name: "memory", description: "编辑 CLAUDE.md 记忆文件", source: "builtin" },
  { name: "model", description: "切换 AI 模型", argumentHint: "[model-id]", source: "builtin" },
  { name: "permissions", description: "管理工具权限", source: "builtin" },
  { name: "pr_comments", description: "获取 GitHub PR 评论", argumentHint: "[pr-url]", source: "builtin" },
  { name: "review", description: "审查近期代码改动", source: "builtin" },
  { name: "status", description: "显示账户和系统状态", source: "builtin" },
  { name: "terminal-setup", description: "安装终端集成", source: "builtin" },
  { name: "upgrade", description: "将 Claude Code 更新到最新版本", source: "builtin" },
  { name: "vim", description: "切换 vim 按键绑定", source: "builtin" },
];

const CACHE_TTL_MS = 60_000;
type CacheEntry = { commands: AgentCommand[]; loadedAt: number };

export class CommandService {
  private readonly cache = new Map<string, CacheEntry>();

  async listCommands(agent: AgentKind, cwd?: string): Promise<AgentCommand[]> {
    const cacheKey = `${agent}:${cwd ?? ""}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.commands;
    }

    const commands = await this.loadCommands(agent, cwd);
    this.cache.set(cacheKey, { commands, loadedAt: Date.now() });
    return commands;
  }

  private async loadCommands(agent: AgentKind, cwd?: string): Promise<AgentCommand[]> {
    const home = os.homedir();

    if (agent === "claude-code") {
      const tasks: Promise<AgentCommand[]>[] = [
        // Global: commands are flat .md files, skills are sub-directories (may include symlinks)
        readMdFiles(path.join(home, ".claude", "commands"), "command"),
        readDirSkills(path.join(home, ".claude", "skills")),
      ];
      if (cwd) {
        // Project-level: skills can be either flat .md files OR sub-directories/symlinks
        tasks.push(
          readMdFiles(path.join(cwd, ".claude", "commands"), "command"),
          readAnySkills(path.join(cwd, ".claude", "skills")),
        );
      }
      const results = await Promise.all(tasks);
      return dedupeByName([...CLAUDE_BUILTIN_COMMANDS, ...results.flat()]);
    }

    if (agent === "codex") {
      const tasks: Promise<AgentCommand[]>[] = [
        readDirSkills(path.join(home, ".codex", "skills")),
      ];
      if (cwd) {
        tasks.push(readAnySkills(path.join(cwd, ".codex", "skills")));
      }
      const results = await Promise.all(tasks);
      return dedupeByName(results.flat());
    }

    if (agent === "hermes") {
      return readHermesSkills(path.join(home, ".hermes", "skills"));
    }

    return [];
  }
}

/**
 * Read a directory of .md files, each becoming a command/skill.
 * Used for ~/.claude/commands/ and project-level flat skill files.
 */
async function readMdFiles(dir: string, source: AgentCommand["source"]): Promise<AgentCommand[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map(async (e): Promise<AgentCommand> => {
          const name = e.name.slice(0, -3);
          const content = await fs
            .readFile(path.join(dir, e.name), "utf8")
            .catch(() => "");
          const { description, argumentHint } = parseFrontmatter(content);
          return { name, description, argumentHint, source };
        }),
    );
    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Read a directory where each sub-entry is a sub-dir (or symlink to dir) containing SKILL.md.
 * Used for ~/.claude/skills/ and ~/.codex/skills/.
 */
async function readDirSkills(skillsDir: string): Promise<AgentCommand[]> {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter((e) => e.isDirectory() || e.isSymbolicLink())
        .map(async (e): Promise<AgentCommand | null> => {
          const entryPath = path.join(skillsDir, e.name);
          // fs.stat follows symlinks; skip if target is not a directory
          const stat = await fs.stat(entryPath).catch(() => null);
          if (!stat?.isDirectory()) return null;
          const content = await fs
            .readFile(path.join(entryPath, "SKILL.md"), "utf8")
            .catch(() => "");
          const { description } = parseFrontmatter(content);
          return { name: e.name, description, source: "skill" as const };
        }),
    );
    return (results.filter(Boolean) as AgentCommand[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  } catch {
    return [];
  }
}

/**
 * Read a project-level skills directory that may contain either:
 * - Flat .md files (AICoding-style)
 * - Sub-directories or symlinks to directories with SKILL.md (dify-style)
 */
async function readAnySkills(skillsDir: string): Promise<AgentCommand[]> {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (e): Promise<AgentCommand | null> => {
        if (e.isFile() && e.name.endsWith(".md")) {
          const name = e.name.slice(0, -3);
          const content = await fs
            .readFile(path.join(skillsDir, e.name), "utf8")
            .catch(() => "");
          const { description, argumentHint } = parseFrontmatter(content);
          return { name, description, argumentHint, source: "skill" };
        }

        if (e.isDirectory() || e.isSymbolicLink()) {
          const entryPath = path.join(skillsDir, e.name);
          const stat = await fs.stat(entryPath).catch(() => null);
          if (!stat?.isDirectory()) return null;
          const content = await fs
            .readFile(path.join(entryPath, "SKILL.md"), "utf8")
            .catch(() => "");
          const { description } = parseFrontmatter(content);
          return { name: e.name, description, source: "skill" };
        }

        return null;
      }),
    );
    return (results.filter(Boolean) as AgentCommand[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  } catch {
    return [];
  }
}

/**
 * Read Hermes two-level skill structure:
 *   ~/.hermes/skills/<group>/DESCRIPTION.md  → group meta (not a skill itself)
 *   ~/.hermes/skills/<group>/<skill>/SKILL.md → individual skill
 *
 * If the top-level dir contains SKILL.md directly, treat it as a flat skill.
 */
async function readHermesSkills(skillsDir: string): Promise<AgentCommand[]> {
  try {
    const topEntries = await fs.readdir(skillsDir, { withFileTypes: true });
    const results = await Promise.all(
      topEntries
        .filter((e) => e.isDirectory() || e.isSymbolicLink())
        .map(async (e): Promise<AgentCommand[]> => {
          const topDir = path.join(skillsDir, e.name);
          const stat = await fs.stat(topDir).catch(() => null);
          if (!stat?.isDirectory()) return [];

          const children = await fs.readdir(topDir, { withFileTypes: true }).catch(() => []);

          // Flat skill: SKILL.md directly in top-level dir
          if (children.some((c) => c.isFile() && c.name === "SKILL.md")) {
            const content = await fs
              .readFile(path.join(topDir, "SKILL.md"), "utf8")
              .catch(() => "");
            const { description } = parseFrontmatter(content);
            return [{ name: e.name, description, source: "skill" }];
          }

          // Group dir: read sub-skill directories
          const subSkills = await Promise.all(
            children
              .filter((c) => c.isDirectory() || c.isSymbolicLink())
              .map(async (c): Promise<AgentCommand | null> => {
                const subPath = path.join(topDir, c.name);
                const subStat = await fs.stat(subPath).catch(() => null);
                if (!subStat?.isDirectory()) return null;
                const content = await fs
                  .readFile(path.join(subPath, "SKILL.md"), "utf8")
                  .catch(() => "");
                const { description } = parseFrontmatter(content);
                return { name: c.name, description, source: "skill" as const };
              }),
          );
          return subSkills.filter(Boolean) as AgentCommand[];
        }),
    );

    return results.flat().sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function dedupeByName(commands: AgentCommand[]): AgentCommand[] {
  const seen = new Set<string>();
  return commands.filter((cmd) => {
    if (seen.has(cmd.name)) return false;
    seen.add(cmd.name);
    return true;
  });
}

function parseFrontmatter(content: string): { description: string; argumentHint?: string } {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return { description: "" };
  const fm = fmMatch[1];
  return {
    description: extractField(fm, "description") ?? "",
    argumentHint: extractField(fm, "argument-hint"),
  };
}

function extractField(fm: string, key: string): string | undefined {
  const lines = fm.split("\n");
  const startIdx = lines.findIndex((l) => l.match(new RegExp(`^${key}:\\s*`)));
  if (startIdx < 0) return undefined;

  let value = lines[startIdx].replace(new RegExp(`^${key}:\\s*`), "").trim();
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("  ")) {
      value += " " + lines[i].trim();
    } else {
      break;
    }
  }
  return value || undefined;
}
