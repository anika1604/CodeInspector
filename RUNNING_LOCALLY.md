# Running CodeSentry Locally (No Docker)

This is the validated path: 4 services in 4 terminals, plus a free hosted
Postgres instance. No Docker required.

## Prerequisites

- Node.js 20+
- Python 3.11+
- A free Postgres database — [neon.tech](https://neon.tech), sign up, create
  a project, copy the connection string.
- A free Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## One-time setup: database schema

Open your Neon project's web SQL editor and paste in the entire contents of
`services/realtime-server/src/db/schema.sql`, then run it. This creates all
tables (`users`, `pull_requests`, `diff_hunks`, `risk_scores`,
`ai_suggestions`, `comments`) plus the `pgcrypto` extension needed for UUID
generation.

## Terminal 1 — ml-risk-service (port 8001)

```powershell
cd services\ml-risk-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Verify: http://localhost:8001/health → `{"status":"ok", "using_fallback_heuristic":true, ...}`

(`using_fallback_heuristic: true` is expected until you train the real
XGBoost model — see "Training the real model" below.)

## Terminal 2 — llm-agent-service (port 8002)

```powershell
cd services\llm-agent-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
$env:GEMINI_API_KEY="your-gemini-api-key"
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

Verify: http://localhost:8002/health → `{"status":"ok"}`

## Terminal 3 — realtime-server (port 8000)

```powershell
cd services\realtime-server
npm install
$env:DATABASE_URL="your-neon-connection-string"
$env:JWT_SECRET="dev-secret-change-me"
$env:ML_RISK_SERVICE_URL="http://localhost:8001"
$env:LLM_AGENT_SERVICE_URL="http://localhost:8002"
$env:WEB_ORIGIN="http://localhost:5173"
npm run dev
```

Verify: http://localhost:8000/health → `{"status":"ok"}`

## Terminal 4 — web frontend (port 5173)

```powershell
cd apps\web
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

Opens at http://localhost:5173.

**Note:** each of these `$env:` variables only lasts for that PowerShell
session. If you close a terminal and reopen it, you need to re-set the
variables before running the service again. For a permanent setup, put them
in a `.env` file per service and use a tool like `dotenv-cli`, or just keep
a text file with these commands ready to paste.

## Creating a test PR (there's no "create PR" form in the UI yet)

In a 5th terminal, once `realtime-server` is running:

```powershell
$registerBody = @{
    email = "you@example.com"
    password = "password123"
    displayName = "You"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" `
    -Method Post -ContentType "application/json" -Body $registerBody
$token = $registerResponse.token

$prBody = @{
    repositoryFullName = "you/demo-repo"
    number = 1
    title = "Test PR"
    diffText = "diff --git a/app.py b/app.py`nindex 111..222 100644`n--- a/app.py`n+++ b/app.py`n@@ -1,3 +1,5 @@`n def divide(a, b):`n+    if b == 0:`n+        return None`n     return a / b`n"
} | ConvertTo-Json

$prResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/pull-requests" `
    -Method Post -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $prBody

$prResponse.id   # paste this into the frontend
```

Paste the printed `id` into the CodeSentry UI's input box. You'll see the
diff render, a risk badge appear within a second or two, and — if the hunk
scored medium/high risk — a Gemini-generated review suggestion shortly after.

## Training the real ML model (swap out the heuristic fallback)

```powershell
cd services\ml-risk-service
venv\Scripts\activate
python training\mine_dataset.py --repo https://github.com/psf/requests --limit 3000
python training\train_model.py --data training\dataset.csv
python training\evaluate.py --data training\dataset.csv --model models\risk_model.joblib
```

This mines real commit history, trains an XGBoost classifier, and writes
`models/risk_model.joblib`. Restart the `ml-risk-service` terminal (Ctrl+C,
re-run the `uvicorn` command) and `/health` should now report
`"using_fallback_heuristic": false` with a real model version. This is the
step that turns your resume bullet's AUC/F1 numbers from placeholders into
real, defensible metrics.

## Shutting everything down

Ctrl+C in each of the 4 terminals. Nothing runs in the background — no
Docker daemon, no lingering containers.

## Moving to Docker later

Once this native setup is solid, `docker compose up --build` packages the
exact same 4 services into containers with the exact same env vars (see
`docker-compose.yml` and `.env.example` at the repo root) — useful for the
deployment step, not required for local development.
