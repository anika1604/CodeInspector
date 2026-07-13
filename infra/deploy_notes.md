# Deployment Notes

This app is 4 deployable units + Postgres + Redis. Cheapest realistic path
for a portfolio deploy is **Railway** (backend services + Postgres) +
**Vercel** (frontend) — both have generous free/hobby tiers and deploy
straight from a Dockerfile or docker-compose.yml.

## Option A — Railway (recommended, simplest)

1. Create a new Railway project, "Deploy from GitHub repo".
2. Railway auto-detects `docker-compose.yml`... but for reliability, add
   each service as a **separate Railway service** pointing at its own
   Dockerfile path instead (Railway's compose support is best-effort):
   - `realtime-server` → root dir `services/realtime-server`
   - `ml-risk-service` → root dir `services/ml-risk-service`
   - `llm-agent-service` → root dir `services/llm-agent-service`
   - `web` → root dir `apps/web`, build arg `VITE_API_URL` = the public URL
     Railway assigns to `realtime-server`
3. Add a **Postgres** plugin (Railway → New → Database → PostgreSQL). Copy
   its `DATABASE_URL` into `realtime-server`'s environment variables.
4. Run the schema once: `railway run --service realtime-server psql $DATABASE_URL -f services/realtime-server/src/db/schema.sql`
   (or connect with any Postgres client and paste `schema.sql`).
5. Add a **Redis** plugin if/when you wire up the Socket.io Redis adapter
   for multi-instance scaling (not required for a single-instance MVP deploy).
6. Set environment variables per service:
   - `realtime-server`: `JWT_SECRET`, `ML_RISK_SERVICE_URL`, `LLM_AGENT_SERVICE_URL`, `WEB_ORIGIN`
   - `llm-agent-service`: `ANTHROPIC_API_KEY`
   - `web` (build arg): `VITE_API_URL`
7. Railway gives each service a public URL automatically — use the
   `realtime-server` URL as `VITE_API_URL` and the `web` URL as `WEB_ORIGIN`.

## Option B — Render

Same shape as Railway: 4 "Web Services" (Docker), 1 managed Postgres. Render's
free tier spins down on inactivity, which is fine for a demo but means the
first request after idle takes ~30s (worth mentioning in interviews as a
known tradeoff, not a bug).

## Option C — Fly.io

Best if you want to practice actual infra skills (fly.toml per service,
`fly postgres create`, `fly deploy` per app). More setup, more resume signal
if you're targeting infra-heavy SDE roles.

## Local production-like run

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY at minimum
docker compose up --build
```

- Frontend: http://localhost:4173
- API: http://localhost:8000
- ML service: http://localhost:8001/docs (FastAPI auto-docs)
- LLM agent service: http://localhost:8002/docs

## Training the real risk model before deploying

The ML service works out of the box with a heuristic fallback (see
`app/model.py`), but for the actual resume-worthy artifact you want the
trained classifier:

```bash
cd services/ml-risk-service
pip install -r requirements.txt
python training/mine_dataset.py --repo https://github.com/psf/requests --limit 3000
python training/train_model.py --data training/dataset.csv
python training/evaluate.py --data training/dataset.csv --model models/risk_model.joblib
```

This writes `models/risk_model.joblib`, which `app/model.py` picks up
automatically on next service start — rebuild/redeploy the `ml-risk-service`
image after training so the artifact ships inside the container.
