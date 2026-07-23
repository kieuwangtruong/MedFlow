# MedFlow repository audit

Audit date: 2026-07-23
Audited revision: `6484c75` on `codex/personal-deploy` / `personal/main`

## Executive summary

MedFlow is a monorepo with four runnable surfaces:

- `frontend`: React 19, TypeScript, Vite static application.
- `backend`: Express 5, Prisma 7 and PostgreSQL/Neon API.
- `ai`: unified FastAPI entrypoint combining peak-hour forecasting, Vietnamese symptom routing, wait-time/queue estimation and service-sequence optimisation.
- `analytics`: PostgreSQL-first Python analytics pipeline with a Streamlit dashboard and demo-data fallback.

The repository is not ready to be described as production-ready. The current Render Blueprint deploys only the frontend. Production builds can silently use mock data, backend production secrets have unsafe defaults, doctor decisions and the admin timeline are not fully persisted, and health checks do not represent dependency readiness.

The highest-priority finding is a tracked AI `.env` file containing a `DATABASE_URL` variable. The file also exists in multiple historical commits. No secret value was read or printed during this audit. The credential must be treated as potentially exposed until the Neon owner rotates it and completes the history-cleanup procedure documented in `SECURITY_ROTATION.md`.

## Findings

| Hạng mục | Hiện trạng | Rủi ro | Mức độ | Cách sửa |
|---|---|---|---|---|
| Tracked environment files | `ai/peak_hour_prediction/.env` and `ai/process_input_data/.env` are tracked; the former declares `DATABASE_URL` | A database credential may be present in the current tree and Git history | P0 | Untrack all `.env` files, add repository-wide ignore rules, rotate Neon credentials, and clean history with an owner-approved procedure |
| Git history | The tracked AI `.env` paths appear in multiple earlier commits | Removing the current file does not revoke or erase an exposed credential | P0 | Rotate first, then use `git filter-repo` or BFG and coordinate a safe force-push/re-clone |
| Ignore rules | Root ignores `.env`, `.env.local` and `.env.*.local`, but not every `.env.*`; rules vary by service | Future secrets can be recommitted | P0 | Standardise `.env`, `.env.*`, `!.env.example` at repository and service scope |
| Secret scanning | No CI workflow or repository script scans committed content | Secret regressions are not blocked | P0 | Add a CI secret-scanning job and a local scan command with allowlisted placeholders only |
| Hard-coded credentials | Demo seed/readme/config files contain password-like literals; backend has a development JWT fallback | A production environment can start with known credentials or weak signing material | P0 | Require secrets in production, keep demo credentials explicitly development-only, and never run production seed by default |
| Backend configuration validation | Missing `DATABASE_URL` fails later during Prisma initialisation; missing `JWT_SECRET` falls back; `APP_ORIGIN` falls back to `*` | Unsafe or confusing startup and permissive production CORS | P0 | Validate all required production variables before importing the database/client; fail with variable names only |
| Frontend mock selection | `VITE_USE_MOCK_API !== 'false'`, so an unset production variable silently enables mock mode | A successful public build can present demo data as if it were live | P1 | Preserve development mock mode but fail a production build when the flag/base URL is missing; set `false` in Render |
| Render Blueprint | Only one static frontend service is defined | Backend, Neon integration and AI are not reproducibly deployed | P1 | Define frontend, backend and AI services; defer analytics until P1 is stable |
| Backend deploy/start | `npm start` only launches Express; Prisma generation/migration is not an enforced deployment gate | Backend may start against an incompatible database | P1 | Use `prisma generate`, `prisma migrate deploy`, then start; do not seed automatically |
| Migration safety | Five committed migrations exist. Audit found no `DROP`, `DELETE FROM` or `TRUNCATE`; an early migration adds enum values and nullable/defaulted columns | Empty/existing-database behaviour is not covered by automated integration tests | P1 | Test a clean database and an existing-schema upgrade; document backup and forward-fix rollback |
| Backend health | `/api/v1/health` checks process only | Render cannot distinguish liveness from Neon/AI readiness | P1 | Add `/health/live`, `/health/ready`, `/health/version` and keep the old endpoint compatible |
| AI health | Components expose legacy health endpoints but no consistent live/ready contract across the unified app | Model-load and dependency failures are not reported consistently | P1 | Add unified live/ready endpoints that report model readiness without paths or credentials |
| AI runtime dependencies | Unified requirements include SQLAlchemy but not the PostgreSQL driver documented by the wait-time module | PostgreSQL-backed AI persistence can fail after deployment | P1 | Add and test the required driver without changing the API contract |
| AI CORS | Unified AI entrypoint hard-codes local origins and the old Render frontend URL | New deployments require code edits and can drift | P1 | Read allowlisted origins from environment; backend-to-AI calls remain server-side |
| Backend-to-AI gateway | A 20-second timeout and 502/504 mapping already exist | Behaviour must not regress during deployment work | P1 | Preserve the gateway contract and add readiness/smoke tests |
| Doctor examination persistence | Notes, AI accept/reject state, override reason and rerouting checkbox are frontend-local | Reload loses clinical/operational decisions; UI claims audit storage that does not exist | P1 | Add append-only decision/audit models and authorised APIs; derive actor from JWT |
| Admin timeline | Production page contains a hard-coded timeline and AI-log sentence | Demonstration data can be mistaken for real audit history | P1 | Keep mock data only behind mock mode and fetch paginated audit events in API mode |
| Audit trail | No general journey decision/event table backs the admin timeline | Changes can be overwritten without a durable actor/reason history | P1 | Add an append-only audit event model with stable ordering and idempotency key |
| Authorisation scope | Role middleware exists and doctor services scope queue/task access to room assignments | New decision endpoints could bypass assignment checks if implemented independently | P1 | Reuse the existing accessible-task/assignment checks and never accept actor IDs from clients |
| Backend tests | Six tests pass, but they focus on Prisma schema, migrations and seed contracts | Core HTTP flows, auth, AI failure and audit behaviour are unverified | P1 | Add unit/integration tests for the required 15 acceptance flows |
| Python tests | Symptom routing, queue engine and analytics tests exist; the current workspace Python runtime lacks the complete test environment | Python behaviour has not been revalidated for this revision | P1 | Create an isolated Python 3.12 environment from pinned requirements and run all suites |
| Frontend tests | Build and lint pass; no frontend unit/integration test suite is present | Production-mode/mock guard and decision persistence can regress | P2 | Add focused tests after P0/P1 backend contracts are stable |
| Forecast data source | Peak-hour inference reads a historical CSV and has no Neon scheduler | Forecast can become stale and is not an operational pipeline | P2 | After P1, add aggregated read-only Neon input, freshness metadata, baseline metrics and a cron workflow |
| Analytics service | Streamlit can read Neon or fallback to demo and has no access control | Public deployment could expose operational data | P2 | Do not deploy in P1; add authentication/restricted access and verify anonymisation first |
| Analytics artifacts | Generated report/notebook include a Neon hostname (not a credential) | Infrastructure metadata is unnecessarily published and output can become stale | P2 | Replace host with a source label and regenerate artifacts without connection metadata |
| Realtime | Frontend uses 10–30 second polling | Higher load and delayed updates, but acceptable for MVP | P2 | Retain polling through P1; assess SSE later with authenticated channels and polling fallback |
| Docker | No Dockerfiles are tracked | Native Render runtimes are usable, but local parity is limited | P3 | Keep native runtimes for MVP; add containers only if deployment evidence shows a need |
| Portfolio README | Root README only links the analytics directory | Capabilities, deployment state, limitations and safety language are unclear | P1 | Rewrite after verified implementation/test status is known |

## Current architecture and entrypoints

| Surface | Entrypoint/build | Current deployment state |
|---|---|---|
| Frontend | `frontend/src/main.tsx`; `npm ci && npm run build`; publish `frontend/dist` | Present in `render.yaml` |
| Backend | `backend/src/server.js`; `npm start` | Not present in `render.yaml` |
| Unified AI | `ai/main.py`; intended command `uvicorn main:app` | Not present in `render.yaml` |
| Analytics | `analytics/dashboard/app.py`; Streamlit | Not present in `render.yaml`; intentionally deferred |

No Dockerfile or Procfile is tracked for these services.

## Existing API and integration behaviour

- Frontend supports patient, kiosk, doctor and admin experiences and can switch between mock and API-backed clients.
- Backend exposes auth, patient, doctor, admin, routing, symptom-routing, AI-gateway and health routes under `/api/v1`.
- Backend calls AI through `AI_SERVICE_URL`, optionally forwards `X-API-Key`, applies a 20-second abort timeout and maps unavailable/timeout failures to 502/504.
- Prisma targets PostgreSQL and loads its datasource URL from `prisma.config.ts`.
- The wait-time service can persist to SQLite or PostgreSQL; its documented PostgreSQL URL requires a compatible driver.
- Analytics prefers PostgreSQL via `DATABASE_URL`, hashes patient tokens for extracts and falls back to seeded demo data.

## UI state not currently persisted

The doctor examination page currently keeps these values only in React state or does not send them in the existing mutation:

- examination notes;
- AI recommendation accepted/rejected state;
- AI override reason;
- rerouting-required checkbox and reason;
- final doctor-selected room/department attached to the AI decision.

The admin live-visit modal contains a fixed four-item timeline and fixed AI-log summary. These are not acceptable in production/API mode.

## Current health and test evidence

- Frontend build: passed on 2026-07-23.
- Frontend lint: passed on 2026-07-23.
- Backend lint: passed on 2026-07-23.
- Backend tests: 6 passed, 0 failed on 2026-07-23.
- Python tests: not rerun; the available bundled Python lacked `pytest` and the external interpreter was inaccessible in the sandbox.
- Existing backend health reports process status only and does not query Neon or AI.

## Phase gates

Phase 1 cannot be considered accepted until no `.env` file is tracked, repository scans find no hard-coded secrets, service examples exist, and the owner has at least rotated the potentially exposed Neon credential. Code-side remediation can be completed locally, but credential rotation and destructive Git-history rewriting require owner authority and coordination.

Phases 2–10 must not be described as complete until their respective tests and deployment smoke tests have actually run against authorised environments.
