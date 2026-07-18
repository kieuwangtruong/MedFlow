# Database Setup

This backend uses Prisma. The default datasource is PostgreSQL.

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
