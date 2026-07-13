const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("csrf_free_dev_token"); // see note below
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// NOTE: token storage here uses localStorage for MVP simplicity. For a
// production deploy, prefer an httpOnly cookie set by the auth endpoint to
// avoid XSS token theft — called out explicitly since this is a common
// interview question about the project.
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  const data = await res.json();
  localStorage.setItem("csrf_free_dev_token", data.token);
  return data.user;
}

export async function register(email: string, password: string, displayName: string) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Registration failed");
  const data = await res.json();
  localStorage.setItem("csrf_free_dev_token", data.token);
  return data.user;
}

export async function createPullRequest(input: {
  repositoryFullName: string;
  number: number;
  title: string;
  diffText: string;
}) {
  const res = await fetch(`${API_URL}/api/pull-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to create PR");
  return res.json();
}

export async function getPullRequest(id: string) {
  const res = await fetch(`${API_URL}/api/pull-requests/${id}`);
  if (!res.ok) throw new Error("Failed to fetch PR");
  return res.json();
}

export async function postComment(pullRequestId: string, body: string, diffHunkId?: string, lineNumber?: number) {
  const res = await fetch(`${API_URL}/api/pull-requests/${pullRequestId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ body, diffHunkId, lineNumber }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to post comment");
  return res.json();
}

export { API_URL };
