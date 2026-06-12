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

type SettingsDialogProps = {
  activeAgent: AgentKind;
  initialConfig: ClaudeConfig | null;
  initialCodexConfig: CodexConfig | null;
  validation: ClaudeValidationResult | null;
  codexValidation: CodexValidationResult | null;
  onValidate: (commandPath: string) => Promise<ClaudeValidationResult>;
  onValidateCodex: (commandPath: string) => Promise<CodexValidationResult>;
  onSave: (config: ClaudeConfig) => Promise<void>;
  onSaveCodex: (config: CodexConfig) => Promise<void>;
  onClose?: () => void;
};

export function SettingsDialog({
  activeAgent,
  initialConfig,
  initialCodexConfig,
  validation,
  codexValidation,
  onValidate,
  onValidateCodex,
  onSave,
  onSaveCodex,
  onClose,
}: SettingsDialogProps) {
  const isCodex = activeAgent === "codex";

  const [commandPath, setCommandPath] = useState(
    isCodex
      ? (initialCodexConfig?.commandPath ?? "")
      : (initialConfig?.commandPath ?? ""),
  );
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState(
    isCodex
      ? (initialCodexConfig?.defaultWorkingDirectory ?? "")
      : (initialConfig?.defaultWorkingDirectory ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeValidation = isCodex ? codexValidation : validation;

  async function handleValidate() {
    setError(null);
    if (isCodex) {
      await onValidateCodex(commandPath);
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

  const agentLabel = isCodex ? "Codex" : "Claude Code";
  const commandPlaceholder = isCodex
    ? "/opt/homebrew/bin/codex"
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
  result: ClaudeValidationResult | CodexValidationResult,
): string {
  if (result.ok) return "";
  return result.detail ? `${result.message} ${result.detail}` : result.message;
}
