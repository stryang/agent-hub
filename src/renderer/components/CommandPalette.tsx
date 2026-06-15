import { useEffect, useRef } from "react";
import type { AgentCommand } from "../../shared/types/agent-commands";

type PalettePos = { bottom: number; left: number; width: number };

type CommandPaletteProps = {
  commands: AgentCommand[];
  activeIndex: number;
  pos: PalettePos;
  onSelect: (command: AgentCommand) => void;
  onClose: () => void;
};

const SOURCE_BADGE: Record<AgentCommand["source"], string> = {
  builtin: "内置",
  command: "命令",
  skill: "技能",
};

export function CommandPalette({ commands, activeIndex, pos, onSelect, onClose }: CommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector<HTMLButtonElement>(".cmd-opt.active");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (commands.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="cmd-palette"
      role="listbox"
      style={{ bottom: pos.bottom, left: pos.left, width: pos.width }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {commands.map((cmd, idx) => (
        <button
          key={`${cmd.source}:${cmd.name}`}
          className={`cmd-opt${idx === activeIndex ? " active" : ""}`}
          role="option"
          aria-selected={idx === activeIndex}
          type="button"
          onClick={() => onSelect(cmd)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="cmd-name">/{cmd.name}</span>
          {cmd.argumentHint ? <span className="cmd-hint">{cmd.argumentHint}</span> : null}
          <span className={`cmd-badge src-${cmd.source}`}>{SOURCE_BADGE[cmd.source]}</span>
          {cmd.description ? <span className="cmd-desc">{cmd.description}</span> : null}
        </button>
      ))}
    </div>
  );
}
