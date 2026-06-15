import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowUp, ChevronDown, Plus, ShieldCheck } from "lucide-react";
import type { AgentKind } from "../../shared/types/agent-events";
import type { AgentCommand } from "../../shared/types/agent-commands";
import { CommandPalette } from "./CommandPalette";

const MAX_PALETTE_ITEMS = 20;

type PaletteState = { query: string; bottom: number; left: number; width: number };

type ComposerProps = {
  disabled?: boolean;
  activeAgent?: AgentKind;
  projectPath?: string;
  modelPicker?: ReactNode;
  statusBar?: ReactNode;
  onSubmit: (prompt: string) => void;
};

export function Composer({
  disabled = false,
  activeAgent,
  projectPath,
  modelPicker,
  statusBar,
  onSubmit,
}: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [palette, setPalette] = useState<PaletteState | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeAgent || !("agentHub" in window)) {
      setCommands([]);
      return;
    }
    window.agentHub
      .listAgentCommands(activeAgent, projectPath)
      .then(setCommands)
      .catch(() => setCommands([]));
  }, [activeAgent, projectPath]);

  const filteredCommands = useMemo(() => {
    if (!palette) return [];
    const q = palette.query.toLowerCase();
    if (!q) {
      // Empty query: show a balanced mix — some of each source type
      return balancedSlice(commands, MAX_PALETTE_ITEMS);
    }
    return commands
      .filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aPrefix = aName.startsWith(q);
        const bPrefix = bName.startsWith(q);
        if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
        return aName.localeCompare(bName);
      })
      .slice(0, MAX_PALETTE_ITEMS);
  }, [commands, palette]);

  function openPalette(query: string) {
    const rect = composerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPalette({
      query,
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
      width: rect.width,
    });
    setPaletteIndex(0);
  }

  function closePalette() {
    setPalette(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const { value, selectionStart } = e.target;
    setPrompt(value);

    const query = getCommandQuery(value, selectionStart ?? value.length);
    if (query !== null && commands.length > 0) {
      openPalette(query);
    } else {
      closePalette();
    }
  }

  function selectCommand(cmd: AgentCommand) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { value, selectionStart } = textarea;
    const cursor = selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/(?:^|\n)(\/\S*)$/);
    if (!match) return;

    const slashStart = cursor - match[1].length;
    const inserted = `/${cmd.name} `;
    const newValue = value.slice(0, slashStart) + inserted + value.slice(cursor);

    setPrompt(newValue);
    closePalette();

    requestAnimationFrame(() => {
      const newCursor = slashStart + inserted.length;
      textarea.setSelectionRange(newCursor, newCursor);
      textarea.focus();
    });
  }

  function submit() {
    const text = prompt.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setPrompt("");
    closePalette();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (palette && filteredCommands.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        selectCommand(filteredCommands[paletteIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer" ref={composerRef}>
      <textarea
        ref={textareaRef}
        id="taskInput"
        rows={1}
        placeholder="要求后续变更"
        value={prompt}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={closePalette}
      />
      <div className="bar">
        <button className="add-btn" type="button" disabled={disabled} aria-label="添加">
          <Plus aria-hidden="true" />
        </button>
        <button className="mode-btn" type="button">
          <span className="mode-shield">
            <ShieldCheck aria-hidden="true" />
          </span>
          <span>替我审批</span>
          <ChevronDown className="chevron" aria-hidden="true" />
        </button>
        {modelPicker}
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

      {palette && filteredCommands.length > 0 ? (
        <CommandPalette
          commands={filteredCommands}
          activeIndex={paletteIndex}
          pos={{ bottom: palette.bottom, left: palette.left, width: palette.width }}
          onSelect={selectCommand}
          onClose={closePalette}
        />
      ) : null}
    </div>
  );
}

/** When query is empty, show a mix of all source types rather than only built-ins. */
function balancedSlice(commands: AgentCommand[], limit: number): AgentCommand[] {
  const builtins = commands.filter((c) => c.source === "builtin");
  const cmds = commands.filter((c) => c.source === "command");
  const skills = commands.filter((c) => c.source === "skill");

  const result: AgentCommand[] = [];
  const perType = Math.ceil(limit / 3);

  for (const group of [builtins, cmds, skills]) {
    result.push(...group.slice(0, perType));
  }

  // Fill remaining slots if any group was smaller than perType
  if (result.length < limit) {
    const all = commands.filter((c) => !result.includes(c));
    result.push(...all.slice(0, limit - result.length));
  }

  return result.slice(0, limit);
}

function getCommandQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor);
  // Match a slash at start of text or after newline, followed by non-whitespace chars
  const match = before.match(/(?:^|\n)(\/\S*)$/);
  return match ? match[1].slice(1) : null;
}
