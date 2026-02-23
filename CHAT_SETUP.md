# Chat Interface Setup

## Ports

- **Port 3000**: Verity API (already running)
- **Port 3001**: Express API Gateway (running via `bun dev`)
- **Port 3002**: Next.js Chat Interface (needs to be started)

## Starting the Chat Interface

You need to run **two servers**:

### 1. Express API Gateway (Port 3001)
```bash
bun dev
```
This is already running ✅

### 2. Next.js Chat Interface (Port 3002)
Open a **new terminal** and run:
```bash
cd /Users/jaredlutz/Github/df-middleware
bun run dev:next
```

Then navigate to: **http://localhost:3002/chat**

## Quick Start

```bash
# Terminal 1: Express API Gateway (already running)
bun dev

# Terminal 2: Next.js Chat Interface
bun run dev:next
```

## Why Two Servers?

- **Express (3001)**: Handles API gateway and MCP tool execution
- **Next.js (3002)**: Serves the React chat interface

The chat interface calls the Express API at `http://localhost:3001/api/mcp/chat` to execute MCP tools.
