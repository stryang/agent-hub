import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ModelOption = {
  id: string;
  label: string;
};

export const CLAUDE_MODELS: ModelOption[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

type MenuPos = { bottom: number; left: number };

type ModelPickerProps = {
  selectedModel?: string;
  displayLabel: string;
  onSelect: (modelId: string) => void;
};

export function ModelPicker({ selectedModel, displayLabel, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
      });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="model-picker">
      <button
        ref={btnRef}
        className="model-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span>{displayLabel}</span>
        <ChevronDown className="chevron" aria-hidden="true" />
      </button>
      {open && menuPos ? (
        <div
          ref={menuRef}
          className="model-menu"
          role="listbox"
          style={{ bottom: menuPos.bottom, left: menuPos.left }}
        >
          {CLAUDE_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={model.id === selectedModel}
              className={`model-opt${model.id === selectedModel ? " sel" : ""}`}
              onClick={() => {
                onSelect(model.id);
                setOpen(false);
              }}
            >
              {model.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
