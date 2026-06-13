import { FileText, Globe } from "lucide-react";
import type { ReactNode } from "react";
import { DiffViewer } from "./DiffViewer";

type MarkdownMessageProps = {
  text: string;
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; language?: string; code: string }
  | { type: "rule" };

export function MarkdownMessage({ text }: MarkdownMessageProps) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className="markdown-message">
      {blocks.map((block, index) => (
        <MarkdownBlock block={block} key={index} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block }: { block: Block }) {
  if (block.type === "heading") {
    const content = renderInline(block.text);
    if (block.level === 1) return <h1>{content}</h1>;
    if (block.level === 2) return <h2>{content}</h2>;
    return <h3>{content}</h3>;
  }

  if (block.type === "paragraph") {
    return <p>{renderInline(block.lines.join(" "))}</p>;
  }

  if (block.type === "list") {
    const items = block.items.map((item, index) => (
      <li key={index}>{renderInline(item)}</li>
    ));

    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }

  if (block.type === "code") {
    if (block.language === "diff" || isUnifiedDiff(block.code)) {
      return <DiffViewer unifiedDiff={block.code} />;
    }
    return (
      <pre>
        {block.language ? <span className="code-lang">{block.language}</span> : null}
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === "table") {
    return (
      <div className="md-table-wrap">
        <table>
          <thead>
            <tr>
              {block.headers.map((header, index) => (
                <th key={index}>{renderInline(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {block.headers.map((_, cellIndex) => (
                  <td key={cellIndex}>{renderInline(row[cellIndex] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <hr />;
}

function parseMarkdownBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: { language?: string; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^```([\w-]+)?\s*$/);
    if (fence) {
      if (code) {
        blocks.push({
          type: "code",
          language: code.language,
          code: code.lines.join("\n"),
        });
        code = null;
      } else {
        flushTextBlocks();
        code = { language: fence[1], lines: [] };
      }
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    if (line.trim().length === 0) {
      flushTextBlocks();
      continue;
    }

    const nextLine = lines[index + 1] ?? "";
    if (isPipeTableHeader(line) && isPipeTableSeparator(nextLine)) {
      flushTextBlocks();
      const headers = parsePipeRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && isPipeTableRow(lines[index])) {
        rows.push(normalizeTableRow(parsePipeRow(lines[index]), headers.length));
        index += 1;
      }

      index -= 1;
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushTextBlocks();
      blocks.push({ type: "rule" });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushTextBlocks();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    const orderedItem = line.match(/^\s*\d+\.\s+(.+)$/);
    const unorderedItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (orderedItem || unorderedItem) {
      flushParagraph();
      const ordered = Boolean(orderedItem);
      const item = (orderedItem ?? unorderedItem)?.[1] ?? "";
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (code) {
    blocks.push({
      type: "code",
      language: code.language,
      code: code.lines.join("\n"),
    });
  }
  flushTextBlocks();

  return blocks;
}

function parsePipeRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isPipeTableHeader(line: string) {
  return line.includes("|") && parsePipeRow(line).length > 1;
}

function isPipeTableRow(line: string) {
  return line.includes("|") && line.trim().length > 0;
}

function isPipeTableSeparator(line: string) {
  const cells = parsePipeRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeTableRow(row: string[], cellCount: number) {
  if (row.length >= cellCount) {
    return row.slice(0, cellCount);
  }

  return [...row, ...Array.from({ length: cellCount - row.length }, () => "")];
}

function isUnifiedDiff(text: string): boolean {
  return text.split("\n").some((l) => /^@@ -.+ \+.+ @@/.test(l));
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

function openExternal(url: string) {
  void window.agentHub.openExternal(url);
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else {
      const linkText = match[2];
      const url = match[3];
      if (isExternalUrl(url)) {
        nodes.push(
          <a
            key={nodes.length}
            style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}
            onClick={() => openExternal(url)}
          >
            <Globe size={13} style={{ flex: "none" }} />
            {linkText}
          </a>,
        );
      } else {
        nodes.push(
          <span
            key={nodes.length}
            style={{ color: "var(--accent)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
            onClick={() => void window.agentHub.showItemInFolder(url)}
          >
            <FileText size={13} style={{ flex: "none" }} />
            {linkText}
          </span>,
        );
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
