# Render environment variables

Never put secret values in this file or `render.yaml`.

## medflow-frontend

| Variable | Source | Required | Notes |
|---|---|---:|---|
| `VITE_USE_MOCK_API` | Blueprint value `false` | Yes | Production build fails for any other value |
| `VITE_API_BASE_URL` | Backend `RENDER_EXTERNAL_HOSTNAME` | Yes | Hostname or full URL accepted; `/api/v1` is appended when absent |
| `VITE_API_TIMEOUT_MS` | Blueprint value `120000` | Yes | Covers the combined backend and AI cold-start window on the free plan |

## medflow-backend

| Variable | Source | Required | Notes |
|---|---|---:|---|
| `NODE_ENV` | Blueprint value `production` | Yes | Activates strict startup validation |
| `DATABASE_URL` | Render secret prompt | Yes | Use rotated Neon direct TLS URL for the current single-URL migration/runtime setup |
| `JWT_SECRET` | Render `generateValue` | Yes | Never copy to frontend or logs |
| `JWT_EXPIRES_IN_SECONDS` | Blueprint value | Yes | Default Blueprint value is 43200 |
| `APP_ORIGIN` | Frontend `RENDER_EXTERNAL_HOSTNAME` | Yes | Comma-separated explicit origins are also accepted outside Blueprint wiring |
| `AI_SERVICE_URL` | AI `RENDER_EXTERNAL_HOSTNAME` | Yes | Hostname or full URL accepted |
| `AI_SERVICE_API_KEY` | AI-generated `SERVICE_API_KEY` | Yes | Forwarded as `X-API-Key`; value is never logged |
| `AI_REQUEST_TIMEOUT_MS` | Blueprint value `90000` | Yes | Must be longer than the observed AI cold-start window |
| `REDIS_URL` | Render secret/manual | No | Currently reserved; no Redis client is active |

Seed-only variables are not deployment variables: `SEED_ADMIN_PASSWORD`, `SEED_DOCTOR_PASSWORD`, and `SEED_NURSE_PASSWORD` are required only when an operator deliberately runs the staff seed command.

## medflow-ai

| Variable | Source | Required | Notes |
|---|---|---:|---|
| `APP_NAME`, `APP_VERSION`, `APP_ENV`, `DEBUG`, `API_PREFIX`, `HOST` | Blueprint values | Yes | Non-secret runtime metadata |
| `PORT` | Render | Yes | Render supplies it automatically |
| `CORS_ORIGINS` | Frontend `RENDER_EXTERNAL_HOSTNAME` | Yes | Explicit comma-separated allowlist; no wildcard |
| `FORECAST_MODEL_PATH` | Blueprint value | Yes | Relative to `ai/peak_hour_prediction` |
| `FORECAST_MODEL_METADATA_PATH` | Blueprint value | Yes | Relative to `ai/peak_hour_prediction` |
| `FORECAST_CHECKIN_DATA_PATH` | Blueprint value | Yes | Current MVP uses historical CSV input |
| `FORECAST_MAX_DAYS` | Blueprint value | Yes | Current value: 7 |
| `ROUTING_MODEL_PATH` | Blueprint value | Yes | Relative to `ai/process_input_data` |
| `ROUTING_METADATA_PATH` | Blueprint value | Yes | Relative to `ai/process_input_data` |
| `ROUTING_DEPARTMENTS_PATH` | Blueprint value | Yes | Relative to `ai/process_input_data` |
| `DATABASE_URL` | Backend secret reference | Yes for persistent queue | Same rotated Neon credential in MVP |
| `AUTH_ENABLED` | Blueprint value `true` | Yes | Protects scoped wait-time endpoints |
| `SERVICE_API_KEY` | Render `generateValue` | Yes | Referenced by backend; do not expose |
| `SERVICE_ACTOR_ID` | Blueprint value | Yes | Audit-safe service identity only |
| `SERVICE_API_KEYS` | Manual JSON secret | No | Backward-compatible multi-key alternative |

## medflow-analytics

Not deployed in the P1 Blueprint.

| Variable | Source | Required | Notes |
|---|---|---:|---|
| `DATABASE_URL` | Local/secured service secret | No | Use a read-only role; unset means demo fallback |
