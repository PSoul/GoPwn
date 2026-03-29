# Phase 14: UI 体验优化与性能调优

## 背景

本项目是授权外网安全评估平台（漏洞扫描驾驶舱），基于 Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui。
截至 Phase 13，核心功能已完成：LLM 多轮自动编排、MCP 工具执行、SSE 实时日志、认证加固。

## 本阶段目标

使平台达到内部首个可用版本的发布标准。

## 任务清单

### 1. 首屏性能优化
- 分析 Next.js dev server 首次编译耗时（当前 >60s），找出瓶颈
- 考虑按需编译策略，减少初始 module 数量
- 检查是否有不必要的大依赖被打包到首屏

### 2. 错误边界与空状态
- 为每个页面添加有意义的空状态提示（不只是"无数据"）
- 确保 `error.tsx` 和 `loading.tsx` 在所有路由组中存在且样式一致
- API 调用失败时显示友好提示而非空白

### 3. E2E 测试完善
- 修复 vuln-cockpit.spec.ts 剩余 2 个测试（漏洞中心数据加载 + AI 聊天窗口）
- 添加更多覆盖：审批流程、资产中心、设置页面
- 确保所有 14 个 E2E 测试在 CI 环境稳定通过

### 4. UI 微调
- 检查深色模式下的对比度和可读性
- 检查移动端响应式布局
- 统一所有页面的 loading 骨架屏样式

### 5. 安全审计
- 检查所有 API 端点是否有未保护的路由
- 确认 `PROTOTYPE_SESSION_SECRET` 在生产环境必须设置（不允许默认值）
- 检查是否有敏感信息泄露（错误消息、堆栈跟踪）

## 关键文件

- 先读 `code_index.md` 了解代码结构
- 再读 `roadmap.md` 了解项目进度
- E2E 测试：`e2e/prototype-smoke.spec.ts` 和 `e2e/vuln-cockpit.spec.ts`
- 认证：`lib/auth-repository.ts`、`lib/auth-session.ts`、`lib/csrf.ts`、`middleware.ts`
- SSE 流：`app/api/llm-logs/stream/route.ts`、`lib/llm-call-logger.ts`

## 开发要求

1. 开发前新建分支
2. 完成后更新 `code_index.md` 和 `roadmap.md`
3. 进行完整的 E2E 测试
4. `.txt` 文件已在 `.gitignore` 中忽略

## 技术栈

- Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Prisma (SQLite) + 文件系统存储 (prototype-store)
- Playwright (E2E) + Vitest (单元测试)
- LLM: SiliconFlow DeepSeek-V3.2 (OpenAI-compatible)
- MCP: 12 个本地 stdio 服务器 (mcps/ 目录)
