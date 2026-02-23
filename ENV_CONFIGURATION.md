# Environment Variable Configuration Guide

This document describes all environment variables used by DF-Middleware, including new variables added for the improvements.

## Required Variables

### Database
- `DATABASE_URL` - PostgreSQL connection string (required)
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://postgres:password@localhost:5432/df_middleware`

### GoHighLevel (GHL)
- `GHL_API_KEY` - Private Integration Token (required)
- `GHL_LOCATION_ID` - GHL location identifier (required)
- `GHL_CALENDAR_ID` - GHL calendar identifier (required)

### Aloware
- `ALOWARE_API_TOKEN` - Aloware API authentication token (required)
- `ALOWARE_WEBHOOK_BASIC_USER` - Basic auth username for Aloware webhooks (required)
- `ALOWARE_WEBHOOK_BASIC_PASS` - Basic auth password for Aloware webhooks (required)

### Job Processing
- `X_DF_JOBS_SECRET` - Secret for job processing endpoints (required)
- `DF_ADMIN_SECRET` - Secret for admin endpoints (required)

### Clerk Authentication
- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification (required for MCP server)

## Optional Variables

### Server Configuration
- `PORT` - Express server port (default: `3001`)
- `NODE_ENV` - Environment mode: `development`, `production`, or `test` (default: `development`)
- `BASE_URL` - Base URL of the application (optional)

### CORS Configuration
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (optional)
  - Example: `https://app.example.com,https://admin.example.com`
  - **Important**: In production, this must be set or all CORS requests will be rejected
  - In development, all origins are allowed

### Database Connection Pooling
- `DB_MAX_CONNECTIONS` - Maximum number of database connections in pool (default: `10`)
- `DB_IDLE_TIMEOUT` - Idle connection timeout in seconds (default: `30`)
- `DB_CONNECTION_TIMEOUT` - Connection timeout in seconds (default: `10`)

### Rate Limiting
- `RATE_LIMIT_MAX` - Maximum requests per 15 minutes for API endpoints (default: `100`)
- `WEBHOOK_RATE_LIMIT_MAX` - Maximum webhook requests per 15 minutes (default: `1000`)
- `ADMIN_RATE_LIMIT_MAX` - Maximum admin requests per 15 minutes (default: `50`)

### Logging
- `LOG_LEVEL` - Log level: `debug`, `info`, `warn`, `error`, `fatal` (default: `info` in production, `debug` in development)

### GoHighLevel (GHL) - Optional
- `GHL_BASE_URL` - GHL API base URL (default: `https://services.leadconnectorhq.com`)
- `GHL_WEBHOOK_SECRET` - Secret for GHL webhook signature verification (optional but recommended)
- `GHL_CONVERSATION_PROVIDER_ID` - Provider ID for historical message imports (optional)
- `GHL_CLIENT_ID` - OAuth client ID for Marketplace App (optional, required for OAuth token refresh)
- `GHL_CLIENT_SECRET` - OAuth client secret for Marketplace App (optional, required for OAuth token refresh)

### Aloware - Optional
- `ALOWARE_WEBHOOK_ALLOWED_EVENTS` - Comma-separated list of allowed webhook events (optional)

### Verity Integration - Optional
- `VERITY_BASE_URL` - Verity API base URL (optional)
- `VERITY_API_KEY` - Verity API key (optional)
- `VERITY_WEBHOOK_SECRET` - Secret for Verity webhook signature verification (optional but recommended)
- `VERITY_DATABASE_URL` - Verity database connection string (optional, for direct database queries)
- `VERITY_CATALOG_PATH` - Path to Verity API catalog JSON file (optional)

### Texting System - Optional
- `TEXTING_SYNC_TO_ALOWARE` - Enable Aloware sync for texting messages (optional)

### API Gateway - Optional
- `DF_MIDDLEWARE_API_KEY` - API key for middleware-to-middleware communication (optional)

### Alerting - Optional
- `ALERT_WEBHOOK_URL` - Webhook URL for sending alerts (optional)
  - Example: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`
  - If not set, alerts will be logged but not sent

### Job Processing - Optional
- `JOBS_BATCH_SIZE` - Batch size for processing jobs (default: `100`)

### Conflict Resolution - Optional
- `CONTACT_SOURCE_OF_TRUTH` - Source of truth for contacts: `ghl`, `aloware`, or `merge` (default: `merge`)

### Agent Management - Optional
- `AGENT_LIST_KEYS` - Comma-separated list of agent list keys (default: `CALL_NOW,NEW_LEADS,FOLLOW_UP,HOT`)
- `DEFAULT_AGENT_KEY` - Default agent key (default: `UNASSIGNED`)
- `GHL_ASSIGNED_AGENT_FIELD_KEY` - GHL custom field key for assigned agent (default: `assignedAgent`)
- `ENABLE_AGENT_LIST_SYNC` - Enable agent-managed list sync (default: `true`)
- `TAG_MATCH_MODE` - Tag matching mode: `exact`, `case_insensitive`, or `regex` (default: `case_insensitive`)

### Aloware Sequences - Optional
- `ENABLE_ALOWARE_SEQUENCES` - Enable Aloware sequence enrollment (default: `false`)
- `ALOWARE_STATUS_TO_SEQUENCE` - JSON mapping of status to sequence ID (optional)
  - Example: `{"NEW_LEADS": "seq_123", "FOLLOW_UP": "seq_456"}`

### Feature Flags - Optional
- `ENABLE_POWER_DIALER_LISTS` - Enable power dialer list sync (default: `false`)

### ElevenLabs Workflows - Optional
- `ELEVENLABS_WEBHOOK_SECRET` - Secret for ElevenLabs webhook verification (optional)

### MCP Server - Optional
- `MCP_BASE_URL` - Base URL for MCP server (default: `http://localhost:3002`)

## Production Checklist

Before deploying to production, ensure these variables are set:

- [ ] `DATABASE_URL` - Production database connection string
- [ ] `NODE_ENV=production`
- [ ] `CORS_ALLOWED_ORIGINS` - List of allowed origins
- [ ] `GHL_WEBHOOK_SECRET` - For webhook signature verification
- [ ] `VERITY_WEBHOOK_SECRET` - For webhook signature verification
- [ ] `ALERT_WEBHOOK_URL` - For alerting (if using)
- [ ] `LOG_LEVEL=info` - Use info level in production
- [ ] All required API keys and secrets

## Example .env.local File

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/df_middleware

# Server
PORT=3001
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# Database Pooling
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30
DB_CONNECTION_TIMEOUT=10

# Rate Limiting
RATE_LIMIT_MAX=100
WEBHOOK_RATE_LIMIT_MAX=1000
ADMIN_RATE_LIMIT_MAX=50

# Logging
LOG_LEVEL=debug

# GHL
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id
GHL_CALENDAR_ID=your_calendar_id
GHL_WEBHOOK_SECRET=your_webhook_secret

# Aloware
ALOWARE_API_TOKEN=your_aloware_token
ALOWARE_WEBHOOK_BASIC_USER=your_username
ALOWARE_WEBHOOK_BASIC_PASS=your_password

# Verity
VERITY_BASE_URL=https://api.verity.example.com
VERITY_WEBHOOK_SECRET=your_verity_secret

# Clerk
CLERK_SECRET_KEY=your_clerk_secret

# Job Processing
X_DF_JOBS_SECRET=your_jobs_secret
DF_ADMIN_SECRET=your_admin_secret

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Security Notes

1. **Never commit `.env.local` or `.env` files** - These contain sensitive credentials
2. **Use different secrets for development and production**
3. **Rotate secrets regularly** - Especially API keys and webhook secrets
4. **Use environment-specific values** - Development and production should use different databases and API keys
5. **Webhook secrets are critical** - Always set `GHL_WEBHOOK_SECRET` and `VERITY_WEBHOOK_SECRET` in production
