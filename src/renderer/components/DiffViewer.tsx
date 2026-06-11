type DiffViewerProps = {
  unifiedDiff: string;
};

type ParsedDiffLine = {
  id: string;
  kind: "hunk" | "add" | "del" | "ctx";
  lineNumber: string;
  sign: string;
  code: string;
};

export function DiffViewer({ unifiedDiff }: DiffViewerProps) {
  const lines = parseDiff(unifiedDiff);

  return (
    <div className="diff">
      {lines.map((line) =>
        line.kind === "hunk" ? (
          <span className="hunk" key={line.id}>
            {line.code}
          </span>
        ) : (
          <div
            className={`row${line.kind === "add" ? " add" : ""}${
              line.kind === "del" ? " del" : ""
            }`}
            key={line.id}
          >
            <span className="ln">{line.lineNumber}</span>
            <span className="sign">{line.sign}</span>
            <span className="code">{line.code}</span>
          </div>
        ),
      )}
    </div>
  );
}

function parseDiff(unifiedDiff: string): ParsedDiffLine[] {
  let oldLine = 0;
  let newLine = 0;

  return unifiedDiff.split(/\r?\n/).map((rawLine, index) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(
      rawLine,
    );
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      return {
        id: `${index}:hunk`,
        kind: "hunk",
        lineNumber: "",
        sign: "",
        code: rawLine,
      };
    }

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      const line = newLine;
      newLine += 1;
      return {
        id: `${index}:add`,
        kind: "add",
        lineNumber: String(line || ""),
        sign: "+",
        code: rawLine.slice(1),
      };
    }

    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      const line = oldLine;
      oldLine += 1;
      return {
        id: `${index}:del`,
        kind: "del",
        lineNumber: String(line || ""),
        sign: "-",
        code: rawLine.slice(1),
      };
    }

    if (!rawLine.startsWith("\\ No newline")) {
      oldLine += oldLine > 0 ? 1 : 0;
      newLine += newLine > 0 ? 1 : 0;
    }

    return {
      id: `${index}:ctx`,
      kind: "ctx",
      lineNumber: String(newLine > 0 ? newLine - 1 : ""),
      sign: rawLine.startsWith("\\") ? "\\" : "",
      code: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine,
    };
  });
}
