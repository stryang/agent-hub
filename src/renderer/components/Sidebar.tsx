import { useMemo, useState } from "react";
import type { ClaudeSessionGroup } from "../../shared/types/sessions";
import { AgentHubMark } from "./AgentHubLogo";
import { CliSelector } from "./CliSelector";

type SidebarProps = {
  commandPath?: string;
  groups: ClaudeSessionGroup[];
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onOpenSettings: () => void;
};

export function Sidebar({
  commandPath,
  groups,
  selectedSessionId,
  onSelectSession,
  onOpenSettings,
}: SidebarProps) {
  const defaultOpenProjects = useMemo(() => new Set<string>(), [groups]);
  const [openProjects, setOpenProjects] = useState(defaultOpenProjects);

  function toggleProject(projectPath: string) {
    setOpenProjects((current) => {
      const next = new Set(current);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <div className="side-head">
        <div className="mark">
          <AgentHubMark />
        </div>
        <div className="brand">Agent Hub</div>
        <button className="icon" title="新建" type="button">
          <svg viewBox="0 0 13 13" aria-hidden="true">
            <path
              d="M6.5 2v9M2 6.5h9"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      <CliSelector commandPath={commandPath} />

      <div className="sessions">
        {groups.length === 0 ? (
          <div className="proj">
            <button className="proj-head" type="button">
              <FolderIcon />
              <span className="proj-name">No Claude history</span>
              <span className="count">0</span>
            </button>
          </div>
        ) : null}
        {groups.map((group) => (
          <div className="proj" key={group.projectPath}>
            <button
              className="proj-head"
              type="button"
              aria-expanded={openProjects.has(group.projectPath)}
              onClick={() => toggleProject(group.projectPath)}
            >
              <span className="twisty" aria-hidden="true">
                {openProjects.has(group.projectPath) ? "▾" : "▸"}
              </span>
              <FolderIcon />
              <span className="proj-name">{group.projectName}</span>
              <span className="count">{group.sessions.length}</span>
            </button>
            {openProjects.has(group.projectPath) ? (
              <div className="sess-list">
                {group.sessions.map((session) => (
                  <button
                    className={`sess${
                      session.id === selectedSessionId ? " active" : ""
                    }`}
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                  >
                    {session.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="foot">
        <div className="avatar">L</div>
        <span className="foot-name">leo</span>
        <button
          className="icon"
          title="设置"
          type="button"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>
    </aside>
  );
}

function FolderIcon() {
  return (
    <svg className="folder" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.5 4.2c0-.55.45-1 1-1h3l1 1.2h5c.55 0 1 .45 1 1v5.4c0 .55-.45 1-1 1h-9c-.55 0-1-.45-1-1V4.2z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
