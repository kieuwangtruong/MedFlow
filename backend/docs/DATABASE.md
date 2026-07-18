# Database Setup

This backend uses Prisma. The default datasource is PostgreSQL.

The Prisma CLI reads the connection URL from `prisma.config.ts`. At runtime,
Prisma 7 connects through `@prisma/adapter-pg`.

## Configure

Copy `.env.example` to `.env` and update:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vaic_2026
```

## Generate Client

```bash
npm run prisma:generate
```

## Run Migration

```bash
npm run prisma:migrate -- --name init
```

Committed migrations live in `prisma/migrations`. Run `npm test` to validate
the Prisma schema and verify that generated migration SQL contains all VAIC
module tables and key constraints.

## Seed Repository Datasets

After deploying migrations, seed the bundled department, patient journey, queue,
and check-in slot datasets. The seed uses upserts and is safe to run repeatedly:

```bash
npm run prisma:deploy
npm run prisma:seed
```
