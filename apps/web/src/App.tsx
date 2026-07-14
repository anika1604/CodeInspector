import { useEffect, useState } from "react";
import { DiffViewer } from "./components/DiffViewer";
import { PresenceBar } from "./components/PresenceBar";
import { AuthPanel } from "./components/AuthPanel";
import { CreatePrForm } from "./components/CreatePrForm";
import { useCollabSocket } from "./hooks/useCollabSocket";
import { getPullRequest, postComment } from "./lib/api";
import "./app.css";

export default function App() {
  const [pullRequestId, setPullRequestId] = useState<string>("");
  const [hunks, setHunks] = useState<any[]>([]);
  const [initialComments, setInitialComments] = useState<any[]>([]);
  const [userId] = useState(() => crypto.randomUUID());
  const [currentUser, setCurrentUser] = useState<{ displayName: string } | null>(null);

  // Restore session on refresh: a token in localStorage means we're already
  // logged in, but we don't have the display name cached — good enough for
  // this demo shell to just show a generic label rather than re-prompting.
  useEffect(() => {
    if (localStorage.getItem("csrf_free_dev_token")) {
      setCurrentUser((prev) => prev ?? { displayName: "You" });
    }
  }, []);

  const { presence, riskUpdates, suggestions, comments, analysisComplete, moveCursor } =
    useCollabSocket(pullRequestId, userId, currentUser?.displayName ?? "Anonymous");

  useEffect(() => {
    if (!pullRequestId) return;
    getPullRequest(pullRequestId).then((data) => {
      setHunks(data.hunks);
      setInitialComments([]);
    });
  }, [pullRequestId]);

  const allComments = [...initialComments, ...comments];

  function handleLogout() {
    localStorage.removeItem("csrf_free_dev_token");
    setCurrentUser(null);
    setPullRequestId("");
    setHunks([]);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__top">
          <div>
            <h1>CodeSentry</h1>
            <p className="app-header__subtitle">
              Real-time collaborative code review, risk-gated by a trained classifier.
            </p>
          </div>
          {currentUser && (
            <button className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      {!currentUser ? (
        <AuthPanel onAuthed={(user) => setCurrentUser(user)} />
      ) : (
        <>
          <section className="section-block">
            <h2 className="section-title">Start a new review</h2>
            <CreatePrForm onCreated={(id) => setPullRequestId(id)} />
          </section>

          <section className="section-block">
            <h2 className="section-title">Or open an existing PR</h2>
            <div className="pr-loader">
              <input
                placeholder="Paste a pull request ID to open…"
                value={pullRequestId}
                onChange={(e) => setPullRequestId(e.target.value)}
              />
            </div>
          </section>

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
        </>
      )}
    </div>
  );
}
