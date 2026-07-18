## Coding Convention Rule

Use this file as the default coding pattern for generated code in this repository.

## 1. Naming

### 1.1 Variables

- Use `camelCase`.
- Boolean names: `is`, `has`, `can`, `should`.
- Avoid one-letter or vague names such as `t`, `data`, `item`, `value`, `temp`.

Example:

```js
let totalScore;
let isActive;
let hasPermission;
```

### 1.2 Functions

- Use `camelCase`.
- Start with a verb.
- Avoid vague names such as `processData` or `handleStuff`.

Example:

```js
async function getUserById(userId) {}
```

### 1.3 Classes and Layer Names

- `XxxController`
- `XxxService`
- `XxxRepository`
- `XxxModel`
- `XxxRoute`

### 1.4 Files

- Backend files follow `PascalCase` with layer suffix.
- File name should match the main responsibility.
- Constant files follow the module name.
- Each module should use one constant file only.

Example:

```js
UserController.js
booking.constant.js
```

### 1.5 Constants

- Each module must have a single constant file.
- The constant file name must match the module name.
- Do not split constants of the same module across multiple files unless there is a documented exception.
- Keep only that module's constants in its constant file.

Examples:

```js
booking.constant.js
payment.constant.js
notification.constant.js
```

## 2. Function Design

- One function, one responsibility.
- Prefer functions under 50 lines.
- If a function reaches 100 to 150 lines, split it.
- Prefer at most 3 nesting levels.
- Use early return to avoid deep nesting.
- Prefer pure functions for calculation or transformation logic.
- `app.js` must not contain business logic, inline middleware logic, validation logic, or response-building logic.
- `app.js` should only create the app and call setup functions such as `registerMiddlewares`, `registerRoutes`, and `registerErrorHandlers`.
- `server.js` should only start the server by calling a named bootstrap function such as `startServer`.

Example:

```js
function calculateScore(firstScore, secondScore) {
  return firstScore + secondScore;
}
```

## 3. Backend Module Pattern

### 3.1 Read Existing Wiring First

Before adding or changing a backend module, inspect the current app wiring and follow it instead of inventing a new structure.

Minimum files to check first:

- `src/app.js`
- `src/routes/index.js`
- one existing route file such as `src/routes/AuthRoute.js`
- `src/middlewares/ValidateMiddleware.js`
- `src/middlewares/ErrorMiddleware.js`
- one existing module with the same layers you are about to touch

If the repo already has a pattern for route registration, validation, async wrapping, response formatting, or error mapping, reuse that pattern.

### 3.2 Route Registration Pattern

- `src/app.js` should only compose setup functions such as `registerMiddlewares`, `registerRoutes`, and `registerErrorHandlers`.
- `src/routes/index.js` is the central route registry for the app.
- New feature modules must expose a named register function such as `registerUserRoute`.
- Register new module routes from `src/routes/index.js` unless the repo already uses a different central entry for that route group.

Example:

```js
function createApiRouter() {
  const router = express.Router();

  registerHealthRoute(router);
  registerAuthRoute(router);
  registerUserRoute(router);

  return router;
}
```

### 3.3 Route File Pattern

- A route file should create and return an Express router.
- Apply `validateRequest(schema)` at the route layer.
- Wrap async middleware and controllers with `asyncHandler(...)`.
- Apply auth middleware in the route layer, not inside controllers or services.
- Keep route files focused on endpoint wiring only.

Preferred route order per endpoint:

1. `validateRequest(...)`
2. `asyncHandler(requireAuthenticatedUser)` when needed
3. `asyncHandler(controllerMethod)`

Example:

```js
router.put(
  '/me',
  validateRequest(updateOwnProfileSchema),
  asyncHandler(requireAuthenticatedUser),
  asyncHandler(userController.updateOwnProfile)
);
```

### 3.4 Layer Responsibilities

- `Route`: endpoint path, middleware order, schema hookup
- `Controller`: read request data, call service, send standardized success response
- `Service`: business rules, orchestration, ownership checks, conflict checks, error mapping
- `Repository`: Prisma queries only, with narrow data-access methods
- `Model`: shared select objects or model-shaping helpers used by the repository
- `Mapper`: transform database/service output into API payloads
- `Validation`: define Zod request schemas
- `Constant`: user-facing module messages and module-specific constants

Do not move business logic into routes or controllers just because it seems small. If the logic is about behavior or rules, it belongs in the service.

### 3.5 Controller Style

- Controllers should stay thin.
- Controllers should not contain Prisma queries.
- Controllers should not contain ownership checks, uniqueness checks, or validation parsing.
- Controllers should usually call one service method and then `sendSuccessResponse(...)`.

Example:

```js
async function getOwnProfile(request, response) {
  const profile = await userService.getOwnProfile(request.auth.user.id);

  return sendSuccessResponse(response, {
    statusCode: 200,
    data: profile
  });
}
```

### 3.6 Service Style

- Services own business decisions and application rules.
- Services may call multiple repository methods to enforce behavior.
- Services should throw `AppError` subclasses or structured `AppError` instances when behavior needs a specific HTTP result.
- Services should not write Express responses directly.

Examples of service concerns:

- duplicate checks
- ownership checks
- not-found mapping
- conflict mapping
- cross-repository orchestration

### 3.7 Repository Style

- Repositories should be the only layer that talks to Prisma for module-specific queries.
- Keep repository methods narrow and explicit, such as `findUserById`, `findUserByDisplayName`, `updateUserProfile`.
- Prefer shared `select` objects from the module model file so payload shape stays consistent.
- Do not mix HTTP or Express concerns into repository code.

### 3.8 Validation Pattern

- Request validation must use Zod schemas in the module validation file.
- Route files should import those schemas and pass them to `validateRequest(...)`.
- Validate `body`, `query`, and `params` with the same wrapper shape used by the current middleware.
- Do not manually parse request input inside controllers when a schema can express the rule.

### 3.9 Response and Error Pattern

- Success responses must use the shared response helper already used by the app, currently `sendSuccessResponse(...)`.
- Let `ErrorMiddleware` shape error responses.
- Validation errors should flow from Zod into the shared error middleware.
- Use `UnauthorizedError`, `NotFoundError`, or `AppError` when the caller needs a specific status code.
- Do not build ad hoc error JSON payloads inside controllers or services.

### 3.10 Source Of Truth Rule

When the agent is unsure about module structure, route registration, validation flow, or error handling, do not guess.

Read the existing files that already implement those concerns and copy the established style:

- route registration from `src/routes/index.js`
- route middleware order from an existing `*Route.js`
- request validation from `src/middlewares/ValidateMiddleware.js`
- error wrapping from `src/middlewares/ErrorMiddleware.js`
- success response formatting from `src/utils/ApiResponse.js`

The default rule for this repository is: follow the existing backend pattern first, then extend it consistently.

## 4. Error Handling

- Do not swallow errors.
- Re-throw or map errors explicitly.
- Use custom errors when the caller needs structured handling.

Example:

```js
try {
  await save();
} catch (error) {
  throw error;
}
```

## 5. API Shape

- Prefer consistent response wrappers when the module already uses them.
- For `GET` routes that return a list of records such as users, orders, products, or similar collections, always design the endpoint as paginated when the result set could grow large.
- Do not return the full table by default for list endpoints that may become long over time.
- List endpoints should validate pagination query params at the route layer and return pagination metadata in the response.
- Paginated responses should include `pagination.page`, `pagination.limit`, and `pagination.total`.

Example:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

## 6. Database Pattern

- Database naming: `snake_case`.
- Code naming: `camelCase`.
- Standard database fields when needed: `id`, `created_at`, `updated_at`, `deleted_at`.
- Standard code fields when needed: `id`, `createdAt`, `updatedAt`, `deletedAt`.

## 7. Environment Variables

### 7.1 What Information Must Be Saved in Environment Variables

Store in `.env` only when:
- **Secrets & Credentials**: Database URLs, API keys, authentication tokens, passwords
- **Environment-Specific Settings**: Port, base URLs, API endpoints that vary between dev/staging/production
- **External Service Integrations**: Third-party service configurations, webhook URLs
- **Feature Flags**: Runtime toggles for features, debug modes

### 7.2 Workflow for Adding New Environment Variables

**When an agent needs to add new environment variables:**

1. Add the variable to `.env.example` with a placeholder value (e.g., `VARIABLE_NAME=`) and a comment explaining what it is
2. Update `src/config/EnvConfig.js` to read and normalize the variable
3. Update this convention document with the new variable details
4. **Developers manually add values** to their local `.env` file based on `.env.example`

**Example:**
```js
// .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
```

Current mail-related variables in this project:

- `CLIENT_FRONTEND_BASE_URL`: frontend base URL used by backend when it builds auth redirect URLs
- `BETTER_AUTH_URL`: backend origin used by Better Auth, without an `/auth` suffix
- `GOOGLE_CLIENT_ID`: Google OAuth client ID used for Better Auth Google sign-in
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret used for Better Auth Google sign-in
- `MAIL_FROM_NAME`: display name shown in auth emails
- `MAIL_REPLY_TO`: optional reply-to address for auth emails
- `MAIL_GMAIL_USER`: Gmail account used as the primary provider
- `MAIL_GMAIL_APP_PASSWORD`: Gmail app password for Nodemailer SMTP auth
- `MAIL_GMAIL_FROM`: sender address used for Gmail delivery
- `RESEND_API_KEY`: API key for Resend fallback delivery
- `MAIL_RESEND_FROM`: sender address used for Resend delivery
- `SEPAY_WEBHOOK_SECRET`: secret key used to verify SePay webhook HMAC-SHA256 signatures
- `SEPAY_WEBHOOK_TOLERANCE_SECONDS`: allowed timestamp drift in seconds for SePay webhook replay protection

### 7.3 Reading Environment Variables

- All environment variables must be read and normalized in `src/config/EnvConfig.js`
- Do not access `process.env` directly outside `EnvConfig`
- Other files must import configuration values from `EnvConfig`
- `EnvConfig` should provide safe defaults when appropriate and keep parsing logic in one place
- Apply type casting and validation in `EnvConfig`

Example:

```js
require('dotenv').config();

const envConfig = {
  port: Number(process.env.PORT) || 3000,
  appOrigin: process.env.APP_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
};

module.exports = envConfig;
```

```js
const envConfig = require('../config/EnvConfig');

app.listen(envConfig.port);
```

### 7.4 .env.example Management

- `.env.example` is the source of truth for required and optional environment variables
- All new environment variables must be added to `.env.example` first
- Include descriptive comments for each variable
- Never commit actual `.env` file with real secrets
- Use `.gitignore` to exclude `.env` from version control

## 8. Anti-Patterns

- God function
- Duplicate logic
- Hardcoded business rules
- Magic numbers without naming or context
- Broad names that hide intent
- Direct `process.env` access outside `EnvConfig`
- Inline setup logic inside `app.js` or `server.js`
- Prisma queries inside controllers
- Business logic inside route files
- Manual validation inside controllers when Zod schema is the established pattern
- Ad hoc response JSON in controllers when `sendSuccessResponse(...)` or shared error middleware already exists
- Creating a new backend pattern without first checking the existing module and wiring files
