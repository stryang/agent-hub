type CliSelectorProps = {
  commandPath?: string;
};

export function ClaudeLogo() {
  return (
    <svg
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Claude Code</title>
      <path
        clipRule="evenodd"
        d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
        fill="#D97757"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function CliSelector({ commandPath }: CliSelectorProps) {
  return (
    <div className="cli-wrap">
      <button
        className="cli-btn"
        id="cliBtn"
        type="button"
        aria-label="Claude Code"
      >
        <span className="logo" id="cliBtnLogo">
          <ClaudeLogo />
        </span>
        <span className="cli-name" id="cliBtnName">
          Claude Code
        </span>
      </button>
      <div className="cli-menu" id="cliMenu">
        <button className="cli-opt sel" data-id="claude-code" type="button">
          <span className="logo">
            <ClaudeLogo />
          </span>
          <div className="cli-meta">
            <b>Claude Code</b>
            <div className="cli-path">{commandPath ?? "~/.local/bin/claude"}</div>
          </div>
          <span className="check">✓</span>
        </button>
      </div>
    </div>
  );
}
