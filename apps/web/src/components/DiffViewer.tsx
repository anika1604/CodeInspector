import { RiskUpdate, SuggestionUpdate } from "../hooks/useCollabSocket";
import { RiskBadge } from "./RiskBadge";
import { CommentThread } from "./CommentThread";

interface Hunk {
  id: string;
  file_path: string;
  hunk_text: string;
}

export function DiffViewer({
  hunks,
  riskUpdates,
  suggestions,
  comments,
  onComment,
  onCursorMove,
}: {
  hunks: Hunk[];
  riskUpdates: Record<string, RiskUpdate>;
  suggestions: Record<string, SuggestionUpdate>;
  comments: any[];
  onComment: (hunkId: string, body: string) => void;
  onCursorMove: (hunkId: string, line: number) => void;
}) {
  return (
    <div className="diff-viewer">
      {hunks.map((hunk: any) => {
        // Prefer a live socket update; fall back to whatever the initial
        // REST fetch returned (analysis may have already completed before
        // this client joined the room — e.g. on page refresh, or if the PR
        // was created before the UI was opened).
        const risk: RiskUpdate | undefined =
          riskUpdates[hunk.id] ??
          (hunk.risk_score != null
            ? { hunkId: hunk.id, score: hunk.risk_score, label: hunk.risk_label }
            : undefined);

        const suggestion: SuggestionUpdate | undefined =
          suggestions[hunk.id] ??
          (hunk.summary
            ? {
                hunkId: hunk.id,
                summary: hunk.summary,
                suggestion: hunk.suggestion,
                severity: hunk.severity,
              }
            : undefined);

        const hunkComments = comments.filter((c) => c.diff_hunk_id === hunk.id);

        return (
          <div key={hunk.id} className="hunk-card" onMouseEnter={() => onCursorMove(hunk.id, 0)}>
            <div className="hunk-card__header">
              <span className="hunk-card__file">{hunk.file_path}</span>
              <RiskBadge risk={risk} />
            </div>

            <pre className="hunk-card__code">
              {hunk.hunk_text.split("\n").map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("+") && !line.startsWith("+++")
                      ? "diff-line diff-line--add"
                      : line.startsWith("-") && !line.startsWith("---")
                      ? "diff-line diff-line--remove"
                      : "diff-line"
                  }
                >
                  {line || " "}
                </div>
              ))}
            </pre>

            {suggestion && (
              <div className={`ai-suggestion ai-suggestion--${suggestion.severity}`}>
                <div className="ai-suggestion__summary">🤖 {suggestion.summary}</div>
                <div className="ai-suggestion__body">{suggestion.suggestion}</div>
              </div>
            )}

            <CommentThread comments={hunkComments} onSubmit={(body) => onComment(hunk.id, body)} />
          </div>
        );
      })}
    </div>
  );
}
