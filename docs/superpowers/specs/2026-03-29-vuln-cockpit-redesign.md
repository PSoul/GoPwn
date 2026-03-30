# Vuln Cockpit Redesign Spec

Date: 2026-03-29
Status: Approved
Scope: Navigation terminology, vulnerability center, project list cards, LLM real-time thinking logs

## Context

The platform is a vulnerability scanning cockpit (漏洞扫描驾驶舱). Three problems need solving:
1. Sidebar label "证据与结果" doesn't match the product identity — should be "漏洞中心"
2. Project list is a plain table where 9 projects look identical — no visual differentiation
3. No visibility into LLM reasoning — researchers can't see what the AI is thinking or why it made decisions

## Implementation Strategy

"先打地基，再刷墙" — Infrastructure first, then UI, then integration.

- **Layer 1 (Foundation)**: Data models, API endpoints, LLM provider streaming, terminology replacement
- **Layer 2 (UI)**: Vulnerability center page, project cards, AI log tab, AI chat widget
- **Layer 3 (Integration)**: E2E tests, API tests, documentation (code_index.md, roadmap.md)

## 1. Navigation Terminology

### Global Replacements

| Current | New | Locations |
|---------|-----|-----------|
| 证据与结果 | 漏洞中心 | Sidebar nav, breadcrumb, page title |
| `/evidence` | `/vuln-center` | Route path |
| "执行" group | "发现" group | Sidebar section label |

### Sidebar Structure (After)

```
总览
  仪表盘        /dashboard
  项目管理      /projects
  审批中心      /approvals

发现
  资产中心      /assets
  漏洞中心      /vuln-center

系统
  系统设置      /settings
```

### Project Detail Tab Rename

The project workspace "证据" tab renames to "上下文" to avoid confusion with the global vulnerability center. Project-level evidence is execution context; the global view is the vulnerability cockpit.

## 2. Vulnerability Center Page (`/vuln-center`)

Replaces the current `/evidence` page. Shifts focus from evidence listing to cross-project vulnerability overview.

### Page Structure (Top to Bottom)

**A. Stats Cards Row**
Four cards showing: Total vulnerabilities, High severity (with pending verification count), Medium severity, Low/Intel severity. Each card links to filtered view below.

**B. Vulnerability List (Primary)**
Cross-project aggregation of all `Finding` records:
- Default sort: severity descending (high first), then by update time
- Columns: Severity color indicator | Title | Project | Affected surface | Status (待验证/已确认/已修复) | Linked evidence count | Actions
- Filters: severity, project, status
- Expandable rows: show linked evidence summary and affected assets

**C. Evidence Archive (Secondary, Collapsed)**
Collapsible panel titled "执行证据归档 (N)":
- Default collapsed
- Expands to show the original evidence table (migrated from current page)
- Retains search and filter capabilities

**D. Remove Static Copy**
The "复核节奏" guidance section is removed for production.

### New API

`GET /api/vuln-center/summary` — Returns:
```json
{
  "total": 12,
  "bySeverity": { "高危": 3, "中危": 5, "低危": 2, "情报": 2 },
  "pendingVerification": 6,
  "findings": [/* Finding records with project name */]
}
```

## 3. Project List Card Layout

### Card Structure

Each project renders as a card instead of a table row:
- **Header**: Status color badge (left border 4px) + project code
- **Title**: Project name (large, bold)
- **Target**: Primary target URL + target count
- **Metrics Row**: Asset count | Vulnerability count | Evidence count | Approval count (colored badges)
- **Stage**: Current phase name
- **Activity**: Most recent action + timestamp
- **Actions**: Detail / Edit / Archive buttons

### Visual Differentiation by Status

| Status | Left Border | Badge Style |
|--------|------------|-------------|
| 运行中 | Blue 4px | Blue with pulse animation |
| 待处理 | Gray 4px | Gray |
| 已完成 | Green 4px | Green |
| 已阻塞 | Red 4px | Red |
| 已暂停 | Orange 4px | Orange |

### Layout
- Grid: 2 columns default, 3 columns on large screens, 1 column on mobile
- Summary text truncated to 2 lines max
- Default sort: update time descending, running/blocked projects prioritized
- Search bar and filters remain above the card grid
- Top stats strip retained (filtered results, blocked projects, approval pressure, open tasks)

## 4. LLM Real-Time Thinking Logs

### 4.1 Data Model

New Prisma model `LlmCallLog`:

```prisma
model LlmCallLog {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  role        String    // "orchestrator" | "reviewer" | "extractor"
  phase       String    // "planning" | "reviewing" | "extracting" | "concluding"
  prompt      String    // Full prompt sent to LLM
  response    String    @default("")  // Full response (appended during streaming)
  status      String    @default("streaming") // "streaming" | "completed" | "failed"
  model       String    @default("")
  provider    String    @default("")
  tokenUsage  Json?     // { promptTokens, completionTokens, totalTokens }
  durationMs  Int?
  error       String?
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  @@index([projectId])
  @@index([projectId, role])
  @@map("llm_call_logs")
}
```

Add `llmCallLogs LlmCallLog[]` relation to `Project` model.

### 4.2 LLM Provider Streaming

Modify `openai-compatible-provider.ts`:

1. Enable `stream: true` by default
2. On call start: create `LlmCallLog` record (status=streaming)
3. Accumulate response chunks, flush to DB every ~500ms
4. On completion: update status=completed, record tokenUsage + durationMs
5. On error: update status=failed, record error message
6. Return value unchanged — full response string. Callers are unaffected.

### 4.3 AI Log Tab (Project Detail)

New 8th tab in project workspace: "AI 日志"

**Content:**
- Role tabs: 编排推理 | 结论审阅 | 数据提取 (collapsed by default)
- Log entries in reverse chronological order
- Each entry shows: timestamp, role badge, status (streaming/completed/failed), model name
- Prompt section: collapsed by default, expandable
- Response section: expanded by default, streaming entries show typing cursor animation
- Metadata footer: duration, token usage (prompt/completion/total)
- Auto-refresh toggle: ON by default when project is running, polls every 3 seconds

**API:**
- `GET /api/projects/[id]/llm-logs` — List logs, supports `?role=&status=&since=` filters
- `GET /api/projects/[id]/llm-logs/[logId]` — Single log detail

### 4.4 AI Chat Widget (Global Floating)

Global floating widget, available on every page for authenticated users.

**Visual:**
- Bottom-right corner, collapsible to a circular button with robot icon
- When expanded: ~350px wide, ~500px tall chat-style panel
- Pulse indicator on the button when new messages arrive while minimized

**Content:**
- Chat-bubble style layout: each LLM response is a bubble
- Only shows response content (no prompt — too long for chat format)
- Role label on each bubble: [编排] / [审阅] / [提取]
- Timestamp on each bubble
- Streaming bubbles: content appends in real-time with cursor animation, auto-scroll to bottom
- Bottom tabs to filter by role
- Shows logs from the most recently active project (determined by latest LlmCallLog entry)

**Behavior:**
- Mounted in app-shell layout, persists across page navigation
- Auto-refreshes every 3 seconds when any project is running
- Minimized by default on first load
- Remembers expanded/minimized state in localStorage

## 5. Housekeeping

### Pre-Development
- Create new git branch `feat/vuln-cockpit-redesign` from current branch
- Add `*.txt` to `.gitignore`

### Post-Development
- Generate/update `code_index.md` — full code index describing all files and their purposes
- Generate/update `roadmap.md` — development progress, phases, milestones, acceptance criteria
- Provide next-phase prompt file if applicable

### Testing
- Unit tests for new APIs (vuln-center summary, llm-logs CRUD)
- Unit tests for LLM call logger service
- Component tests for project card, AI log panel, AI chat widget
- E2E tests covering: login → dashboard → project list (card view) → project detail (AI log tab) → vuln center
- Middleware tests for new routes

## 6. Out of Scope

- Migration from JSON file store to PostgreSQL (Prisma schema exists but wiring is separate work)
- WebSocket/SSE for true real-time push (polling is sufficient)
- Multi-turn LLM conversation (remains single prompt→response per call)
- Dashboard page redesign (not requested)

## 7. New Files

```
lib/llm-call-logger.ts                           — LLM call log write service
app/api/projects/[projectId]/llm-logs/route.ts    — LLM logs list API
app/api/projects/[projectId]/llm-logs/[logId]/route.ts — Single log API
app/api/vuln-center/summary/route.ts              — Vuln center stats API
app/(console)/vuln-center/page.tsx                — Vuln center page
app/(console)/vuln-center/layout.tsx              — Vuln center layout
components/projects/project-card.tsx               — Project card component
components/projects/project-llm-log-panel.tsx      — AI log tab panel
components/layout/ai-chat-widget.tsx               — Global floating chat widget
tests/api/vuln-center-api.test.ts                  — Vuln center API tests
tests/api/llm-logs-api.test.ts                     — LLM logs API tests
tests/projects/project-card.test.tsx               — Project card component tests
tests/projects/project-llm-log-panel.test.tsx      — AI log panel tests
tests/layout/ai-chat-widget.test.tsx               — Chat widget tests
```

## 8. Modified Files

```
prisma/schema.prisma                              — Add LlmCallLog model + Project relation
lib/llm-provider/openai-compatible-provider.ts    — Streaming + log writing
lib/navigation.ts                                 — Terminology: 证据与结果→漏洞中心, 执行→发现
lib/prototype-types.ts                            — Add LlmCallLog types
components/projects/project-list-client.tsx        — Table → card grid
components/projects/project-workspace-nav.tsx      — Add AI 日志 tab, rename 证据→上下文
components/layout/app-shell.tsx                   — Mount AI chat widget
middleware.ts                                     — Add /vuln-center, /api/vuln-center to routes
app/(console)/evidence/                           — Redirect to /vuln-center or remove
```
