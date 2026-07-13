-- CodeSentry schema
-- Run against Postgres. Applied automatically by docker-compose on first boot
-- (mounted into /docker-entrypoint-initdb.d) or manually via psql.

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repositories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT UNIQUE NOT NULL,        -- e.g. "owner/repo"
    default_branch TEXT NOT NULL DEFAULT 'main',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number        INTEGER NOT NULL,
    title         TEXT NOT NULL,
    author_id     UUID REFERENCES users(id),
    status        TEXT NOT NULL DEFAULT 'open',   -- open | merged | closed
    diff_text     TEXT NOT NULL,                  -- raw unified diff, cached
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(repository_id, number)
);

CREATE TABLE IF NOT EXISTS diff_hunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    hunk_index      INTEGER NOT NULL,
    hunk_text       TEXT NOT NULL,
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diff_hunk_id    UUID NOT NULL REFERENCES diff_hunks(id) ON DELETE CASCADE,
    risk_score      REAL NOT NULL,              -- 0..1 probability of bug-inducing change
    risk_label      TEXT NOT NULL,              -- low | medium | high
    model_version   TEXT NOT NULL,
    feature_vector  JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diff_hunk_id    UUID NOT NULL REFERENCES diff_hunks(id) ON DELETE CASCADE,
    summary         TEXT NOT NULL,
    suggestion      TEXT NOT NULL,
    severity        TEXT NOT NULL,              -- info | warning | critical
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    diff_hunk_id    UUID REFERENCES diff_hunks(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES users(id),
    is_ai_generated BOOLEAN NOT NULL DEFAULT false,
    body            TEXT NOT NULL,
    line_number     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hunks_pr ON diff_hunks(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_comments_pr ON comments(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_risk_hunk ON risk_scores(diff_hunk_id);
