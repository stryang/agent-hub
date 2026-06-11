import { useState } from "react";

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

export function CodexLogo() {
  return (
    <svg
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Codex</title>
      <path
        d="M19.503 0H4.496A4.496 4.496 0 000 4.496v15.007A4.496 4.496 0 004.496 24h15.007A4.496 4.496 0 0024 19.503V4.496A4.496 4.496 0 0019.503 0z"
        fill="#fff"
      />
      <path
        d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z"
        fill="url(#codex-gradient)"
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="codex-gradient"
          x1="12"
          x2="12"
          y1="3"
          y2="21"
        >
          <stop stopColor="#B1A7FF" />
          <stop offset=".5" stopColor="#7A9DFF" />
          <stop offset="1" stopColor="#3941FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HermesLogo() {
  return (
    <svg
      fill="currentColor"
      fillRule="evenodd"
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Hermes Agent</title>
      <circle cx="12" cy="12" r="10" fill="#7C3AED" />
      <path
        d="M7 15.6c1.7-3.4 3.6-6.2 5.7-8.4 1.5.8 2.7 2.2 3.6 4.1-1.2-.5-2.4-.6-3.5-.2 1.5.7 2.8 1.9 3.9 3.5-2.2-1-4.2-1.1-6-.4-.8.3-2.1.8-3.7 1.4z"
        fill="#fff"
      />
    </svg>
  );
}

function GeminiLogo() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9.5" fill="#1a73e8" />
      <path
        d="M10 3.5C10 7 7 10 3.5 10 7 10 10 13 10 16.5 10 13 13 10 16.5 10 13 10 10 7 10 3.5z"
        fill="#fff"
      />
    </svg>
  );
}

function CustomLogo() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9.5" fill="#4a4a5a" />
      <path
        d="M6 10l2.5 2.5L14 7"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const options = [
  {
    id: "claude-code",
    name: "Claude Code",
    path: "~/.local/bin/claude",
    logo: <ClaudeLogo />,
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    path: "~/.local/bin/codex",
    logo: <CodexLogo />,
  },
  {
    id: "hermes-agent",
    name: "Hermes Agent",
    path: "~/.local/bin/hermes",
    logo: <HermesLogo />,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    path: "~/.local/bin/gemini",
    logo: <GeminiLogo />,
  },
  {
    id: "custom",
    name: "自定义 CLI",
    path: "/usr/local/bin/myagent",
    logo: <CustomLogo />,
  },
];

export function CliSelector({ commandPath }: CliSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = options[0];

  return (
    <div className="cli-wrap">
      <button
        className={`cli-btn${open ? " open" : ""}`}
        id="cliBtn"
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="logo" id="cliBtnLogo">
          {selected.logo}
        </span>
        <span className="cli-name" id="cliBtnName">
          {selected.name}
        </span>
        <span className="caret">v</span>
      </button>
      <div className={`cli-menu${open ? " open" : ""}`} id="cliMenu">
        {options.map((option) => (
          <button
            className={`cli-opt${option.id === selected.id ? " sel" : ""}`}
            data-id={option.id}
            key={option.id}
            type="button"
            disabled={option.id !== selected.id}
          >
            <span className="logo">{option.logo}</span>
            <div className="cli-meta">
              <b>{option.name}</b>
              <div className="cli-path">
                {option.id === "claude-code" && commandPath
                  ? commandPath
                  : option.path}
              </div>
            </div>
            <span className="check">✓</span>
          </button>
        ))}
      </div>
    </div>
  );
}
