import { useState } from "react";
import { createPullRequest } from "../lib/api";

export function CreatePrForm({ onCreated }: { onCreated: (pullRequestId: string) => void }) {
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [number, setNumber] = useState("1");
  const [title, setTitle] = useState("");
  const [diffText, setDiffText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!repositoryFullName.trim() || !title.trim() || !diffText.trim()) {
      setError("Repository, title, and diff are all required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPullRequest({
        repositoryFullName: repositoryFullName.trim(),
        number: parseInt(number, 10) || 1,
        title: title.trim(),
        diffText,
      });
      onCreated(result.id);
    } catch (err: any) {
      setError(err.message || "Failed to create pull request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="create-pr-form" onSubmit={handleSubmit}>
      <div className="create-pr-form__row">
        <input
          placeholder="owner/repo"
          value={repositoryFullName}
          onChange={(e) => setRepositoryFullName(e.target.value)}
        />
        <input
          type="number"
          placeholder="#"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="create-pr-form__number"
        />
      </div>

      <input placeholder="PR title" value={title} onChange={(e) => setTitle(e.target.value)} />

      <textarea
        placeholder={"Paste a unified diff here (output of `git diff`)…"}
        value={diffText}
        onChange={(e) => setDiffText(e.target.value)}
        rows={10}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? "Analyzing…" : "Create PR & Start Review"}
      </button>

      {error && <div className="auth-error">{error}</div>}
    </form>
  );
}
