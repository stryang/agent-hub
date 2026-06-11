import { type KeyboardEvent, useState } from "react";

type ComposerProps = {
  disabled?: boolean;
  onSubmit: (prompt: string) => void;
};

export function Composer({ disabled = false, onSubmit }: ComposerProps) {
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
        placeholder="给 Claude Code 下达任务…"
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="bar">
        <button className="barbtn" type="button" disabled={disabled}>
          ＋ 添加文件
        </button>
        <button className="barbtn" type="button" disabled={disabled}>
          @引用
        </button>
        <span className="spacer" />
        <span className="hint">Enter 发送 · Shift+Enter 换行</span>
        <button
          className="run"
          type="button"
          disabled={disabled || prompt.trim().length === 0}
          onClick={submit}
          aria-label="发送"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
