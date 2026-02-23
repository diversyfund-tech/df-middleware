# Development Setup and Workflows

## Executive Summary

DF-Middleware uses Bun as the runtime, TypeScript for type safety, and Drizzle ORM for database access. Development requires PostgreSQL database, environment variables configuration, and running multiple services (Express server, Next.js API routes, MCP server, job worker).

**Quick Start:**
1. Install Bun
2. Install dependencies: `bun install`
3. Set up environment variables
4. Set up database: `bun run drizzle-kit push`
5. Start services: `bun run dev`, `bun run dev:next`, `bun run mcp`

## Engineering Details

### Prerequisites

#### Required Software

- **Bun**: JavaScript runtime (v1.0+)
  - Install: `curl -fsSL https://bun.sh/install | bash`
  - Verify: `bun --version`

- **PostgreSQL**: Database (v12+)
  - Install: https://www.postgresql.org/download/
  - Verify: `psql --version`

- **Node.js**: For some tooling (v18+)
  - Install: https://nodejs.org/
  - Verify: `node --version`

#### Optional Software

- **Drizzle Studio**: Database GUI
  - Run: `bun run db:studio`
  - Access: http://localhost:4983

- **VS Code**: Recommended IDE
  - Extensions: TypeScript, ESLint, Prettier

### Initial Setup

#### 1. Clone Repository

```bash
git clone <repository-url>
cd df-middleware
```

#### 2. Install Dependencies

```bash
bun install
```

**Package Manager**: Bun (uses `bun.lock`)

**File**: `package.json:1-43`

#### 3. Environment Variables

**Create `.env` file** (copy from `.env.example` if exists):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/df_middleware

# GHL
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id

# Aloware
ALOWARE_API_TOKEN=your_aloware_token
ALOWARE_WEBHOOK_BASIC_USER=webhook_user
ALOWARE_WEBHOOK_BASIC_PASS=webhook_pass

# Verity
VERITY_BASE_URL=http://localhost:3000
CLERK_SECRET_KEY=your_clerk_secret_key

# Middleware
DF_MIDDLEWARE_API_KEY=your_api_key
DF_ADMIN_SECRET=your_admin_secret
X_DF_JOBS_SECRET=your_jobs_secret

# Optional
GHL_WEBHOOK_SECRET=your_webhook_secret
VERITY_WEBHOOK_SECRET=your_webhook_secret
```

**Environment Validation**: `env.mjs` validates all required variables

**File**: `env.mjs:1-137`

#### 4. Database Setup

**Create Database**:
```bash
createdb df_middleware
```

**Run Migrations**:
```bash
bun run drizzle-kit push
```

**Or Generate Migrations**:
```bash
bun run drizzle-kit generate
```

**Drizzle Config**: `drizzle.config.ts`

**File**: `drizzle.config.ts`

#### 5. Start Services

**Express Server** (port 3001):
```bash
bun run dev
```

**Next.js API Routes** (port 3002):
```bash
bun run dev:next
```

**MCP Server** (stdio):
```bash
bun run mcp
```

**Job Worker** (processes jobs):
```bash
bun run src/scripts/worker.ts
```

### Development Workflow

#### Making Changes

1. **Create Feature Branch**:
```bash
git checkout -b feature/your-feature
```

2. **Make Changes**:
   - Edit files in `src/`
   - Follow TypeScript types
   - Use Drizzle ORM for database access

3. **Test Changes**:
   - Test API endpoints locally
   - Test webhook handlers
   - Test sync functions

4. **Run Linter**:
```bash
bun run lint
```

5. **Commit Changes**:
```bash
git add .
git commit -m "feat: your feature description"
```

6. **Push and Create PR**:
```bash
git push origin feature/your-feature
```

#### Database Changes

**Schema Changes**:
1. Edit `src/server/db/schema.ts`
2. Generate migration: `bun run drizzle-kit generate`
3. Review migration file in `drizzle/` directory
4. Apply migration: `bun run drizzle-kit push`

**Migration Files**: `drizzle/*.sql`, `drizzle/meta/*.json`

**File**: `src/server/db/schema.ts`

#### Adding New API Endpoints

**Express Routes** (`src/api-gateway/router.ts`):
```typescript
router.post("/your-endpoint", async (req, res) => {
  // Your handler
});
```

**Next.js API Routes** (`src/app/api/your-endpoint/route.ts`):
```typescript
export async function POST(req: Request) {
  // Your handler
}
```

#### Adding New Sync Functions

**Location**: `src/lib/sync/`

**Pattern**:
```typescript
export async function syncYourEntity(
  sourceData: YourType,
  mapping?: YourMapping
): Promise<SyncResult> {
  // Sync logic
  // Update sync_log
  return { success: true };
}
```

**File**: See `src/lib/sync/contact-sync.ts` for example

#### Adding New Webhook Handlers

**Location**: `src/app/api/webhooks/your-source/route.ts`

**Pattern**:
```typescript
export async function POST(req: Request) {
  // Validate webhook
  // Create dedupe key
  // Insert webhook event
  // Enqueue job
}
```

**File**: See `src/app/api/webhooks/ghl/route.ts` for example

### Testing

#### Manual Testing

**API Gateway**:
```bash
curl -X POST http://localhost:3001/api/verity \
  -H "Authorization: Bearer $DF_MIDDLEWARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/api/comms/broadcasts",
    "method": "GET"
  }'
```

**Health Check**:
```bash
curl http://localhost:3001/health
```

**Webhook Handler**:
```bash
curl -X POST http://localhost:3002/api/webhooks/ghl \
  -H "Content-Type: application/json" \
  -d '{"event": "contact.updated", "data": {...}}'
```

#### Database Testing

**Drizzle Studio**:
```bash
bun run db:studio
```

**Access**: http://localhost:4983

**Query Database**:
```bash
psql $DATABASE_URL -c "SELECT * FROM webhook_events LIMIT 10;"
```

#### Job Queue Testing

**Enqueue Test Job**:
```bash
curl -X POST http://localhost:3002/api/jobs/enqueue-pending \
  -H "Authorization: Bearer $DF_ADMIN_SECRET"
```

**Process Pending Jobs**:
```bash
curl -X POST http://localhost:3002/api/jobs/process-pending \
  -H "Authorization: Bearer $DF_ADMIN_SECRET"
```

### Debugging

#### Logging

**Console Logs**: All services log to console

**Express Server**: `src/index.ts:34-36`

**MCP Server**: `src/mcp/server.ts:43,51,60,102`

**API Gateway**: `src/api-gateway/router.ts:41,102,146`

#### Database Debugging

**Check Webhook Events**:
```sql
SELECT * FROM webhook_events 
WHERE status = 'pending' 
ORDER BY received_at DESC 
LIMIT 10;
```

**Check Sync Log**:
```sql
SELECT * FROM sync_log 
WHERE status = 'error' 
ORDER BY started_at DESC 
LIMIT 10;
```

**Check Contact Mappings**:
```sql
SELECT * FROM contact_mappings 
WHERE phone_number = '+1234567890';
```

#### External API Debugging

**GHL API**:
- Check logs: `src/lib/ghl/client.ts:50,82-98`
- Test endpoint: `src/app/api/test/get-ghl-providers/route.ts`

**Aloware API**:
- Check logs: `src/lib/aloware/client.ts:47-49`
- Test endpoint: `src/app/api/test/test-provider-connection/route.ts`

**Verity API**:
- Check proxy logs: `src/api-gateway/proxy.ts:102`
- Test endpoint: `src/app/api/test/verify-verity-db/route.ts`

### Common Issues

#### Database Connection Errors

**Symptom**: `Error: connect ECONNREFUSED`

**Solution**:
1. Check PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` is correct
3. Check database exists: `psql -l | grep df_middleware`

#### Environment Variable Errors

**Symptom**: `Error: Missing required environment variable`

**Solution**:
1. Check `.env` file exists
2. Check `env.mjs` validation errors
3. Verify all required variables are set

#### MCP Server Errors

**Symptom**: `Error: Failed to get Clerk authentication token`

**Solution**:
1. Check `CLERK_SECRET_KEY` is set
2. Verify at least one Clerk user has active session
3. Check Clerk API connectivity

#### Job Queue Not Processing

**Symptom**: Jobs stuck in 'pending' status

**Solution**:
1. Check job worker is running: `bun run src/scripts/worker.ts`
2. Check pg-boss is started: `src/lib/jobs/boss.ts`
3. Manually trigger: `POST /api/jobs/process-pending`

#### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use`

**Solution**:
1. Find process: `lsof -i :3001` (or 3002)
2. Kill process: `kill -9 <PID>`
3. Or change port: `PORT=3003 bun run dev`

### Code Style

#### TypeScript

**Config**: `tsconfig.json`

**Rules**:
- Strict mode enabled
- ES modules (`"module": "ESNext"`)
- Target: ES2022

**File**: `tsconfig.json`

#### ESLint

**Config**: `eslint.config.mjs`

**Run**:
```bash
bun run lint
```

**File**: `eslint.config.mjs`

#### Prettier

**Config**: Not configured (consider adding)

**Recommendation**: Add Prettier for code formatting

### Git Workflow

#### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Refactoring

#### Commit Messages

**Format**: `<type>: <description>`

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Refactoring
- `test` - Tests
- `chore` - Maintenance

**Example**: `feat: add contact sync function`

### Development Tools

#### Drizzle Studio

**Start**: `bun run db:studio`

**Access**: http://localhost:4983

**Features**:
- Browse tables
- Query data
- Edit records

#### VS Code Extensions

**Recommended**:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Drizzle ORM (if available)

### Environment-Specific Configuration

#### Development

**Database**: Local PostgreSQL

**External APIs**: Development/staging endpoints

**Logging**: Console logging

#### Staging

**Database**: Staging PostgreSQL

**External APIs**: Staging endpoints

**Logging**: Structured logging (recommended)

#### Production

**Database**: Production PostgreSQL

**External APIs**: Production endpoints

**Logging**: Structured logging + aggregation

**Deployment**: Vercel (Next.js) + Standalone (Express)

### Known Development Issues

1. **No Test Suite**: No automated tests
2. **No Type Tests**: No type checking tests
3. **No Integration Tests**: No integration test suite
4. **Limited Error Handling**: Some errors not caught
5. **No Mocking**: No mock external APIs for testing

### Recommendations

1. **Add Test Suite**: Jest or Bun test
2. **Add Integration Tests**: Test sync functions
3. **Add Mocking**: Mock external APIs
4. **Add Prettier**: Code formatting
5. **Add Pre-commit Hooks**: Lint and format on commit
6. **Add CI/CD**: Automated testing and deployment
