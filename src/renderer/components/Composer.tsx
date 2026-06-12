import { type KeyboardEvent, type ReactNode, useState } from "react";
import { ArrowUp, ChevronDown, Plus, ShieldCheck } from "lucide-react";

type ComposerProps = {
  disabled?: boolean;
  statusBar?: ReactNode;
  onSubmit: (prompt: string) => void;
};

export function Composer({ disabled = false, statusBar, onSubmit }: ComposerProps) {
  const [prompt, setPrompt] = useState("");

  function submit() {
    const text = prompt.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setPrompt("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer">
      <textarea
        id="taskInput"
        rows={1}
        placeholder="要求后续变更"
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="bar">
        <button className="add-btn" type="button" disabled={disabled} aria-label="添加">
          <Plus aria-hidden="true" />
        </button>
        <button className="mode-btn" type="button" disabled={disabled}>
          <span className="mode-shield">
            <ShieldCheck aria-hidden="true" />
          </span>
          <span>替我审批</span>
          <ChevronDown className="chevron" aria-hidden="true" />
        </button>
        <span className="spacer" />
        {statusBar}
        <button
          className="run"
          type="button"
          disabled={disabled || prompt.trim().length === 0}
          onClick={submit}
          aria-label="发送"
        >
          <ArrowUp aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
