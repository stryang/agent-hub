import { type FormEvent, useState } from "react";
import type {
  ClaudeConfig,
  ClaudeValidationResult,
} from "../../shared/types/claude-config";

type SettingsDialogProps = {
  initialConfig: ClaudeConfig | null;
  validation: ClaudeValidationResult | null;
  onValidate: (commandPath: string) => Promise<ClaudeValidationResult>;
  onSave: (config: ClaudeConfig) => Promise<void>;
  onClose?: () => void;
};

export function SettingsDialog({
  initialConfig,
  validation,
  onValidate,
  onSave,
  onClose,
}: SettingsDialogProps) {
  const [commandPath, setCommandPath] = useState(
    initialConfig?.commandPath ?? "",
  );
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState(
    initialConfig?.defaultWorkingDirectory ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    setError(null);
    await onValidate(commandPath);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await onValidate(commandPath);
      if (!result.ok) {
        setError(formatValidationError(result));
        return;
      }

      await onSave({
        commandPath: result.commandPath,
        defaultWorkingDirectory: defaultWorkingDirectory.trim(),
      });
      onClose?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-shell" role="presentation">
      <form className="settings-dialog" onSubmit={handleSubmit}>
        <div className="settings-head">
          <div>
            <div className="kind">settings</div>
            <h1>Claude Code 设置</h1>
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
            placeholder="/opt/homebrew/bin/claude"
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

        {validation ? (
          <div className={`settings-result ${validation.ok ? "ok" : "bad"}`}>
            {validation.ok
              ? `Claude Code ${validation.version} · authenticated`
              : formatValidationError(validation)}
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

function formatValidationError(result: ClaudeValidationResult): string {
  if (result.ok) {
    return "";
  }

  return result.detail ? `${result.message} ${result.detail}` : result.message;
}
