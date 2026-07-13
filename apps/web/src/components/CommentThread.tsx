import { useState } from "react";

interface Comment {
  id: string;
  body: string;
  is_ai_generated: boolean;
  author_id?: string;
  created_at: string;
}

export function CommentThread({
  comments,
  onSubmit,
}: {
  comments: Comment[];
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="comment-thread">
      {comments.map((c) => (
        <div key={c.id} className={`comment ${c.is_ai_generated ? "comment--ai" : ""}`}>
          <div className="comment__meta">{c.is_ai_generated ? "AI reviewer" : "Reviewer"}</div>
          <div className="comment__body">{c.body}</div>
        </div>
      ))}
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onSubmit(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Leave a review comment…"
        />
        <button type="submit">Comment</button>
      </form>
    </div>
  );
}
