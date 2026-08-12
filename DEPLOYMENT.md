# MedFlow deployment

This runbook deploys the MVP surfaces defined in `render.yaml`: frontend, backend and unified AI. Analytics remains intentionally excluded until the P1 services are stable and access control is designed.

Render Free instances are appropriate for a portfolio/hackathon MVP, not a production healthcare workload.

## Prerequisites

- A GitHub repository containing this revision.
- A Neon PostgreSQL branch and a direct TLS connection string suitable for Prisma migrations.
- The potentially exposed historical Neon credential has been rotated according to `SECURITY_ROTATION.md`.
- The Neon schema is either managed by the committed Prisma migration history or has been correctly baselined. Do not run `prisma migrate deploy` blindly against a populated schema with no `_prisma_migrations` history.

## Create the Blueprint

1. In Render, choose **New → Blueprint** and connect `kieuwangtruong/MedFlow`.
2. Select branch `main` and the repository-root `render.yaml`.
3. During initial Blueprint creation, enter `DATABASE_URL` only in the secret prompt for `medflow-backend`.
4. Review the three services. Do not add analytics during this step.
5. Deploy the Blueprint.

The Blueprint wires service hostnames through Render-provided environment variables:

- frontend `VITE_API_BASE_URL` ← backend external hostname;
- frontend `VITE_API_TIMEOUT_MS` = `120000` to cover a chained backend/AI cold start;
- backend `APP_ORIGIN` ← frontend external hostname;
- backend `AI_SERVICE_URL` ← AI external hostname;
- backend `AI_SERVICE_API_KEY` ← AI-generated service key;
- backend `AI_REQUEST_TIMEOUT_MS` = `90000` to cover the AI service cold start;
- AI `DATABASE_URL` ← the backend secret;
- AI `CORS_ORIGINS` ← frontend external hostname.

The application normalises Render hostnames to HTTPS at runtime/build time. No Render domain is hard-coded.

## Database deployment gate

`medflow-backend` runs:

```text
npm run prisma:generate # build phase
npm run prisma:deploy
npm start
```

Prisma Client is generated once during the Render build instead of being regenerated on every Free-instance wake-up. The production start commands are chained with `&&`; Express does not start when migration fails. Production deployment never runs seed commands and never uses `prisma db push`.

Before the first deployment to a database that already contains data:

```powershell
Set-Location backend
$env:DATABASE_URL='<direct Neon URL supplied securely>'
npx.cmd prisma migrate status
```

If Prisma reports no migration table for a populated database, stop and baseline it using the official Prisma procedure. Do not reset the database.

## Verify deployment

1. AI health: `GET https://<ai-host>/health`.
2. Backend health: `GET https://<backend-host>/api/v1/health`.
3. Open the frontend and confirm network requests target the backend `/api/v1` path.
4. Run the synthetic smoke flow without printing the token or patient record:

```powershell
$env:SMOKE_BACKEND_URL='https://<backend-host>'
$env:SMOKE_PATIENT_CCCD='<dedicated synthetic 9-12 digit identifier>'
node scripts\smoke\e2e.mjs
```

The smoke script validates login/check-in → symptom submission → AI suggestion → room confirmation/queue creation → patient pathway. Use a dedicated synthetic record and remove it according to the environment's test-data policy.

## Service-specific deployment details

### medflow-frontend

- Root: `frontend`
- Runtime: Static
- Build: `npm ci && npm run build`
- Publish: `dist`
- SPA rewrite: `/* → /index.html`
- Production build fails if mock mode is not explicitly disabled or the backend hostname is missing.

### medflow-backend

- Root: `backend`
- Runtime: Node
- Build: `npm ci && npm run prisma:generate`
- Start: `npm run start:production`
- Database: external Neon secret
- Seed: never automatic

### medflow-ai

- Root: `ai`
- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Model artifacts are loaded once during FastAPI lifespan startup; training scripts are not part of startup.
- PostgreSQL URLs are normalised to the psycopg 3 SQLAlchemy dialect.

## Analytics

Do not publish Streamlit during the P1 rollout. It can read Neon and display operational aggregates, but it does not yet have an access-control layer. Continue using it locally with a read-only database role or demo fallback.
