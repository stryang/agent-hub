export type HermesConfig = {
  commandPath: string;
  defaultWorkingDirectory: string;
};

export type HermesValidationResult =
  | {
      ok: true;
      commandPath: string;
      version: string;
    }
  | {
      ok: false;
      commandPath: string;
      code: "missing" | "not_executable" | "version_failed" | "unsupported";
      message: string;
      detail?: string;
    };
