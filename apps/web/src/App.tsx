import { useEffect, useState } from "react";
import { DiffViewer } from "./components/DiffViewer";
import { PresenceBar } from "./components/PresenceBar";
import { useCollabSocket } from "./hooks/useCollabSocket";
import { getPullRequest, postComment } from "./lib/api";
import "./app.css";

// Demo scaffolding: in a real deploy this comes from routing (/pr/:id) and
// an auth context. Left as local state here so the whole flow is visible
// in one file for a portfolio walkthrough.
export default function App() {
  const [pullRequestId, setPullRequestId] = useState<string>("");
  const [hunks, setHunks] = useState<any[]>([]);
  const [initialComments, setInitialComments] = useState<any[]>([]);
  const [userId] = useState(() => crypto.randomUUID());
  const [displayName] = useState("You");

  const { presence, riskUpdates, suggestions, comments, analysisComplete, moveCursor } =
    useCollabSocket(pullRequestId, userId, displayName);

  useEffect(() => {
    if (!pullRequestId) return;
    getPullRequest(pullRequestId).then((data) => {
      setHunks(data.hunks);
      setInitialComments([]);
    });
  }, [pullRequestId]);

  const allComments = [...initialComments, ...comments];

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>CodeSentry</h1>
        <p className="app-header__subtitle">
          Real-time collaborative code review, risk-gated by a trained classifier.
        </p>
      </header>

      <div className="pr-loader">
        <input
          placeholder="Paste a pull request ID to open…"
          value={pullRequestId}
          onChange={(e) => setPullRequestId(e.target.value)}
        />
      </div>

      {pullRequestId && (
        <>
          <div className="pr-toolbar">
            <PresenceBar presence={presence} />
            <span className="analysis-status">
              {analysisComplete ? "Analysis complete" : "Analyzing hunks…"}
            </span>
          </div>

          <DiffViewer
            hunks={hunks}
            riskUpdates={riskUpdates}
            suggestions={suggestions}
            comments={allComments}
            onCursorMove={moveCursor}
            onComment={(hunkId, body) => postComment(pullRequestId, body, hunkId)}
          />
        </>
      )}
    </div>
  );
}
