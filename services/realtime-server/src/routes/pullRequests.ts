import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, AuthedRequest } from "../middleware/authMiddleware";
import { parseUnifiedDiff } from "../lib/diffParser";
import { fetchRiskScore } from "../lib/mlClient";
import { fetchAiSuggestion } from "../lib/llmClient";
import { io } from "../index";

export const pullRequestsRouter = Router();

// Create a PR: stores the diff, splits it into hunks, kicks off async AI analysis.
pullRequestsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const { repositoryFullName, number, title, diffText } = req.body ?? {};
  if (!repositoryFullName || !number || !title || !diffText) {
    return res.status(400).json({ error: "repositoryFullName, number, title, diffText required" });
  }

  try {
    let repoResult = await pool.query("SELECT id FROM repositories WHERE full_name = $1", [
      repositoryFullName,
    ]);
    if (!repoResult.rowCount) {
      repoResult = await pool.query(
        "INSERT INTO repositories (full_name) VALUES ($1) RETURNING id",
        [repositoryFullName]
      );
    }
    const repositoryId = repoResult.rows[0].id;

    const prResult = await pool.query(
      `INSERT INTO pull_requests (repository_id, number, title, author_id, diff_text)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [repositoryId, number, title, req.userId, diffText]
    );
    const pullRequestId = prResult.rows[0].id;

    const hunks = parseUnifiedDiff(diffText);
    const hunkIds: string[] = [];
    for (const hunk of hunks) {
      const hunkResult = await pool.query(
        `INSERT INTO diff_hunks (pull_request_id, file_path, hunk_index, hunk_text, start_line, end_line)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [pullRequestId, hunk.filePath, hunk.hunkIndex, hunk.hunkText, hunk.startLine, hunk.endLine]
    );
      hunkIds.push(hunkResult.rows[0].id);
    }

    res.status(201).json({ id: pullRequestId, hunkCount: hunks.length });

    // Fire-and-forget AI analysis pipeline. Results stream to clients via the
    // PR's socket.io room as they complete, so the UI updates incrementally
    // instead of blocking on the full pipeline before responding.
    void analyzePullRequest(pullRequestId, hunks, hunkIds);
  } catch (err: any) {
    if (err?.code === "23505") {
      // Postgres unique_violation — this repo+number combo already exists.
      return res.status(409).json({
        error: `PR #${number} already exists for ${repositoryFullName}. Use a different number.`,
      });
    }
    // eslint-disable-next-line no-console
    console.error("Failed to create pull request", err);
    return res.status(500).json({ error: "Failed to create pull request" });
  }
});

async function analyzePullRequest(
  pullRequestId: string,
  hunks: ReturnType<typeof parseUnifiedDiff>,
  hunkIds: string[]
) {
  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i];
    const hunkId = hunkIds[i];

    try {
      const risk = await fetchRiskScore({
        filePath: hunk.filePath,
        hunkText: hunk.hunkText,
        linesAdded: hunk.linesAdded,
        linesRemoved: hunk.linesRemoved,
      });

      await pool.query(
        `INSERT INTO risk_scores (diff_hunk_id, risk_score, risk_label, model_version, feature_vector)
         VALUES ($1, $2, $3, $4, $5)`,
        [hunkId, risk.score, risk.label, risk.modelVersion, JSON.stringify(risk.features)]
      );

      io.to(`pr:${pullRequestId}`).emit("risk_score", { hunkId, ...risk });

      // Only spend LLM tokens on hunks the classifier actually flagged —
      // this is the "risk-gated" design that keeps LLM cost proportional
      // to real risk instead of reviewing every line with an expensive model.
      if (risk.label !== "low") {
        const suggestion = await fetchAiSuggestion({
          filePath: hunk.filePath,
          hunkText: hunk.hunkText,
          riskScore: risk.score,
        });

        await pool.query(
          `INSERT INTO ai_suggestions (diff_hunk_id, summary, suggestion, severity)
           VALUES ($1, $2, $3, $4)`,
          [hunkId, suggestion.summary, suggestion.suggestion, suggestion.severity]
        );

        io.to(`pr:${pullRequestId}`).emit("ai_suggestion", { hunkId, ...suggestion });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Analysis failed for hunk ${hunkId}`, err);
      io.to(`pr:${pullRequestId}`).emit("analysis_error", { hunkId });
    }
  }

  io.to(`pr:${pullRequestId}`).emit("analysis_complete", { pullRequestId });
}

pullRequestsRouter.get("/:id", async (req, res) => {
  const pr = await pool.query("SELECT * FROM pull_requests WHERE id = $1", [req.params.id]);
  if (!pr.rowCount) return res.status(404).json({ error: "Not found" });

  const hunks = await pool.query(
    `SELECT h.*, r.risk_score, r.risk_label, s.summary, s.suggestion, s.severity
     FROM diff_hunks h
     LEFT JOIN risk_scores r ON r.diff_hunk_id = h.id
     LEFT JOIN ai_suggestions s ON s.diff_hunk_id = h.id
     WHERE h.pull_request_id = $1
     ORDER BY h.hunk_index`,
    [req.params.id]
  );

  res.json({ pullRequest: pr.rows[0], hunks: hunks.rows });
});

pullRequestsRouter.post("/:id/comments", requireAuth, async (req: AuthedRequest, res) => {
  const { body, diffHunkId, lineNumber } = req.body ?? {};
  if (!body) return res.status(400).json({ error: "body is required" });

  const result = await pool.query(
    `INSERT INTO comments (pull_request_id, diff_hunk_id, author_id, body, line_number)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.params.id, diffHunkId ?? null, req.userId, body, lineNumber ?? null]
  );

  const comment = result.rows[0];
  io.to(`pr:${req.params.id}`).emit("new_comment", comment);
  res.status(201).json(comment);
});
