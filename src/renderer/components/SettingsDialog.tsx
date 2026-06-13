import { type FormEvent, useState } from "react";
import type { AgentKind } from "../../shared/types/agent-events";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../../shared/types/claude-config";
import type {
  CodexConfig,
  CodexValidationResult,
} from "../../shared/types/codex-config";
import type {
  HermesConfig,
  HermesValidationResult,
} from "../../shared/types/hermes-config";

type SettingsDialogProps = {
  activeAgent: AgentKind;
  initialConfig: ClaudeConfig | null;
  initialCodexConfig: CodexConfig | null;
  initialHermesConfig: HermesConfig | null;
  validation: ClaudeValidationResult | null;
  codexValidation: CodexValidationResult | null;
  hermesValidation: HermesValidationResult | null;
  onValidate: (commandPath: string) => Promise<ClaudeValidationResult>;
  onValidateCodex: (commandPath: string) => Promise<CodexValidationResult>;
  onValidateHermes: (commandPath: string) => Promise<HermesValidationResult>;
  onSave: (config: ClaudeConfig) => Promise<void>;
  onSaveCodex: (config: CodexConfig) => Promise<void>;
  onSaveHermes: (config: HermesConfig) => Promise<void>;
  onClose?: () => void;
};

export function SettingsDialog({
  activeAgent,
  initialConfig,
  initialCodexConfig,
  initialHermesConfig,
  validation,
  codexValidation,
  hermesValidation,
  onValidate,
  onValidateCodex,
  onValidateHermes,
  onSave,
  onSaveCodex,
  onSaveHermes,
  onClose,
}: SettingsDialogProps) {
  const isCodex = activeAgent === "codex";
  const isHermes = activeAgent === "hermes";

  const initialCommandPath = isCodex
    ? (initialCodexConfig?.commandPath ?? "")
    : isHermes
      ? (initialHermesConfig?.commandPath ?? "")
      : (initialConfig?.commandPath ?? "");

  const initialWorkingDir = isCodex
    ? (initialCodexConfig?.defaultWorkingDirectory ?? "")
    : isHermes
      ? (initialHermesConfig?.defaultWorkingDirectory ?? "")
      : (initialConfig?.defaultWorkingDirectory ?? "");

  const [commandPath, setCommandPath] = useState(initialCommandPath);
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState(initialWorkingDir);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeValidation = isCodex ? codexValidation : isHermes ? hermesValidation : validation;

  async function handleValidate() {
    setError(null);
    if (isCodex) {
      await onValidateCodex(commandPath);
    } else if (isHermes) {
      await onValidateHermes(commandPath);
    } else {
      await onValidate(commandPath);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isCodex) {
        const result = await onValidateCodex(commandPath);
        if (!result.ok) {
          setError(formatValidationError(result));
          return;
        }
        await onSaveCodex({
          commandPath: result.commandPath,
          defaultWorkingDirectory: defaultWorkingDirectory.trim(),
        });
      } else if (isHermes) {
        const result = await onValidateHermes(commandPath);
        if (!result.ok) {
          setError(formatValidationError(result));
          return;
        }
        await onSaveHermes({
          commandPath: result.commandPath,
          defaultWorkingDirectory: defaultWorkingDirectory.trim(),
        });
      } else {
        const result = await onValidate(commandPath);
        if (!result.ok) {
          setError(formatValidationError(result));
          return;
        }
        await onSave({
          commandPath: result.commandPath,
          defaultWorkingDirectory: defaultWorkingDirectory.trim(),
        });
      }
      onClose?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setSaving(false);
    }
  }

  const agentLabel = isCodex ? "Codex" : isHermes ? "Hermes" : "Claude Code";
  const commandPlaceholder = isCodex
    ? "/opt/homebrew/bin/codex"
    : isHermes
      ? "~/.local/bin/hermes"
      : "/opt/homebrew/bin/claude";

  return (
    <div className="settings-shell" role="presentation">
      <form className="settings-dialog" onSubmit={handleSubmit}>
        <div className="settings-head">
          <div>
            <div className="kind">settings</div>
            <h1>{agentLabel} 设置</h1>
          </div>
          {onClose ? (
            <button className="icon" type="button" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>

        <label className="field">
          <span>commandPath</span>
          <input
            value={commandPath}
            placeholder={commandPlaceholder}
            onChange={(event) => setCommandPath(event.target.value)}
          />
        </label>

        <label className="field">
          <span>defaultWorkingDirectory</span>
          <input
            value={defaultWorkingDirectory}
            placeholder="/Users/leo/IdeaProjects/yang/agent-hub"
            onChange={(event) => setDefaultWorkingDirectory(event.target.value)}
          />
        </label>

        {activeValidation ? (
          <div className={`settings-result ${activeValidation.ok ? "ok" : "bad"}`}>
            {activeValidation.ok
              ? `${agentLabel} ${activeValidation.version} · ready`
              : formatValidationError(activeValidation)}
          </div>
        ) : null}
        {error ? <div className="settings-result bad">{error}</div> : null}

        <div className="settings-actions">
          <button
            className="barbtn"
            type="button"
            disabled={saving || commandPath.trim().length === 0}
            onClick={handleValidate}
          >
            Validate
          </button>
          <span className="spacer" />
          <button
            className="run settings-save"
            type="submit"
            disabled={
              saving ||
              commandPath.trim().length === 0 ||
              defaultWorkingDirectory.trim().length === 0
            }
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function formatValidationError(
  result: ClaudeValidationResult | CodexValidationResult | HermesValidationResult,
): string {
  if (result.ok) return "";
  return result.detail ? `${result.message} ${result.detail}` : result.message;
}
