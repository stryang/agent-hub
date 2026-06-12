export type CodexConfig = {
  commandPath: string;
  defaultWorkingDirectory: string;
};

export type CodexValidationResult =
  | {
      ok: true;
      commandPath: string;
      version: string;
    }
  | {
      ok: false;
      commandPath: string;
      code: "missing" | "not_executable" | "version_failed" | "auth_failed" | "unsupported";
      message: string;
      detail?: string;
    };
