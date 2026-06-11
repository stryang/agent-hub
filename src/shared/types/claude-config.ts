export type ClaudeConfig = {
  commandPath: string;
  defaultWorkingDirectory: string;
};

export type ClaudeValidationResult =
  | {
      ok: true;
      commandPath: string;
      version: string;
      authenticated: true;
    }
  | {
      ok: false;
      commandPath: string;
      code:
        | "missing"
        | "not_executable"
        | "version_failed"
        | "auth_failed"
        | "unsupported";
      message: string;
      detail?: string;
    };
