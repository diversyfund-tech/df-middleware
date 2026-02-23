# Testing

## Executive Summary

DF-Middleware currently has no automated test suite. Testing is done manually via API endpoints, webhook handlers, and database queries. Recommended testing strategy includes unit tests for sync functions, integration tests for API endpoints, and end-to-end tests for webhook processing.

**Current State:**
- No unit tests
- No integration tests
- No end-to-end tests
- Manual testing only

**Recommended Testing:**
- Unit tests for sync functions
- Integration tests for API endpoints
- End-to-end tests for webhook processing
- Mock external APIs for testing

## Engineering Details

### Current Testing Approach

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

**Webhook Handlers**:
```bash
curl -X POST http://localhost:3002/api/webhooks/ghl \
  -H "Content-Type: application/json" \
  -d '{"event": "contact.updated", "data": {...}}'
```

**Database Queries**:
```sql
SELECT * FROM webhook_events WHERE status = 'pending' LIMIT 10;
```

#### Test Endpoints

**Location**: `src/app/api/test/`

**Endpoints**:
- `GET /api/test/get-ghl-providers` - Test GHL provider connection
- `POST /api/test/test-provider-connection` - Test provider connection
- `POST /api/test/ghl-import` - Test GHL import
- `POST /api/test/import-verity-conversations` - Test Verity import
- `POST /api/test/sync-verity-contact` - Test Verity contact sync
- `POST /api/test/process-texting-event` - Test texting event processing
- `POST /api/test/test-live-message` - Test live message
- `POST /api/test/test-message-import` - Test message import
- `POST /api/test/test-type-values` - Test type values
- `POST /api/test/texting-webhook` - Test texting webhook
- `POST /api/test/verify-verity-db` - Verify Verity database
- `POST /api/test/add-to-list` - Test add to list
- `POST /api/test/add-to-list-direct` - Test direct add to list

**File**: `src/app/api/test/**/*.ts`

### Recommended Testing Strategy

#### Unit Tests

**Framework**: Bun test (recommended) or Jest

**Location**: `src/**/*.test.ts`

**Test Targets**:
- Sync functions (`src/lib/sync/*.ts`)
- API client functions (`src/lib/ghl/client.ts`, `src/lib/aloware/client.ts`)
- Utility functions (`src/lib/utils.ts`)
- Authentication functions (`src/auth/*.ts`)

**Example** (sync function):
```typescript
import { describe, it, expect } from "bun:test";
import { syncContact } from "../lib/sync/contact-sync";

describe("syncContact", () => {
  it("should sync contact from GHL to Aloware", async () => {
    const ghlContact = {
      id: "ghl_123",
      phone: "+1234567890",
      email: "test@example.com",
    };
    
    const result = await syncContact(ghlContact);
    
    expect(result.success).toBe(true);
    expect(result.alowareContactId).toBeDefined();
  });
});
```

#### Integration Tests

**Framework**: Bun test or Jest

**Location**: `tests/integration/*.test.ts`

**Test Targets**:
- API Gateway endpoints (`/api/verity`)
- Webhook handlers (`/api/webhooks/*`)
- Admin endpoints (`/api/admin/*`)
- Job processing (`/api/jobs/*`)

**Example** (API Gateway):
```typescript
import { describe, it, expect } from "bun:test";

describe("API Gateway", () => {
  it("should proxy request to Verity", async () => {
    const response = await fetch("http://localhost:3001/api/verity", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DF_MIDDLEWARE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "/api/comms/broadcasts",
        method: "GET",
      }),
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

#### End-to-End Tests

**Framework**: Bun test or Playwright

**Location**: `tests/e2e/*.test.ts`

**Test Scenarios**:
- Webhook → Job → Sync flow
- Contact sync bidirectional flow
- Message sync flow
- List sync flow

**Example** (webhook flow):
```typescript
import { describe, it, expect } from "bun:test";

describe("Webhook Processing", () => {
  it("should process GHL webhook and sync contact", async () => {
    // Send webhook
    const webhookResponse = await fetch("http://localhost:3002/api/webhooks/ghl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "contact.updated",
        data: { id: "ghl_123", phone: "+1234567890" },
      }),
    });
    
    expect(webhookResponse.status).toBe(200);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check sync log
    const syncLog = await db.query(
      "SELECT * FROM sync_log WHERE source_id = 'ghl_123' ORDER BY started_at DESC LIMIT 1"
    );
    
    expect(syncLog[0].status).toBe("success");
  });
});
```

### Mocking External APIs

#### GHL API Mock

**Framework**: MSW (Mock Service Worker) or nock

**Example**:
```typescript
import { setupServer } from "msw/node";
import { rest } from "msw";

const server = setupServer(
  rest.get("https://services.leadconnectorhq.com/contacts", (req, res, ctx) => {
    return res(
      ctx.json({
        contacts: [
          { id: "ghl_123", phone: "+1234567890", email: "test@example.com" },
        ],
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

#### Aloware API Mock

**Example**:
```typescript
rest.get("https://app.aloware.com/api/v1/webhook/contacts", (req, res, ctx) => {
  return res(
    ctx.json([
      { id: "aloware_123", phone: "+1234567890", email: "test@example.com" },
    ])
  );
});
```

#### Verity API Mock

**Example**:
```typescript
rest.get("http://localhost:3000/api/comms/broadcasts", (req, res, ctx) => {
  return res(
    ctx.json({
      broadcasts: [
        { id: "broadcast_123", name: "Test Broadcast" },
      ],
    })
  );
});
```

### Test Database

#### Setup

**Database**: Separate test database

**Connection**: `DATABASE_URL_TEST` environment variable

**Migrations**: Run migrations before tests

**Example**:
```typescript
import { migrate } from "drizzle-orm/postgres-js/migrator";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
```

#### Teardown

**Cleanup**: Truncate tables after tests

**Example**:
```typescript
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE webhook_events, sync_log, contact_mappings`);
});
```

### Test Coverage

#### Coverage Tool

**Framework**: c8 or Istanbul

**Command**:
```bash
bun test --coverage
```

**Target**: 80% coverage (recommended)

#### Coverage Reports

**Format**: HTML, JSON, LCOV

**Location**: `coverage/`

### Performance Testing

#### Load Testing

**Tool**: k6 or Artillery

**Example** (k6):
```javascript
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const res = http.post("http://localhost:3001/api/verity", JSON.stringify({
    endpoint: "/api/comms/broadcasts",
    method: "GET",
  }), {
    headers: { "Authorization": `Bearer ${__ENV.DF_MIDDLEWARE_API_KEY}` },
  });
  
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
```

### Test Data Management

#### Fixtures

**Location**: `tests/fixtures/*.json`

**Example** (`tests/fixtures/ghl-contact.json`):
```json
{
  "id": "ghl_123",
  "phone": "+1234567890",
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User"
}
```

#### Factories

**Location**: `tests/factories/*.ts`

**Example**:
```typescript
export function createGHLContact(overrides = {}) {
  return {
    id: `ghl_${Math.random()}`,
    phone: "+1234567890",
    email: "test@example.com",
    ...overrides,
  };
}
```

### Continuous Integration

#### GitHub Actions

**Workflow**: `.github/workflows/test.yml`

**Example**:
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun test --coverage
```

### Known Testing Gaps

1. **No Unit Tests**: No unit test coverage
2. **No Integration Tests**: No integration test coverage
3. **No E2E Tests**: No end-to-end test coverage
4. **No Mocking**: External APIs not mocked
5. **No Test Database**: Tests use production database (risky)
6. **No Coverage Reports**: No coverage tracking
7. **No Performance Tests**: No load testing

### Recommendations

1. **Add Unit Tests**: Test sync functions and utilities
2. **Add Integration Tests**: Test API endpoints
3. **Add E2E Tests**: Test webhook processing flows
4. **Add Mocking**: Mock external APIs
5. **Add Test Database**: Use separate test database
6. **Add Coverage Reports**: Track test coverage
7. **Add Performance Tests**: Load test critical endpoints
8. **Add CI/CD**: Run tests on every push
9. **Add Test Data Management**: Use fixtures and factories
10. **Add Snapshot Testing**: Test API responses
