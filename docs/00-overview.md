# DF-Middleware Overview

## Executive Summary

**DF-Middleware** is an Express/Next.js API gateway and MCP (Model Context Protocol) server that orchestrates communication between multiple systems in the DiversyFund ecosystem. It serves as the central integration layer connecting GoHighLevel (GHL), Aloware, Verity (capital management platform), and a proprietary texting system.

### Key Outcomes

- **Unified API Gateway**: Single entry point for proxying requests to Verity API with authentication and validation
- **Bidirectional Sync**: Keeps contacts, calls, messages, and lists synchronized between GHL and Aloware
- **MCP Server**: Exposes all Verity API endpoints as tools for AI agents via Model Context Protocol
- **Webhook Processing**: Async processing of webhook events from GHL, Aloware, and texting systems
- **Agent Management**: Maps agent assignments to call lists and manages agent-managed workflows

### Quick Reference

| Aspect | Details |
|--------|---------|
| **Primary Language** | TypeScript |
| **Runtime** | Bun (Express server) + Next.js (API routes) |
| **Database** | PostgreSQL with Drizzle ORM |
| **Job Queue** | pg-boss |
| **Deployment** | Vercel (Next.js routes) + Standalone Express server |
| **Main Entry Point** | `src/index.ts` (Express) |
| **MCP Server** | `src/mcp/server.ts` |
| **API Gateway** | `src/api-gateway/router.ts` |

### Architecture at a Glance

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   GHL       │────▶│              │◀────│  Aloware    │
│  Webhooks   │     │ DF-Middleware │     │  Webhooks   │
└─────────────┘     │              │     └─────────────┘
                    │  ┌──────────┐ │
┌─────────────┐     │  │ Express │ │     ┌─────────────┐
│   Verity    │◀────│  │ Gateway │ │────▶│   MCP      │
│    API      │     │  └──────────┘ │     │  Server    │
└─────────────┘     │              │     └─────────────┘
                    │  ┌──────────┐ │
┌─────────────┐     │  │ pg-boss │ │
│  Texting    │────▶│  │  Queue  │ │
│  System     │     │  └──────────┘ │
└─────────────┘     └──────────────┘
```

## Engineering Details

### Core Components

1. **Express API Gateway** (`src/index.ts`)
   - Port: 3001 (configurable via `PORT`)
   - Health check: `GET /health`
   - API Gateway: `POST /api/verity`
   - Catalog endpoint: `GET /api/verity`

2. **MCP Server** (`src/mcp/server.ts`)
   - Runs via stdio: `bun src/mcp/server.ts`
   - Dynamically generates tools from Verity API catalog
   - Uses Clerk session tokens for authentication
   - Auto-refreshes tokens on 401 errors

3. **Next.js API Routes** (`src/app/api/`)
   - Webhook handlers for GHL, Aloware, texting
   - Admin endpoints for event management
   - Sync endpoints for manual reconciliation
   - Job processing endpoints

4. **Sync Library** (`src/lib/sync/`)
   - Contact sync (bidirectional)
   - Call sync (Aloware → GHL)
   - Message sync (texting → GHL/Aloware)
   - List sync (agent-managed call lists)
   - DNC/opt-out sync

5. **Job Queue** (`src/lib/jobs/boss.ts`)
   - pg-boss for async job processing
   - Webhook event processing queue
   - Broadcast event processing queue
   - Cron job: `/api/jobs/process-pending` (every 5 minutes)

### Key Integrations

- **GoHighLevel (GHL)**: CRM platform, uses Private Integration Token (PIT) and OAuth for Marketplace App
- **Aloware**: Power dialer and call management, uses API token authentication
- **Verity**: Capital management platform, proxied via API gateway with Clerk JWT auth
- **Texting System**: Proprietary SMS system integrated with Verity

### Database Schema

See `03-data-model.md` for complete schema documentation. Key tables:

- `webhook_events` - Stores incoming webhook events
- `sync_log` - Tracks sync operations
- `contact_mappings` - Maps contacts between systems
- `message_mappings` - Maps messages across systems
- `optout_registry` - Authoritative do-not-text list
- `agent_directory` - Maps agent keys to system identifiers
- `call_list_registry` - Tracks Aloware list IDs per agent/listKey

### Environment Variables

See `11-appendix-glossary.md` for complete environment variable reference. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `GHL_API_KEY` - GoHighLevel Private Integration Token
- `GHL_LOCATION_ID` - GHL location identifier
- `ALOWARE_API_TOKEN` - Aloware API authentication token
- `VERITY_BASE_URL` - Verity API base URL
- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification
- `DF_MIDDLEWARE_API_KEY` - API key for middleware-to-middleware communication

### Development Workflow

1. **Start Express server**: `bun run dev` (runs `src/index.ts`)
2. **Start Next.js dev server**: `bun run dev:next` (runs Next.js on port 3002)
3. **Start MCP server**: `bun run mcp` (runs `src/mcp/server.ts`)

### Known Limitations

- Clerk authentication verification is placeholder (see `src/auth/verity-auth.ts`)
- Some sync operations may have race conditions during high-volume periods
- MCP server requires at least one active Clerk session to function
- Agent-managed call lists feature requires manual agent directory seeding

### Related Documentation

- `01-architecture.md` - System design and runtime model
- `02-services-and-modules.md` - Code organization
- `04-integrations.md` - External service integrations
- `05-security-and-compliance.md` - Authentication and secrets management
