export interface ParsedHunk {
  filePath: string;
  hunkIndex: number;
  hunkText: string;
  startLine: number;
  endLine: number;
  linesAdded: number;
  linesRemoved: number;
}

// Minimal unified-diff parser. Handles standard `diff --git` / `@@ ... @@`
// format as produced by `git diff`. Not a full patch-apply implementation —
// just enough structure extraction to feed hunks to the ML/LLM services.
export function parseUnifiedDiff(diffText: string): ParsedHunk[] {
  const lines = diffText.split("\n");
  const hunks: ParsedHunk[] = [];

  let currentFile = "unknown";
  let hunkIndex = 0;
  let buffer: string[] = [];
  let startLine = 0;
  let currentLine = 0;
  let added = 0;
  let removed = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    hunks.push({
      filePath: currentFile,
      hunkIndex: hunkIndex++,
      hunkText: buffer.join("\n"),
      startLine,
      endLine: currentLine,
      linesAdded: added,
      linesRemoved: removed,
    });
    buffer = [];
    added = 0;
    removed = 0;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      flush();
      hunkIndex = 0;
      const match = line.match(/b\/(\S+)$/);
      currentFile = match ? match[1] : "unknown";
      continue;
    }
    if (line.startsWith("@@")) {
      flush();
      const match = line.match(/\+(\d+)/);
      startLine = match ? parseInt(match[1], 10) : 0;
      currentLine = startLine;
      buffer.push(line);
      continue;
    }
    if (buffer.length === 0) continue; // skip file headers (---, +++, index)

    buffer.push(line);
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added++;
      currentLine++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed++;
    } else {
      currentLine++;
    }
  }
  flush();

  return hunks;
}
