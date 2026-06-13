import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type ResolutionFailureCode = "missing" | "not_executable";

export type ClaudeCommandResolution =
  | {
      ok: true;
      inputPath: string;
      commandPath: string;
      resolvedPath: string;
    }
  | {
      ok: false;
      inputPath: string;
      commandPath: string;
      code: ResolutionFailureCode;
      message: string;
      detail?: string;
    };

export function normalizeCommandPath(commandPath: string): string {
  let normalized = commandPath.trim();

  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  if (normalized === "~") {
    return os.homedir();
  }

  if (normalized.startsWith("~/")) {
    return path.join(os.homedir(), normalized.slice(2));
  }

  return normalized;
}

export async function resolveClaudeCommandPath(
  rawCommandPath: string,
): Promise<ClaudeCommandResolution> {
  const inputPath = normalizeCommandPath(rawCommandPath);

  try {
    await fs.lstat(inputPath);
  } catch (error) {
    return {
      ok: false,
      inputPath,
      commandPath: inputPath,
      code: "missing",
      message: "Claude command path does not exist.",
      detail: formatFsError(error),
    };
  }

  const resolvedPath = await fs.realpath(inputPath).catch(() => inputPath);
  const candidates = uniquePaths([
    inputPath,
    resolvedPath,
    ...getClaudeCodeNativeCandidates(inputPath, resolvedPath),
  ]);

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return {
        ok: true,
        inputPath,
        commandPath: candidate,
        resolvedPath: await fs.realpath(candidate).catch(() => candidate),
      };
    }
  }

  return {
    ok: false,
    inputPath,
    commandPath: inputPath,
    code: "not_executable",
    message: "Claude command path is not executable.",
    detail: `Checked: ${candidates.join(", ")}`,
  };
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getClaudeCodeNativeCandidates(...commandPaths: string[]): string[] {
  const platformPackage = getClaudeCodePlatformPackageName();
  if (!platformPackage) {
    return [];
  }

  const binaryName = process.platform === "win32" ? "claude.exe" : "claude";
  const candidates: string[] = [];

  for (const commandPath of commandPaths) {
    const packageRoot = getClaudeCodePackageRoot(commandPath);
    if (!packageRoot) continue;

    candidates.push(
      path.join(
        packageRoot,
        "node_modules",
        "@anthropic-ai",
        platformPackage,
        binaryName,
      ),
    );
  }

  return candidates;
}

function getClaudeCodePackageRoot(commandPath: string): string | null {
  const binDir = path.dirname(commandPath);
  if (path.basename(binDir) !== "bin") {
    return null;
  }

  const packageRoot = path.dirname(binDir);
  if (
    path.basename(packageRoot) !== "claude-code" ||
    path.basename(path.dirname(packageRoot)) !== "@anthropic-ai"
  ) {
    return null;
  }

  return packageRoot;
}

function getClaudeCodePlatformPackageName(): string | null {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") return "claude-code-darwin-arm64";
    if (process.arch === "x64") return "claude-code-darwin-x64";
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") return "claude-code-linux-arm64";
    if (process.arch === "x64") return "claude-code-linux-x64";
  }

  if (process.platform === "win32") {
    if (process.arch === "arm64") return "claude-code-win32-arm64";
    if (process.arch === "x64") return "claude-code-win32-x64";
  }

  return null;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter((value) => value.length > 0))];
}

function formatFsError(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}
