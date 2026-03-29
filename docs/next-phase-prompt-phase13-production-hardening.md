# Phase 13: Production Hardening & Real-time Streaming

## Context

Phase 12 (Vuln Cockpit Redesign) has been completed on branch `feat/vuln-cockpit-redesign`. The following features were implemented:

1. **Navigation terminology**: "执行" → "发现", "证据与结果" → "漏洞中心", /evidence redirects to /vuln-center
2. **Vulnerability center page** (/vuln-center): Cross-project finding aggregation with severity stats, search/filter, expandable rows
3. **Project list card layout**: Table → card grid with status color borders, priority sorting, metrics badges
4. **LLM thinking logs**: Data model (LlmCallLogRecord), streaming integration in OpenAI provider, AI 日志 tab panel, global floating AI chat widget with 3s polling

## Your Task

Take this platform from prototype to production-ready MVP. Focus areas:

### 1. Real WebSocket Streaming (Priority: High)

Current implementation uses 3-second polling for LLM logs. Replace with WebSocket/SSE push:

- **File**: `components/layout/ai-chat-widget.tsx` — Replace `setInterval` polling with EventSource/WebSocket
- **File**: `components/projects/project-llm-log-panel.tsx` — Same change
- **New**: Create `/api/llm-logs/stream` SSE endpoint that pushes log updates in real-time
- **File**: `lib/llm-call-logger.ts` — Add event emitter for new log entries

### 2. Prisma Database Migration (Priority: High)

Current data layer uses JSON file storage (`lib/prototype-store.ts`). Migrate to Prisma:

- **File**: `prisma/schema.prisma` — LlmCallLog model already defined, needs migration
- Run `npx prisma migrate dev` to create the migration
- **File**: `lib/llm-call-logger.ts` — Replace `readPrototypeStore/writePrototypeStore` with Prisma client calls
- **File**: `lib/project-repository.ts` — Migrate to Prisma
- **File**: `lib/project-results-repository.ts` — Migrate to Prisma

### 3. Authentication Hardening (Priority: Medium)

- **File**: `lib/auth-repository.ts` — Move captcha store from in-memory to database/Redis
- **File**: `lib/auth-session.ts` — Add session refresh mechanism, configurable expiry
- **File**: `middleware.ts` — Add proper IP extraction for rate limiting behind proxies

### 4. E2E Test Stability (Priority: Medium)

The existing smoke tests (`e2e/prototype-smoke.spec.ts`) have pre-existing flakiness:
- Captcha timing: Fixed to wait for `[A-Z0-9]{4}` pattern, but still fragile under load
- CSRF tokens: POST requests in tests may fail if CSRF cookie isn't set
- Consider adding a test-mode bypass for captcha/CSRF in development

### 5. Report Export Enhancement (Priority: Low)

- **File**: `components/projects/project-report-export-panel.tsx` — Add PDF generation
- Add markdown/HTML report templates
- Include LLM reasoning logs in exported reports

## Technical Notes

- **LLM Provider**: Uses OpenAI-compatible API with SSE streaming (`lib/llm-provider/openai-compatible-provider.ts`)
- **Data Store**: File-based JSON at `PROTOTYPE_DATA_DIR` env var path
- **Auth**: Cookie-based sessions with bcrypt passwords and in-memory captcha
- **MCP Connectors**: Real HTTP connectors at `lib/mcp-connectors/` (httpx, curl, afrog, etc.)

## Project Structure Reference

See `code_index.md` for complete file index and `roadmap.md` for development history.

## Development Instructions

1. Create branch from `feat/vuln-cockpit-redesign` or `main` after merge
2. Run `npm run dev` for development server
3. Run `npx vitest run` for unit/API tests
4. Run `npx playwright test` for E2E tests
5. Update `code_index.md` and `roadmap.md` after completion
