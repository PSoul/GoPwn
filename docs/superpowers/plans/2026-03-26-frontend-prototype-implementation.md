# Frontend Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tracked Next.js prototype app in this isolated worktree that turns the approved security-assessment spec into a high-fidelity, route-complete admin prototype using the provided login and dashboard templates.

**Architecture:** Seed the app from the existing dashboard template, fold in the login template as a dedicated `/login` route, and reorganize routes with Next.js App Router so all console pages share one layout. Keep the prototype data-driven with centralized mock data and reusable status/section components so the eight core pages stay visually consistent and easy to evolve.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui components copied from the provided templates, next-themes, Vitest + React Testing Library for smoke tests.

---

## File Structure Map

### Source templates to copy from

- `D:\dev\llmpentest0326\后台模板\*`
- `D:\dev\llmpentest0326\登录框模板\components\login-form.tsx`
- `D:\dev\llmpentest0326\登录框模板\app\login\page.tsx`

### App files to create or own in this worktree

- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `next-env.d.ts`
- Create: `vitest.config.mts`
- Create: `tests/setup.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `app/login/page.tsx`
- Create: `app/(console)/layout.tsx`
- Create: `app/(console)/dashboard/page.tsx`
- Create: `app/(console)/projects/page.tsx`
- Create: `app/(console)/projects/new/page.tsx`
- Create: `app/(console)/projects/[projectId]/page.tsx`
- Create: `app/(console)/approvals/page.tsx`
- Create: `app/(console)/assets/page.tsx`
- Create: `app/(console)/assets/[assetId]/page.tsx`
- Create: `app/(console)/evidence/page.tsx`
- Create: `app/(console)/evidence/[evidenceId]/page.tsx`
- Create: `app/(console)/settings/page.tsx`
- Create: `components/auth/login-form.tsx`
- Create: `components/layout/app-sidebar.tsx`
- Create: `components/layout/app-header.tsx`
- Create: `components/layout/app-shell.tsx`
- Create: `components/shared/page-header.tsx`
- Create: `components/shared/stat-card.tsx`
- Create: `components/shared/status-badge.tsx`
- Create: `components/shared/section-card.tsx`
- Create: `components/projects/project-stage-flow.tsx`
- Create: `components/projects/project-summary.tsx`
- Create: `components/projects/project-task-board.tsx`
- Create: `components/projects/project-knowledge-tabs.tsx`
- Create: `components/approvals/approval-list.tsx`
- Create: `components/approvals/approval-detail-sheet.tsx`
- Create: `components/assets/asset-table.tsx`
- Create: `components/assets/asset-profile-panel.tsx`
- Create: `components/assets/asset-relations.tsx`
- Create: `components/evidence/evidence-table.tsx`
- Create: `components/evidence/evidence-detail.tsx`
- Create: `components/settings/mcp-tool-table.tsx`
- Create: `components/settings/system-control-panel.tsx`
- Create: `components/theme-provider.tsx`
- Create: `components/theme-toggle.tsx`
- Create: `components/ui/*`
- Create: `hooks/use-mobile.ts`
- Create: `hooks/use-toast.ts`
- Create: `lib/utils.ts`
- Create: `lib/navigation.ts`
- Create: `lib/prototype-types.ts`
- Create: `lib/prototype-data.ts`
- Create: `public/*`
- Create: `code_index.md`

### Tests to create

- Create: `tests/auth/login-form.test.tsx`
- Create: `tests/layout/app-shell.test.tsx`
- Create: `tests/pages/dashboard-page.test.tsx`
- Create: `tests/pages/projects-page.test.tsx`
- Create: `tests/pages/project-detail-page.test.tsx`
- Create: `tests/pages/approvals-assets-page.test.tsx`
- Create: `tests/pages/evidence-settings-page.test.tsx`

## Task 1: Seed the Next.js app from the provided templates

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `next-env.d.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `components/ui/*`, `components/theme-provider.tsx`, `components/theme-toggle.tsx`
- Create: `hooks/use-mobile.ts`, `hooks/use-toast.ts`
- Create: `lib/utils.ts`
- Create: `public/*`

- [ ] **Step 1: Copy the dashboard template scaffold into the worktree root**

Use these source paths:

```text
D:\dev\llmpentest0326\后台模板\app
D:\dev\llmpentest0326\后台模板\components
D:\dev\llmpentest0326\后台模板\hooks
D:\dev\llmpentest0326\后台模板\lib
D:\dev\llmpentest0326\后台模板\public
D:\dev\llmpentest0326\后台模板\package.json
D:\dev\llmpentest0326\后台模板\next.config.mjs
D:\dev\llmpentest0326\后台模板\postcss.config.mjs
D:\dev\llmpentest0326\后台模板\tsconfig.json
```

- [ ] **Step 2: Normalize config files for this repo**

Update the copied config so the root app uses:

```ts
// tailwind.config.ts
content: [
  "./app/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./hooks/**/*.{ts,tsx}",
  "./lib/**/*.{ts,tsx}",
]
```

- [ ] **Step 3: Replace the starter home redirect with the prototype root redirect**

```tsx
// app/page.tsx
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/dashboard")
}
```

- [ ] **Step 4: Install dependencies and verify the seeded app boots**

Run: `npm install`  
Run: `npm run lint`  
Expected: lint completes or only reports issues in files you still plan to replace immediately.

- [ ] **Step 5: Commit the scaffold import**

```bash
git add package.json next.config.mjs postcss.config.mjs tsconfig.json next-env.d.ts tailwind.config.ts app components hooks lib public
git commit -m "chore: seed prototype app from dashboard template"
```

## Task 2: Add test tooling and shared prototype data foundations

**Files:**
- Create: `vitest.config.mts`
- Create: `tests/setup.ts`
- Create: `tests/layout/app-shell.test.tsx`
- Create: `lib/navigation.ts`
- Create: `lib/prototype-types.ts`
- Create: `lib/prototype-data.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the failing test harness files**

Add a Vitest config based on the official Next.js guidance:

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
})
```

- [ ] **Step 2: Add the first failing smoke test for the console shell**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { prototypeNavigation } from "@/lib/navigation"

describe("prototype navigation", () => {
  it("defines the six primary console destinations", () => {
    expect(prototypeNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/projects",
      "/approvals",
      "/assets",
      "/evidence",
      "/settings",
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails before implementation**

Run: `npx vitest run tests/layout/app-shell.test.tsx`  
Expected: FAIL because `prototypeNavigation` does not exist yet.

- [ ] **Step 4: Implement the shared data and navigation layer**

Create:

```ts
// lib/navigation.ts
export const prototypeNavigation = [
  { title: "仪表盘", href: "/dashboard" },
  { title: "项目管理", href: "/projects" },
  { title: "审批中心", href: "/approvals" },
  { title: "资产中心", href: "/assets" },
  { title: "证据与结果", href: "/evidence" },
  { title: "系统设置", href: "/settings" },
]
```

Also create `lib/prototype-types.ts` and `lib/prototype-data.ts` to store all mock datasets used by the pages.

- [ ] **Step 5: Run tests and lint**

Run: `npx vitest run tests/layout/app-shell.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS

- [ ] **Step 6: Commit the test harness and data foundation**

```bash
git add package.json vitest.config.mts tests lib
git commit -m "test: add prototype data and smoke test foundation"
```

## Task 3: Rebuild the root layout and shared console shell

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `app/(console)/layout.tsx`
- Create: `components/layout/app-sidebar.tsx`
- Create: `components/layout/app-header.tsx`
- Create: `components/layout/app-shell.tsx`
- Create: `components/shared/page-header.tsx`
- Create: `components/shared/stat-card.tsx`
- Create: `components/shared/status-badge.tsx`
- Create: `components/shared/section-card.tsx`

- [ ] **Step 1: Add a failing shell test that expects shared navigation and top chrome**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AppShell } from "@/components/layout/app-shell"

describe("AppShell", () => {
  it("renders global navigation and a main landmark", () => {
    render(<AppShell title="仪表盘">content</AppShell>)
    expect(screen.getByText("项目管理")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `npx vitest run tests/layout/app-shell.test.tsx`  
Expected: FAIL because `AppShell` is missing.

- [ ] **Step 3: Implement the shared shell using route groups and shadcn sidebar patterns**

Use the official patterns confirmed from Context7:

1. Put all console routes under `app/(console)`.
2. Keep `/login` outside the console group.
3. Wrap console pages with a shared shell in `app/(console)/layout.tsx`.
4. Base sidebar behavior on `SidebarProvider` and `SidebarTrigger`.

- [ ] **Step 4: Replace template branding with product-specific labels**

Update the copied sidebar/header so they show:

1. 平台名称
2. 当前页面标题
3. 全局搜索或快捷入口占位
4. 主题切换
5. 研究员账户入口

- [ ] **Step 5: Run the shell test, lint, and a production build**

Run: `npx vitest run tests/layout/app-shell.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 6: Commit the shared shell**

```bash
git add app components tests app/globals.css
git commit -m "feat: add shared console shell"
```

## Task 4: Implement `/login` from the login template

**Files:**
- Create: `app/login/page.tsx`
- Create: `components/auth/login-form.tsx`
- Create: `tests/auth/login-form.test.tsx`

- [ ] **Step 1: Add a failing login smoke test**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LoginForm } from "@/components/auth/login-form"

describe("LoginForm", () => {
  it("renders account, password, captcha, and submit controls", () => {
    render(<LoginForm />)
    expect(screen.getByLabelText("账号")).toBeInTheDocument()
    expect(screen.getByLabelText("密码")).toBeInTheDocument()
    expect(screen.getByLabelText("验证码")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "登录平台" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the login test to verify it fails**

Run: `npx vitest run tests/auth/login-form.test.tsx`  
Expected: FAIL because the adapted login form is not implemented.

- [ ] **Step 3: Copy and adapt the login template**

Use `D:\dev\llmpentest0326\登录框模板\components\login-form.tsx` as the structural base, then replace the content with:

1. 平台账号
2. 登录密码
3. 图形验证码
4. 安全审计提示
5. “忘记密码”与“联系管理员”辅助入口

Page route:

```tsx
// app/login/page.tsx
export default function LoginPage() {
  return <LoginForm />
}
```

- [ ] **Step 4: Run the login test, lint, and build**

Run: `npx vitest run tests/auth/login-form.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit the login route**

```bash
git add app/login components/auth tests/auth
git commit -m "feat: add platform login route"
```

## Task 5: Implement `/dashboard`, `/projects`, and `/projects/new`

**Files:**
- Create: `app/(console)/dashboard/page.tsx`
- Create: `app/(console)/projects/page.tsx`
- Create: `app/(console)/projects/new/page.tsx`
- Create: `tests/pages/dashboard-page.test.tsx`
- Create: `tests/pages/projects-page.test.tsx`
- Modify: `lib/prototype-data.ts`
- Modify: `components/shared/*` as needed

- [ ] **Step 1: Add failing smoke tests for dashboard and projects**

```tsx
expect(screen.getByText("待审批动作")).toBeInTheDocument()
expect(screen.getByText("华曜科技匿名外网面梳理")).toBeInTheDocument()
expect(screen.getByText("新建项目")).toBeInTheDocument()
```

- [ ] **Step 2: Run the two tests to verify they fail**

Run: `npx vitest run tests/pages/dashboard-page.test.tsx tests/pages/projects-page.test.tsx`  
Expected: FAIL because the new page modules and mock data are not in place yet.

- [ ] **Step 3: Implement the dashboard page**

Build the page from reusable cards and sections:

1. KPI cards for项目总数、运行中项目、已发现资产、已确认问题、待审批动作
2. “今天优先处理”阻塞区
3. 最近执行任务
4. 最近新发现资产
5. 最近验证结果
6. MCP 工具健康状态

- [ ] **Step 4: Implement the projects list page**

Include:

1. 搜索框
2. 状态筛选
3. 阶段筛选
4. 项目表格
5. 每行展示项目名、目标种子、当前主阶段、待审批数量、更新时间

- [ ] **Step 5: Implement the project creation page**

Use section cards to express:

1. 基础信息
2. 授权与范围
3. 禁止动作
4. 并发与速率
5. 审批策略
6. 提交确认

- [ ] **Step 6: Run tests, lint, and build**

Run: `npx vitest run tests/pages/dashboard-page.test.tsx tests/pages/projects-page.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 7: Commit the first console pages**

```bash
git add app/(console)/dashboard app/(console)/projects components/shared lib/prototype-data.ts tests/pages
git commit -m "feat: add dashboard and project entry pages"
```

## Task 6: Implement the project detail flow hub

**Files:**
- Create: `app/(console)/projects/[projectId]/page.tsx`
- Create: `components/projects/project-stage-flow.tsx`
- Create: `components/projects/project-summary.tsx`
- Create: `components/projects/project-task-board.tsx`
- Create: `components/projects/project-knowledge-tabs.tsx`
- Create: `tests/pages/project-detail-page.test.tsx`
- Modify: `lib/prototype-data.ts`

- [ ] **Step 1: Add a failing project detail test**

```tsx
expect(screen.getByText("当前主阶段")).toBeInTheDocument()
expect(screen.getByText("回流提示")).toBeInTheDocument()
expect(screen.getByText("任务与调度")).toBeInTheDocument()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/pages/project-detail-page.test.tsx`  
Expected: FAIL because the project detail view is not implemented.

- [ ] **Step 3: Implement the summary and stage flow components**

The page must show:

1. 项目名称、目标摘要、整体状态、待审批数量
2. 主阶段轨道
3. 已完成阶段
4. 当前阶段
5. 阻塞说明
6. 回流提示
7. 下一步建议

- [ ] **Step 4: Implement the task board and knowledge tabs**

Required tabs:

1. 已发现信息
2. 资产
3. IP / 端口 / 服务
4. 指纹 / 技术栈
5. Web / API 入口
6. 审批记录
7. 证据与日志
8. 任务与调度

- [ ] **Step 5: Run the test, lint, and build**

Run: `npx vitest run tests/pages/project-detail-page.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 6: Commit the project detail hub**

```bash
git add app/(console)/projects/[projectId] components/projects lib/prototype-data.ts tests/pages/project-detail-page.test.tsx
git commit -m "feat: add project detail flow hub"
```

## Task 7: Implement `/approvals`, `/assets`, and `/assets/[assetId]`

**Files:**
- Create: `app/(console)/approvals/page.tsx`
- Create: `app/(console)/assets/page.tsx`
- Create: `app/(console)/assets/[assetId]/page.tsx`
- Create: `components/approvals/approval-list.tsx`
- Create: `components/approvals/approval-detail-sheet.tsx`
- Create: `components/assets/asset-table.tsx`
- Create: `components/assets/asset-profile-panel.tsx`
- Create: `components/assets/asset-relations.tsx`
- Create: `tests/pages/approvals-assets-page.test.tsx`
- Modify: `lib/prototype-data.ts`

- [ ] **Step 1: Add a failing approvals/assets test**

```tsx
expect(screen.getByText("审批中心")).toBeInTheDocument()
expect(screen.getByText("资产中心")).toBeInTheDocument()
expect(screen.getByText("当前识别画像")).toBeInTheDocument()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/pages/approvals-assets-page.test.tsx`  
Expected: FAIL because approvals and assets views are missing.

- [ ] **Step 3: Implement the global approvals center**

Include:

1. 状态过滤
2. 风险等级过滤
3. 跨项目审批列表
4. 审批详情抽屉
5. 批准、拒绝、延后操作按钮

- [ ] **Step 4: Implement the assets list and asset detail pages**

Include:

1. 资产对象类型
2. 当前识别画像
3. 关联项目
4. 关系视图
5. 关联任务、证据、问题入口

- [ ] **Step 5: Run the test, lint, and build**

Run: `npx vitest run tests/pages/approvals-assets-page.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 6: Commit approvals and assets**

```bash
git add app/(console)/approvals app/(console)/assets components/approvals components/assets tests/pages/approvals-assets-page.test.tsx lib/prototype-data.ts
git commit -m "feat: add approvals and assets pages"
```

## Task 8: Implement `/evidence`, `/evidence/[evidenceId]`, and `/settings`

**Files:**
- Create: `app/(console)/evidence/page.tsx`
- Create: `app/(console)/evidence/[evidenceId]/page.tsx`
- Create: `app/(console)/settings/page.tsx`
- Create: `components/evidence/evidence-table.tsx`
- Create: `components/evidence/evidence-detail.tsx`
- Create: `components/settings/mcp-tool-table.tsx`
- Create: `components/settings/system-control-panel.tsx`
- Create: `tests/pages/evidence-settings-page.test.tsx`
- Modify: `lib/prototype-data.ts`

- [ ] **Step 1: Add a failing evidence/settings test**

```tsx
expect(screen.getByText("证据与结果")).toBeInTheDocument()
expect(screen.getByText("原始输出")).toBeInTheDocument()
expect(screen.getByText("MCP 工具管理")).toBeInTheDocument()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/pages/evidence-settings-page.test.tsx`  
Expected: FAIL because the evidence and settings pages are not implemented.

- [ ] **Step 3: Implement evidence list and detail**

Required detail sections:

1. 原始输出
2. 截图
3. 结构化摘要
4. 关联任务
5. 关联审批
6. 关联资产
7. 时间线
8. 最终结论

- [ ] **Step 4: Implement settings as a control console**

Required sections:

1. 平台控制总览
2. MCP 工具管理
3. 能力分类
4. 默认并发、速率、超时、重试
5. 审批策略
6. 范围规则
7. 紧急停止

- [ ] **Step 5: Run the test, lint, and build**

Run: `npx vitest run tests/pages/evidence-settings-page.test.tsx`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 6: Commit the final prototype pages**

```bash
git add app/(console)/evidence app/(console)/settings components/evidence components/settings tests/pages/evidence-settings-page.test.tsx lib/prototype-data.ts
git commit -m "feat: add evidence and settings pages"
```

## Task 9: Final verification, documentation, and `code_index.md`

**Files:**
- Create or update: `code_index.md`
- Modify: any touched file required for final cleanup

- [ ] **Step 1: Audit the prototype routes and responsive behavior**

Manually verify:

1. `/login`
2. `/dashboard`
3. `/projects`
4. `/projects/new`
5. `/projects/[projectId]`
6. `/approvals`
7. `/assets`
8. `/assets/[assetId]`
9. `/evidence`
10. `/evidence/[evidenceId]`
11. `/settings`

- [ ] **Step 2: Run the full automated verification suite**

Run: `npx vitest run`  
Expected: PASS  
Run: `npm run lint`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: Write `code_index.md`**

Document:

1. Project root purpose
2. Route map and what each page does
3. Shared layout components
4. Domain-specific component groups
5. Mock data and type files
6. Test files and what they verify
7. How the login and dashboard templates were incorporated

- [ ] **Step 4: Perform a final git review**

Run:

```bash
git status --short
git log --oneline --decorate -5
```

Expected: only intended prototype files are modified and commits read cleanly.

- [ ] **Step 5: Commit the documentation pass**

```bash
git add code_index.md
git commit -m "docs: add code index for frontend prototype"
```
