# MedFlow rollback runbook

Rollback is service-specific. Never restore a revoked credential or run a destructive database reset.

## Before every release

- Record the deployed Git commit for frontend, backend and AI.
- Check `prisma migrate status` using a direct migration connection.
- For schema changes, create a Neon branch/backup before deployment.
- Run the secret scan, builds, tests and synthetic smoke flow.

## Frontend rollback

1. In Render, select `medflow-frontend`.
2. Redeploy the last known-good commit.
3. Verify `VITE_USE_MOCK_API=false` and the backend hostname.
4. Confirm SPA routes and one authenticated API request.

Do not switch production to mock mode as a rollback mechanism.

## Backend rollback

1. Stop automated deploys while diagnosing.
2. If no database migration ran, redeploy the last known-good backend commit.
3. If a backward-compatible migration ran, keep the schema and roll back application code only when the old code tolerates the added nullable/defaulted fields.
4. If old code is incompatible, deploy a forward-fix. Do not drop columns/tables or run `prisma migrate reset`.
5. Re-run backend readiness and the smoke flow.

## Database rollback

Prisma production migrations are forward-only in this repository. Preferred recovery order:

1. forward-fix SQL/schema;
2. application rollback while retaining compatible schema additions;
3. restore/switch to a pre-deploy Neon branch only after an explicit data-loss review.

Never run a restore over production without confirming the recovery point and writes that would be lost. Never log a connection string during recovery.

## AI rollback

1. Redeploy the last known-good AI commit/artifacts.
2. Keep the current generated service API key unless credential compromise caused the incident.
3. Verify model-load health and one backend-proxied AI request.
4. If AI is unavailable, backend should return its documented 502/504 behaviour; do not silently fabricate a production result.

## Credential rollback

If credential rotation fails before revocation, temporarily restore the prior deployment only inside the controlled rotation window. Once the old credential is revoked, issue another new credential; never restore the exposed value.

## Blueprint rollback

Revert `render.yaml` to a known-good commit and sync the Blueprint. `sync: false` values are not restored by a source revert; verify secrets manually in Render after the sync.
