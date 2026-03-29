# Phase 11: 前端对接与生产化闭环

## 背景

本项目是一个 LLM 为大脑、MCP 为四肢的自动化渗透测试平台。后端多轮编排管线已经过真实验证——对 DVWA 靶场成功完成了 3 轮自动渗透，LLM 智能生成计划，通过 12 个 MCP 服务器的 34 个工具执行扫描，结果自动归集为资产、证据和漏洞发现。

**当前状态：后端可用，前端需打通。**

## 仓库概况

- 技术栈：Next.js 15 App Router + React 19 + TypeScript + Vitest + Playwright
- MCP SDK：@modelcontextprotocol/sdk ^1.28.0，stdio 传输
- 存储：文件 JSON store（`.prototype-store/prototype-store.json`）+ SQLite（MCP 服务器元数据）
- 12 个 MCP 服务器在 `mcps/` 目录，通过 `mcps/mcp-servers.json` 统一配置
- 自动发现模块 `lib/mcp-auto-discovery.ts` 注册 34 个工具到平台能力体系
- 通用 stdio 连接器 `lib/mcp-connectors/stdio-mcp-connector.ts` 驱动所有外部工具
- 多轮编排引擎在 `lib/orchestrator-service.ts`，支持 autoReplan、轮次记录、6 个停止条件
- 上下文构建器 `lib/orchestrator-context-builder.ts` 实现分层 LLM 提示（资产快照、轮次压缩、未使用能力提示）

## LLM 配置

```
api_key=sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
base_url=https://api.siliconflow.cn/v1
model=Pro/deepseek-ai/DeepSeek-V3.2
```

已通过 store 迁移自动种子到 `prototype-store.json` 的 `llmProfiles.orchestrator`。

## 关键入口文件

阅读顺序：
1. `code_index.md` — 完整代码索引
2. `roadmap.md` — 阶段进度
3. `lib/orchestrator-service.ts` — 编排引擎核心
4. `lib/mcp-auto-discovery.ts` — 自动发现
5. `lib/mcp-connectors/stdio-mcp-connector.ts` — 通用连接器
6. `lib/mcp-execution-service.ts` — 结果归一化
7. `lib/orchestrator-context-builder.ts` — 多轮上下文
8. `app/api/projects/[projectId]/scheduler-control/route.ts` — 项目生命周期 API
9. `components/projects/project-scheduler-runtime-panel.tsx` — 前端运行时面板

## 任务清单

### 1. 前端编排进度实时刷新

**问题**：当前多轮编排是后端同步执行（`runProjectLifecycleKickoff` 是一个 while 循环），前端只在最终完成时刷新。用户点击"开始"后看不到中间进度。

**方案**：
- 将 `runProjectLifecycleKickoff()` 改为异步后台执行（不阻塞 API 响应）
- 前端通过轮询 `/api/projects/[id]/operations` 获取最新状态
- 每轮执行完毕后更新 store 中的 `orchestratorRounds`、`mcpRuns`、资产/证据计数
- 前端操作面板每 3-5 秒轮询一次，展示当前轮次、资产增长、MCP 执行列表

**关键文件**：
- `app/api/projects/[projectId]/scheduler-control/route.ts` — `start` 处理改为异步
- `lib/orchestrator-service.ts` — `runProjectLifecycleKickoff` 拆分为后台任务
- `components/projects/project-scheduler-runtime-panel.tsx` — 添加轮询逻辑
- `components/projects/project-orchestrator-panel.tsx` — 展示轮次详情

### 2. 编排轮次详情面板

**问题**：`orchestratorRounds` 数据已持久化，但前端没有展示每轮的详细信息。

**方案**：
- 在项目操作页面添加编排轮次表格/时间线，展示每轮的：
  - 轮次编号、执行动作数、新增资产数、新增发现数
  - 停止原因（如果是最后一轮）
  - 每轮的 MCP 运行记录
- 从 `store.orchestratorRounds[projectId]` 读取数据
- 在 operations API payload 中暴露轮次数据

**关键文件**：
- `lib/prototype-api.ts` — operations payload 添加 `orchestratorRounds`
- `app/api/projects/[projectId]/operations/route.ts` — 传递轮次数据
- 新建 `components/projects/project-rounds-panel.tsx` — 轮次详情面板

### 3. MCP 运行详情可视化

**问题**：`project-mcp-runs-panel.tsx` 目前只显示基本信息，不展示 `rawOutput` 和 `structuredContent`。

**方案**：
- 点击某条 MCP 运行记录可展开查看详情
- 显示 `rawOutput`（原始文本输出）
- 将 `structuredContent` 中的 domains/network/webEntries/findings 以结构化方式展示
- 添加复制原始输出按钮

### 4. 真实目标端到端验证

**前提**：Docker 靶场已运行（DVWA, Juice Shop, WebGoat）。

**验证步骤**：
1. 从浏览器访问平台 → 登录
2. 新建项目，目标设为 `http://localhost:8081`（DVWA）
3. 在项目操作页面点击"开始项目"
4. 观察多轮编排进度：轮次递增、资产发现、MCP 执行
5. 编排完成后查看：资产列表、证据详情、漏洞发现、最终结论
6. 导出报告

**验证真实外部目标**：
- 使用 `testphp.vulnweb.com`（Acunetix 提供的公开测试站）
- 注意：真实目标会触发 DNS、子域名枚举等更多工具

### 5. 前端交互修复清单

- [ ] 空项目列表引导：显示"新建项目开始渗透测试"引导
- [ ] 项目启动中的加载状态：点击"开始"后显示进度指示器而非空白
- [ ] 长时间运行反馈：编排超过 30 秒时显示"编排正在进行中..."提示
- [ ] 错误状态展示：MCP 工具失败时在前端清晰提示
- [ ] 最终结论美化：将 `projectConclusions` 以结构化卡片展示

### 6. Playwright E2E 增强

在 `e2e/prototype-smoke.spec.ts` 中添加：
- 新建项目流程测试
- 项目开始后状态变化验证
- 编排完成后资产/证据/发现数量非零验证
- 最终结论存在性验证
- 报告导出功能验证

### 7. 已知工具适配问题

以下工具在真实执行中存在问题，需要在 `buildToolArguments()` 或对应 MCP 服务器中修复：

- **fscan_port_scan**：返回空结果，可能是参数格式问题（需要 IP 而非 URL）
- **dirsearch_scan**：递归扫描模式下可能超时，需要限制深度
- **http_raw_request**：URL 解析在某些边界条件下失败
- **subfinder_enum**：对 localhost 目标无意义，LLM 已自动跳过，但仍需在代码层面处理

## 开发要求

1. 开发前新建分支（建议 `codex/frontend-production-loop-2026-03-29`）
2. 完成后更新 `code_index.md` 和 `roadmap.md`
3. 运行完整测试：`npx vitest run && npm run lint && npm run build && npm run e2e`
4. `.txt` 文件已在 `.gitignore` 中
5. 如有必要提供下一阶段 prompt

## Docker 靶场启动命令

```bash
cd docker/local-labs
docker compose up -d
```

包含：DVWA (8081), Juice Shop (3000), WebGoat (18080/19090) 等服务。
