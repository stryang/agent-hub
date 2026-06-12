import { useMemo, useState } from "react";
import { FolderClosed, FolderOpen, Settings } from "lucide-react";
import type { AgentKind } from "../../shared/types/agent-events";
import type { ClaudeSessionGroup } from "../../shared/types/sessions";
import { CliSelector } from "./CliSelector";

type SidebarProps = {
  activeAgent: AgentKind;
  commandPath?: string;
  codexCommandPath?: string;
  groups: ClaudeSessionGroup[];
  selectedSessionId?: string;
  onSelectAgent: (agent: AgentKind) => void;
  onSelectSession: (sessionId: string) => void;
  onOpenSettings: () => void;
};

export function Sidebar({
  activeAgent,
  commandPath,
  codexCommandPath,
  groups,
  selectedSessionId,
  onSelectAgent,
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
      <span className="sr-only">Agent Hub</span>
      <div className="side-head" />

      <div className="sidebar-fixed">
        <CliSelector
          activeAgent={activeAgent}
          claudeCommandPath={commandPath}
          codexCommandPath={codexCommandPath}
          onSelectAgent={onSelectAgent}
        />
        <div className="section-label projects-label">项目</div>
      </div>

      <div className="project-list">
        {groups.length === 0 ? (
          <div className="proj">
            <button className="proj-head" type="button">
              <FolderClosed className="folder" aria-hidden="true" />
              <span className="proj-name">No Claude history</span>
              <span className="count">0</span>
            </button>
          </div>
        ) : null}
        {groups.map((group) => (
          <div className="proj" key={group.projectPath}>
            {openProjects.has(group.projectPath) ? (
              <ProjectRow
                count={group.sessions.length}
                isOpen={true}
                name={group.projectName}
                onClick={() => toggleProject(group.projectPath)}
              />
            ) : (
              <ProjectRow
                count={group.sessions.length}
                isOpen={false}
                name={group.projectName}
                onClick={() => toggleProject(group.projectPath)}
              />
            )}
            <div
              className={`sess-list${
                openProjects.has(group.projectPath) ? " open" : ""
              }`}
            >
              <div className="sess-list-inner">
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
            </div>
          </div>
        ))}
      </div>

      <div className="foot">
        <button
          className="settings-entry"
          title="设置"
          type="button"
          onClick={onOpenSettings}
        >
          <Settings className="settings-icon" aria-hidden="true" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}

function ProjectRow({
  count,
  isOpen,
  name,
  onClick,
}: {
  count: number;
  isOpen: boolean;
  name: string;
  onClick: () => void;
}) {
  const Icon = isOpen ? FolderOpen : FolderClosed;

  return (
    <button
      className="proj-head"
      type="button"
      aria-expanded={isOpen}
      onClick={onClick}
    >
      <Icon className="folder" aria-hidden="true" />
      <span className="proj-name">{name}</span>
      <span className="count">{count}</span>
    </button>
  );
}
