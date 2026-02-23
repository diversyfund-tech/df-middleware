# Deployment

## Executive Summary

DF-Middleware uses a hybrid deployment model: Next.js API routes deploy to Vercel as serverless functions, while the Express server and MCP server run as standalone processes. Database migrations run via Drizzle Kit, and environment variables are managed through Vercel dashboard.

**Deployment Architecture:**
- **Next.js API Routes**: Vercel serverless functions
- **Express Server**: Standalone process (Vercel or separate hosting)
- **MCP Server**: Standalone process (local or separate hosting)
- **Job Worker**: Standalone process (local or separate hosting)
- **Database**: PostgreSQL (Neon, Supabase, or self-hosted)

## Engineering Details

### Vercel Deployment (Next.js API Routes)

#### Configuration

**File**: `vercel.json`

**Cron Jobs**:
```json
{
  "crons": [
    {
      "path": "/api/jobs/process-pending",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**File**: `vercel.json:1-8`

#### Deployment Steps

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Link Project**:
```bash
vercel link
```

4. **Deploy**:
```bash
vercel --prod
```

**Or use GitHub integration**: Push to main branch triggers deployment

#### Environment Variables

**Set in Vercel Dashboard**:
1. Go to project settings
2. Navigate to "Environment Variables"
3. Add all required variables (see `env.mjs`)

**Required Variables**:
- `DATABASE_URL`
- `GHL_API_KEY`
- `GHL_LOCATION_ID`
- `ALOWARE_API_TOKEN`
- `CLERK_SECRET_KEY`
- `DF_MIDDLEWARE_API_KEY`
- `DF_ADMIN_SECRET`
- `X_DF_JOBS_SECRET`
- And others (see `11-appendix-glossary.md`)

**File**: `env.mjs:1-137`

#### Build Configuration

**Next.js Config**: `next.config.js` (if exists)

**Build Command**: `bun run build` (if needed)

**Output Directory**: `.next` (default)

### Express Server Deployment

#### Standalone Process

**Run Command**:
```bash
bun run src/index.ts
```

**Port**: 3001 (configurable via `PORT`)

**Process Manager**: Use PM2 or similar

**PM2 Example**:
```bash
pm2 start "bun run src/index.ts" --name df-middleware-api
pm2 save
pm2 startup
```

#### Vercel Serverless Function (Alternative)

**File**: `src/app/api/express/route.ts` (create if needed)

**Note**: Express server may need adaptation for serverless

**Recommendation**: Keep as standalone process for better control

### MCP Server Deployment

#### Standalone Process

**Run Command**:
```bash
bun run src/mcp/server.ts
```

**Protocol**: stdio (for MCP client communication)

**Process Manager**: Use PM2 or similar

**PM2 Example**:
```bash
pm2 start "bun run src/mcp/server.ts" --name df-middleware-mcp
pm2 save
```

#### Docker (Optional)

**Dockerfile Example**:
```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

CMD ["bun", "run", "src/mcp/server.ts"]
```

### Job Worker Deployment

#### Standalone Process

**Run Command**:
```bash
bun run src/scripts/worker.ts
```

**Process Manager**: Use PM2 or similar

**PM2 Example**:
```bash
pm2 start "bun run src/scripts/worker.ts" --name df-middleware-worker
pm2 save
```

#### Multiple Workers

**Scale**: Run multiple worker processes for parallel processing

**PM2 Cluster Mode**:
```bash
pm2 start src/scripts/worker.ts -i 4 --name df-middleware-worker
```

### Database Deployment

#### Migrations

**Generate Migrations**:
```bash
bun run drizzle-kit generate
```

**Apply Migrations**:
```bash
bun run drizzle-kit push
```

**Or Use Migrations**:
```bash
bun run drizzle-kit migrate
```

**Drizzle Config**: `drizzle.config.ts`

**File**: `drizzle.config.ts`

#### Database Providers

**Neon**:
- Serverless PostgreSQL
- Connection: `DATABASE_URL` from Neon dashboard
- Migrations: Run via Drizzle Kit

**Supabase**:
- Managed PostgreSQL
- Connection: `DATABASE_URL` from Supabase dashboard
- Migrations: Run via Drizzle Kit

**Self-Hosted**:
- PostgreSQL on VPS/cloud
- Connection: `postgresql://user:pass@host:5432/db`
- Migrations: Run via Drizzle Kit

### Environment Configuration

#### Development

**Database**: Local PostgreSQL

**External APIs**: Development/staging endpoints

**Logging**: Console logging

#### Staging

**Database**: Staging PostgreSQL

**External APIs**: Staging endpoints

**Logging**: Structured logging (recommended)

**Deployment**: Vercel preview deployments

#### Production

**Database**: Production PostgreSQL

**External APIs**: Production endpoints

**Logging**: Structured logging + aggregation

**Deployment**: Vercel production + Standalone processes

### CI/CD Pipeline

#### GitHub Actions (Recommended)

**Workflow File**: `.github/workflows/deploy.yml`

**Example**:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

#### Manual Deployment

**Steps**:
1. Push to main branch
2. Vercel auto-deploys (if configured)
3. Deploy Express server manually
4. Deploy MCP server manually
5. Deploy job worker manually

### Health Checks

#### Vercel Health Check

**Endpoint**: `GET /api/health`

**Expected**: `{"status": "ok", ...}`

**Monitoring**: Vercel dashboard or external monitoring

#### Express Server Health Check

**Endpoint**: `GET /health`

**Expected**: `{"status": "ok", ...}`

**Monitoring**: External monitoring service

**File**: `src/index.ts:21-27`

### Rollback Procedures

#### Vercel Rollback

**Via Dashboard**:
1. Go to project deployments
2. Find previous deployment
3. Click "Promote to Production"

**Via CLI**:
```bash
vercel rollback
```

#### Express Server Rollback

**Steps**:
1. Stop current process
2. Checkout previous version
3. Restart process

**PM2**:
```bash
pm2 restart df-middleware-api
```

### Monitoring Deployment

#### Vercel Monitoring

**Dashboard**: https://vercel.com/dashboard

**Metrics**:
- Request count
- Error rate
- Response time
- Function invocations

#### External Monitoring

**Tools**: 
- Uptime Robot
- Pingdom
- Datadog
- New Relic

**Endpoints**:
- `GET /health` (Express)
- `GET /api/health` (Vercel)

### Scaling Considerations

#### Vercel Serverless Functions

**Auto-scaling**: Vercel handles scaling automatically

**Limits**:
- Function timeout: 10s (Hobby), 60s (Pro)
- Memory: 1024 MB (Hobby), 3008 MB (Pro)

#### Express Server

**Scaling**: Horizontal scaling with load balancer

**Recommendation**: Use multiple instances behind load balancer

#### Job Workers

**Scaling**: Run multiple worker processes

**PM2 Cluster**:
```bash
pm2 start src/scripts/worker.ts -i 4
```

#### Database

**Scaling**: 
- Read replicas for queries
- Connection pooling (PgBouncer)
- Vertical scaling for writes

### Security Considerations

#### Environment Variables

**Storage**: Vercel dashboard (encrypted)

**Access**: Team members with appropriate permissions

**Rotation**: Rotate secrets regularly

#### API Keys

**Storage**: Environment variables

**Rotation**: Rotate API keys regularly

**Monitoring**: Monitor API key usage

#### Database

**Connection**: Use SSL/TLS

**Credentials**: Store in environment variables

**Access**: Limit database access to necessary IPs

### Disaster Recovery

#### Database Backups

**Frequency**: Daily (recommended)

**Retention**: 30 days (recommended)

**Restore**: Use backup to restore database

#### Code Backups

**Method**: Git repository

**Backup**: GitHub/GitLab

**Restore**: Checkout previous version

#### Configuration Backups

**Method**: Export environment variables

**Backup**: Store securely

**Restore**: Import environment variables

### Known Deployment Issues

1. **No Automated Tests**: Deployments not tested automatically
2. **No Blue-Green Deployment**: No zero-downtime deployment
3. **Manual Worker Deployment**: Workers deployed manually
4. **No Database Migration Rollback**: Migrations not reversible
5. **No Health Check Dependencies**: Health checks don't check dependencies

### Recommendations

1. **Add CI/CD**: Automated testing and deployment
2. **Add Database Backups**: Automated daily backups
3. **Add Health Check Dependencies**: Check database, external APIs
4. **Add Monitoring**: APM tool (Datadog, New Relic)
5. **Add Alerting**: Alert on deployment failures
6. **Add Rollback Automation**: Automated rollback on failure
7. **Add Blue-Green Deployment**: Zero-downtime deployments
