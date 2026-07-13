# CodeSentry — Real-Time Collaborative Code Review, Risk-Gated by ML

An AI-assisted pull-request review platform: reviewers see live cursors and
comments from teammates in real time, every diff hunk is scored by a
**trained classifier** for bug risk, and only the hunks flagged as
medium/high risk get an LLM-generated review suggestion — keeping AI cost
proportional to actual risk instead of running an expensive model on every
line.

## Architecture

```
┌─────────────┐        WebSocket + REST        ┌──────────────────────┐
│   web (SPA)  │ ─────────────────────────────▶ │   realtime-server     │
│ React + TS   │ ◀───────────────────────────── │  Node/TS, Socket.io   │
└─────────────┘        live risk/suggestions    │  Express, Postgres    │
                                                  └──────┬────────┬──────┘
                                                         │        │
                                          per diff hunk  │        │  hunks scored
                                                         ▼        ▼  medium/high only
                                          ┌───────────────────┐ ┌─────────────────────┐
                                          │  ml-risk-service    │ │  llm-agent-service   │
                                          │  FastAPI + XGBoost  │ │  FastAPI + Claude    │
                                          │  (trained classifier)│ │  (review suggestions)│
                                          └───────────────────┘ └─────────────────────┘
```

**Why this design, not just an LLM wrapper:** the risk classifier is trained
on real mined commit history (see `services/ml-risk-service/training/`),
not prompted — it's the genuine supervised-ML component of the project. The
LLM only gets called for hunks the classifier already flagged, which is
both a cost-control decision and a legitimate systems-design story for
interviews ("how do you keep an LLM feature from becoming a cost sink at
scale").

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Socket.io-client |
| Realtime/API | Node.js, TypeScript, Express, Socket.io, PostgreSQL |
| ML service | Python, FastAPI, XGBoost, scikit-learn, PyDriller (data mining) |
| LLM service | Python, FastAPI, Anthropic API |
| Infra | Docker, docker-compose, GitHub Actions CI/CD |

## Repo layout

```
apps/web/                    React frontend
services/realtime-server/    WebSocket + REST backend, Postgres schema
services/ml-risk-service/    Trained bug-risk classifier + training pipeline
services/llm-agent-service/  Claude-powered review suggestion agent
infra/                       Deployment notes, nginx config
.github/workflows/           CI (build/lint) + image publish
docker-compose.yml           Full local orchestration
```

## Running locally

```bash
git clone <your-fork-url>
cd ai-code-review-platform
cp .env.example .env        # fill in ANTHROPIC_API_KEY
docker compose up --build
```

Open http://localhost:4173. Create a PR via the API (the UI is a thin demo
shell — see below):

```bash
# 1. Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","displayName":"You"}'

# 2. Create a PR with a real git diff (use the returned token)
curl -X POST http://localhost:8000/api/pull-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "repositoryFullName": "you/demo-repo",
    "number": 1,
    "title": "Add retry logic",
    "diffText": "<paste output of `git diff` here>"
  }'
```

Paste the returned PR `id` into the frontend to watch risk scores and AI
suggestions stream in live via WebSocket.

## Training the real ML model

Out of the box, `ml-risk-service` runs on a transparent heuristic fallback
so the whole pipeline works before you've trained anything. To get the
actual trained classifier:

```bash
cd services/ml-risk-service
pip install -r requirements.txt
python training/mine_dataset.py --repo https://github.com/psf/requests --limit 3000
python training/train_model.py --data training/dataset.csv
python training/evaluate.py --data training/dataset.csv --model models/risk_model.joblib
```

This mines real commit history, labels hunks using a bug-fix-lookahead
heuristic (SZZ-style), trains an XGBoost classifier, and reports AUC/F1 —
genuine metrics you can cite on a resume, not placeholders.

## Deployment

See [`infra/deploy_notes.md`](infra/deploy_notes.md) for step-by-step
instructions (Railway is the fastest path; Render and Fly.io alternatives
included).

## Resume framing

> Built a real-time collaborative code review platform (React, Node.js,
> WebSockets, PostgreSQL) with a risk-gated AI review pipeline: a trained
> XGBoost classifier (mined from N commits across public repos, AUC X.XX)
> scores every diff hunk for bug risk, escalating only medium/high-risk
> hunks to an LLM agent for detailed review — cutting LLM calls by ~X% vs.
> reviewing every hunk while preserving review quality on risky changes.
> Deployed as 4 containerized microservices with CI/CD via GitHub Actions.

Fill in the X's after you run the training pipeline on a real repo — those
numbers are the difference between a generic bullet point and one that
survives a follow-up question.
