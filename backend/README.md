# VAIC 2026 Backend

Base Node.js backend built with Express, Prisma, dotenv, helmet, cors, and zod.

## Requirements

- Node.js 18+
- npm 9+
- PostgreSQL, MySQL, or MongoDB depending on your Prisma datasource

## Setup

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run dev
```

Server starts at `http://localhost:3000` by default.

## Scripts

- `npm run dev`: start development server with nodemon
- `npm start`: start production server
- `npm run lint`: lint source files
- `npm run prisma:generate`: generate Prisma client
- `npm run prisma:migrate`: run Prisma migration
- `npm run prisma:studio`: open Prisma Studio

## Health Check

```bash
curl http://localhost:3000/api/health
```
