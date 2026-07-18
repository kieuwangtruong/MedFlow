# Getting Started - Node.js Backend Template

Hướng dẫn khởi tạo và chạy dự án Backend dựa trên template này.

> **Note**: Thay thế `<project-name>`, `<port>`, `<database-name>` bằng giá trị cụ thể cho dự án của bạn.

## Yêu Cầu Hệ Thống

- **Node.js**: v18.0.0 trở lên
- **npm**: v9.0.0 trở lên
- **Database**: PostgreSQL / MySQL / MongoDB (tùy dự án)
- **Redis** (Tùy chọn): Cho caching/session management
- **Git**: Để version control

## Cài Đặt

### 1. Tạo Folder Dự Án

```bash
mkdir <project-name>
cd <project-name>
```

### 2. Khởi Tạo Node.js Project

```bash
npm init -y
```

Hoặc nếu muốn custom:

```bash
npm init
```

### 3. Tạo Cấu Trúc Thư Mục

```bash
mkdir -p src/{config,modules,routes,middlewares,utils,constants,errors,lib}
mkdir docs
```

Hoặc tạo bằng PowerShell (Windows):

```powershell
@('src', 'src/config', 'src/modules', 'src/routes', 'src/middlewares', 'src/utils', 'src/constants', 'src/errors', 'src/lib', 'docs') | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force }
```

### 4. Cài Đặt Dependencies

```bash
npm install express cors helmet dotenv zod
npm install @prisma/client
```

Hoặc cho development:

```bash
npm install --save-dev nodemon eslint prisma
```

Full command:

```bash
npm install express cors helmet dotenv zod @prisma/client
npm install --save-dev nodemon eslint prisma
```

### 5. Cấu Hình NPM Scripts

Sửa file `package.json`:

```json
{
  "name": "<project-name>",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@prisma/client": "^7.8.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "helmet": "^8.1.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "eslint": "^9.39.4",
    "nodemon": "^3.1.14",
    "prisma": "^7.8.0"
  }
}
```

### 6. Tạo File Entry Point

**src/server.js:**

```javascript
const app = require('./app');
const envConfig = require('./config/env');

function startServer() {
  app.listen(envConfig.port, () => {
    console.log(`Server is running on port ${envConfig.port}`);
  });
}

startServer();
```

**src/app.js:**

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
```

### 7. Cấu Hình Environment

**src/config/env.js:**

```javascript
require('dotenv').config();

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env.PORT);

const envConfig = {
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
  appOrigin: process.env.APP_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = envConfig;
```

Tạo file `.env` trong thư mục gốc của dự án (không commit file này):

```env
# ===== Server Configuration =====
PORT=<port>
NODE_ENV=development

# ===== CORS Configuration =====
APP_ORIGIN=http://localhost:<port>
# Hoặc cho production: https://yourdomain.com

# ===== Database Configuration =====
# PostgreSQL
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/<database-name>

# Hoặc MySQL
# DATABASE_URL=mysql://<username>:<password>@localhost:3306/<database-name>

# Hoặc MongoDB
# DATABASE_URL=mongodb://localhost:27017/<database-name>

# ===== Redis Configuration (Optional) =====
REDIS_URL=redis://localhost:6379

# ===== Authentication (If applicable) =====
# JWT_SECRET=your_secret_key_here
# API_KEY=your_api_key_here

# ===== Third-party Services (If applicable) =====
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
```

### 8. Cấu Hình Database (Prisma)

Khởi tạo Prisma:

```bash
npx prisma init
```

Sửa file `prisma/schema.prisma` theo database của bạn:

**PostgreSQL:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
```

**MySQL:**

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**MongoDB:**

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id    String  @id @default(auto()) @map("_id") @db.ObjectId
  email String  @unique
  name  String?
}
```

Run migration:

```bash
npx prisma migrate dev --name init
```

### 9. Tạo .gitignore

```
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Prisma
prisma/migrations/

# Build
dist/
build/
```

### 10. Tạo File .env.example

```env
PORT=3000
NODE_ENV=development
APP_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
```

## Chạy Dự Án

### Chế Độ Development

Sử dụng Nodemon để tự động reload khi có thay đổi:

```bash
npm run dev
```

Server sẽ khởi động tại: `http://localhost:<port>`

Log output:
```
Server is running on port <port>
```

### Chế Độ Production

```bash
npm start
```

## Kiểm Tra Cài Đặt

Sau khi khởi động server:

```bash
# 1. Health check endpoint (nếu có)
curl http://localhost:<port>/api/health

# 2. Kiểm tra CORS headers
curl -X OPTIONS http://localhost:<port>/api/status -H "Origin: http://localhost:<port>"

# 3. Kiểm tra một endpoint cơ bản
curl http://localhost:<port>/api/status
```

## Cấu Trúc Dự Án (Template)

```
<project-name>/
├── src/
│   ├── server.js           # Entry point
│   ├── app.js              # Express/Framework configuration
│   │
│   ├── config/             # Configuration files
│   │   ├── database.js
│   │   ├── env.js
│   │   └── redis.js
│   │
│   ├── modules/            # Feature modules (Domain-driven)
│   │   ├── users/
│   │   ├── auth/
│   │   ├── products/
│   │   └── orders/
│   │
│   ├── routes/             # API routes
│   │   └── index.js
│   │
│   ├── middlewares/        # Express middlewares
│   │   ├── auth.js
│   │   ├── error.js
│   │   └── validation.js
│   │
│   ├── utils/              # Helper functions
│   │   ├── response.js
│   │   ├── async-handler.js
│   │   └── validators.js
│   │
│   ├── constants/          # Static values
│   │   ├── error-codes.js
│   │   └── user-roles.js
│   │
│   ├── errors/             # Custom error classes
│   │   └── app-error.js
│   │
│   └── lib/                # Shared libraries
│
├── prisma/                 # (If using Prisma)
│   └── schema.prisma       # Database schema
│
├── docs/                   # Documentation
│   ├── GETTING_STARTED.md  # This file
│   ├── API.md              # API documentation
│   └── DATABASE.md         # Database setup
│
├── .env                    # Environment variables (local, not committed)
├── .env.example            # Template for env variables
├── .gitignore              # Git ignore rules
├── package.json
└── README.md
```

## NPM Scripts

| Command | Mô Tả |
|---------|-------|
| `npm run dev` | Chạy development mode (auto-reload với Nodemon) |
| `npm start` | Chạy production mode |
| `npm test` | Chạy test suite |
| `npm run lint` | Chạy linter (nếu có) |
| `npm run build` | Build dự án (nếu cần) |
| `npx prisma studio` | Mở Prisma Studio để quản lý database (Prisma) |
| `npx prisma migrate dev` | Chạy database migrations (Prisma) |
| `npm run seed` | Seed initial data vào database |

## Database Setup

### PostgreSQL

1. **Cài đặt PostgreSQL**: [Download](https://www.postgresql.org/download/)

2. **Tạo database mới**:
```bash
psql -U postgres
CREATE DATABASE <database-name>;
```

3. **Cấu hình `.env`**:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/<database-name>
```

### MySQL

1. **Cài đặt MySQL**: [Download](https://dev.mysql.com/downloads/mysql/)

2. **Tạo database mới**:
```bash
mysql -u root -p
CREATE DATABASE <database-name>;
```

3. **Cấu hình `.env`**:
```env
DATABASE_URL=mysql://root:password@localhost:3306/<database-name>
```

### MongoDB

1. **Cài đặt MongoDB**: [Download](https://www.mongodb.com/try/download/community)

2. **Cấu hình `.env`**:
```env
DATABASE_URL=mongodb://localhost:27017/<database-name>
```

## Redis Setup (Optional)

Nếu dự án cần Redis cho caching:

```bash
# Windows: Download từ https://github.com/microsoftarchive/redis/releases
# macOS: brew install redis
# Linux: sudo apt-get install redis-server

# Khởi chạy Redis
redis-server

# Kiểm tra connection
redis-cli ping  # Should return: PONG
```

## Troubleshooting

### 1. Lỗi Database Connection

**Vấn đề**: `Error connecting to database` hoặc `connect ECONNREFUSED`

**Giải pháp:**
```bash
# 1. Kiểm tra DATABASE_URL format
echo $env:DATABASE_URL  # Windows PowerShell
echo $DATABASE_URL      # Linux/Mac

# 2. Kiểm tra database server đang chạy
# PostgreSQL
psql -U postgres -d postgres -c "SELECT 1;"

# MySQL
mysql -u root -p -e "SELECT 1;"

# 3. Kiểm tra credentials (username/password)
# 4. Kiểm tra firewall rules
# 5. Kiểm tra port (default: PostgreSQL 5432, MySQL 3306)

# 6. Test Prisma connection
npx prisma db push
```

### 2. Port Đã Được Sử Dụng

**Vấn đề**: `listen EADDRINUSE: address already in use :::3000`

**Giải pháp:**

**Windows (PowerShell)**:
```powershell
# Xem process dùng port
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F

# Hoặc thay đổi PORT trong .env
```

**Linux/macOS**:
```bash
# Xem process dùng port
lsof -i :3000

# Kill process
kill -9 <PID>

# Hoặc thay đổi PORT trong .env
```

### 3. Dependencies Không Cài Được

**Vấn đề**: `npm install` lỗi

**Giải pháp:**
```bash
# 1. Xóa cache npm
npm cache clean --force

# 2. Xóa node_modules và lock file
rm -rf node_modules package-lock.json  # Linux/Mac
rmdir /s node_modules & del package-lock.json  # Windows

# 3. Cài lại
npm install

# 4. Nếu vẫn lỗi, kiểm tra Node.js version
node --version  # Should be v18+
npm --version   # Should be v9+
```

### 4. Prisma Migration Errors

**Vấn đề**: `Error: P1049` hoặc migration conflicts

**Giải pháp:**
```bash
# 1. Reset database (CẢNH BÁO: xóa toàn bộ data!)
npx prisma migrate reset

# 2. Hoặc xem status migrations
npx prisma migrate status

# 3. Sinh lại Prisma Client
npx prisma generate

# 4. View schema
npx prisma studio
```

### 5. Biến Environment Không Load

**Vấn đề**: `process.env.VARIABLE_NAME` is undefined

**Giải pháp:**
```bash
# 1. Kiểm tra file .env tồn tại ở thư mục gốc
ls -la .env  # Linux/Mac
dir .env     # Windows

# 2. Kiểm tra tên biến đúng chính xác (case-sensitive)
# 3. Kiểm tra dotenv được require ở đầu file
require('dotenv').config();

# 4. Restart server sau khi thay đổi .env
```

### 6. Redis Connection Issues

**Vấn đề**: `connect ECONNREFUSED 127.0.0.1:6379`

**Giải pháp:**
```bash
# 1. Kiểm tra Redis server đang chạy
redis-cli ping  # Should return: PONG

# 2. Kiểm tra Redis port (default 6379)
redis-cli info server

# 3. Kiểm tra REDIS_URL format
# Correct: redis://localhost:6379
# Correct: redis://:password@localhost:6379

# 4. Start Redis server
redis-server
```

## Tối Ưu Hóa

### Development Environment

```bash
# 1. Sử dụng .env.local cho local development
# Tạo .env.local để override .env

# 2. Enable source maps cho debugging
# Thêm vào package.json scripts:
"dev": "NODE_OPTIONS='--enable-source-maps' nodemon src/server.js"

# 3. Sử dụng VS Code debugger
# Tạo .vscode/launch.json
```

### Production Environment

```bash
# 1. Build nếu cần (TypeScript)
npm run build

# 2. Sử dụng process manager (PM2)
npm install -g pm2
pm2 start npm --name "<app-name>" -- start

# 3. Enable clustering
pm2 start npm --name "<app-name>" -i max -- start

# 4. Monitor logs
pm2 logs
```

## Best Practices

### 1. Environment Variables

```bash
# Tạo .env.example để document các biến cần thiết
# Commit .env.example nhưng không commit .env

# Kiểm tra: .env ở trong .gitignore
cat .gitignore | grep .env
```

### 2. Database Migrations

```bash
# Luôn backup trước khi migrate production
mysqldump -u root -p <database-name> > backup.sql

# Test migrations trên staging trước
# Sử dụng version control cho migrations
```

### 3. Security

```bash
# 1. Không commit secrets
# 2. Sử dụng HTTPS cho production
# 3. Validate tất cả inputs
# 4. Sử dụng helmet để set security headers
# 5. Implement rate limiting
```

### 4. Logging

```bash
# Thêm logging cho debugging
console.log('Connecting to database:', process.env.DATABASE_URL?.split('@')[1]);

# Sử dụng logging library (e.g., winston, pino)
```

## Các Bước Tiếp Theo

1. **Xem Documentation**: Tham khảo các file docs trong thư mục `docs/`
2. **Phát Triển Features**: 
   - Tạo modules mới trong `src/modules/`
   - Theo pattern MVC/MVT của template
3. **API Testing**: 
   - Sử dụng Postman, Insomnia, hoặc REST Client extension
   - Tạo Postman collection cho team
4. **Testing**:
   - Setup Jest hoặc Mocha cho unit tests
   - Setup e2e tests
5. **CI/CD**:
   - Setup GitHub Actions hoặc GitLab CI
   - Auto-run tests trên PR

## Docker Setup (Optional)

Nếu muốn containerize ứng dụng:

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE <port>

CMD ["npm", "start"]
```

```bash
# Build image
docker build -t <app-name>:latest .

# Run container
docker run -p <port>:<port> --env-file .env <app-name>:latest
```

## Docker Compose (Optional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "<port>:<port>"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/<database-name>
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: <database-name>
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

```bash
# Run with Docker Compose
docker-compose up -d
```

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề:
- [ ] Kiểm tra phần Troubleshooting trên
- [ ] Xem documentation trong thư mục `docs/`
- [ ] Tìm kiếm error message trên Google/Stack Overflow
- [ ] Liên hệ team development

---

**Last Updated**: May 2026

**Template Version**: 1.0
