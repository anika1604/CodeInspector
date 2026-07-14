import { useState } from "react";
import { login, register } from "../lib/api";

export function AuthPanel({ onAuthed }: { onAuthed: (user: { displayName: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === "login" ? await login(email, password) : await register(email, password, displayName);
      onAuthed(user);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-panel__tabs">
        <button
          type="button"
          className={mode === "login" ? "auth-tab auth-tab--active" : "auth-tab"}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === "register" ? "auth-tab auth-tab--active" : "auth-tab"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "register" && (
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
