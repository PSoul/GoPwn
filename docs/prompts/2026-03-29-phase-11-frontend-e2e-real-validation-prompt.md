# Phase 11: 前端对接与端到端真实验证

## 你是谁

你正在开发一个 LLM 为大脑、MCP 为四肢的自动化渗透测试平台。该平台使用 Next.js 15 + React 19 + TypeScript，后端为文件存储 JSON + SQLite，MCP 通过 stdio 协议通信。

## 当前状态

Phase 10 已完成以下工作：
- 12个 MCP 服务器已复制到 `mcps/` 目录（subfinder, fscan, httpx, dirsearch, curl, netcat, wafw00f, afrog, whois, fofa, github-recon, encode）
- `lib/mcp-auto-discovery.ts` 实现了自动发现与注册，包含 TOOL_REGISTRY 映射34个工具
- `lib/mcp-connectors/stdio-mcp-connector.ts` 实现了通用 stdio 连接器
- `lib/orchestrator-context-builder.ts` 实现了多轮上下文构建器
- `lib/orchestrator-service.ts` 实现了多轮自动编排循环（autoReplan + shouldContinueAutoReplan + generateMultiRoundPlan）
- 前端调度面板已添加"自动续跑"开关和轮次显示
- LLM 配置已预填 SiliconFlow DeepSeek-V3.2（在非测试环境自动种子）

## 需要你做的事

### 1. MCP 依赖安装与验证
- 进入 `mcps/` 下每个 MCP 服务器目录，运行 `npm install` 安装依赖
- 检查二进制工具路径是否正确（fscan, subfinder 等在各自服务器的 `bin/` 目录下）
- 验证每个 MCP 服务器能独立启动：`npx tsx src/index.ts`

### 2. 前端 MCP 自动发现集成
- 在项目生命周期 `start` 时（`runProjectLifecycleKickoff`），调用 `discoverAndRegisterMcpServers()` 确保所有 MCP 工具已注册
- 确保注册的工具出现在 `/settings/mcp-tools` 页面
- 确保编排计划中的 capability 能正确匹配到已注册的工具

### 3. 前端编排进度实时化
- 多轮编排运行时，前端调度面板应显示：
  - 当前轮次 / 最大轮次
  - 每轮新增的资产/发现数量
  - 停止原因（如果已停止）
  - 正在执行的 MCP 工具名称和目标
- 考虑使用 SSE 或轮询实现进度更新

### 4. 端到端真实目标验证
- 使用真实测试目标（如 `testphp.vulnweb.com`）走完整流程：
  1. 登录平台
  2. 新建项目，填入目标
  3. 点击"开始项目"
  4. 观察 LLM 生成计划
  5. 观察 MCP 工具执行（subfinder → httpx → dirsearch 等）
  6. 多轮自动续跑直到结果充分
  7. 查看最终结论
- 记录遇到的问题并修复

### 5. 前端 UI 修复
- 使用 Playwright 截图浏览每个页面，发现并修复：
  - 空状态引导（新平台首次使用时应有明确指引）
  - 加载状态（编排/执行中应有明确的进度提示）
  - 错误处理（MCP 执行失败时应有可读的错误信息）
  - 结果展示（资产/发现/证据应该能正确显示 MCP 返回的真实数据）

### 6. E2E 测试
- 在 `e2e/` 中添加覆盖核心路径的 Playwright 测试：
  - 新建项目 → 设置目标 → 开始 → 等待第一轮完成 → 检查资产/发现
  - LLM 设置页面：验证预填配置可见且可修改
  - MCP 工具页面：验证自动发现的工具可见

## 关键文件

- `lib/mcp-auto-discovery.ts` - MCP 自动发现
- `lib/mcp-connectors/stdio-mcp-connector.ts` - 通用 stdio 连接器
- `lib/mcp-connectors/registry.ts` - 连接器优先级链
- `lib/orchestrator-service.ts` - 编排服务（多轮循环）
- `lib/orchestrator-context-builder.ts` - 上下文构建器
- `lib/prototype-store.ts` - 数据存储（含 LLM 配置种子）
- `lib/project-scheduler-lifecycle.ts` - 生命周期状态机
- `components/projects/project-scheduler-runtime-panel.tsx` - 调度面板
- `mcps/mcp-servers.json` - MCP 服务器配置

## LLM 调试配置

```
api_key=sk-pryesvbybgrplivmlsrfsbluaoyctebqchsqjjfhbnjtkedc
base_url=https://api.siliconflow.cn/
model=Pro/deepseek-ai/DeepSeek-V3.2
```

## 注意事项

1. 开发前先新建分支
2. 完成后更新 `code_index.md` 和 `roadmap.md`
3. 运行完整测试 `npx vitest run` + `npm run e2e`
4. 在 git 中忽略 `.txt` 后缀文件
5. 如有必要提供下一阶段 prompt
