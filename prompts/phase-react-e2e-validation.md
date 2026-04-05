# ReAct 引擎端到端验证 + 生产加固

## 背景

feature/react-iterative-execution 分支已完成 ReAct（Reason+Act）迭代执行引擎的核心实现，替代了原有的批量"计划→执行→审阅"三阶段模型。当前需要通过 Docker 靶场进行端到端验证，并修复发现的问题。

### 核心变更

- **ReAct 循环**: LLM 在每轮内通过 OpenAI Function Calling 逐步选取 MCP 工具，每步获取真实结果后再决定下一步
- **新 Worker**: `react-worker.ts` 处理 `react_round` 作业，单轮最多 30 步
- **上下文管理**: `ReactContextManager` 滑动窗口压缩，最近 5 步全量、其余压缩摘要
- **控制函数**: `finish_round(summary, phase_suggestion)` 和 `request_approval(reason, risk_level)`
- **生命周期**: `START_REACT` / `CONTINUE_REACT` / `RETRY_REACT` 直接跳过 planning 状态
- **前端**: 操作面板按 round→step 分组展示，SSE 实时更新

## 前置条件

- 阅读 `docs/code_index.md` 了解项目结构
- 阅读 `docs/roadmap.md` 了解开发历史（重点看 ReAct 章节）
- 确保 PostgreSQL Docker 运行：`cd docker/postgres && docker compose up -d`
- 确保靶场运行：`cd docker/local-labs && docker compose up -d`
- 运行 `npx prisma migrate dev` 确保 schema 同步
- 确保 MCP Server 已配置：检查 Settings → MCP Servers 页面

## 任务清单

### 1. 端到端验证（4 个靶场）

对每个靶场创建项目并启动 ReAct 执行，验证完整流程：

1. **DVWA** (`http://localhost:8081`)
   - 验证 ReAct 循环正常：LLM 选工具 → 执行 → 回填结果 → 继续推理
   - 验证 `finish_round` 正确终止轮次
   - 验证轮次审阅后自动触发下一轮

2. **Juice Shop** (`http://localhost:3000`)
   - 验证 Web 应用渗透的工具链完整性
   - 验证作用域策略正确限制扫描范围

3. **WebGoat** (`http://localhost:8082/WebGoat`)
   - 验证无 WebGoat 特定逻辑残留（不应有硬编码路径）
   - 验证通用 HTTP 发现流程

4. **Redis 未授权** (`tcp://localhost:6379`)
   - 验证 TCP 服务的 ReAct 处理
   - 验证 banner grab → 协议识别 → 漏洞验证流程

### 2. 常见问题排查

根据之前 E2E 测试经验，重点关注：

- [ ] react-worker 超时处理（单步 5 分钟，是否足够？）
- [ ] 上下文压缩是否导致信息丢失（LLM 重复执行已完成的工具）
- [ ] `finish_round` 调用时机是否合理（LLM 是否太早/太晚终止）
- [ ] 轮次间状态传递（reviewer 是否能看到完整的 ReAct 步骤链）
- [ ] SSE 事件推送是否及时（前端是否正确反映执行状态）
- [ ] 并发安全（多轮次同时运行时的竞态条件）

### 3. 生产加固项

- [ ] react-worker 错误恢复：单步失败不应终止整轮
- [ ] Token 使用监控：记录每轮实际 token 消耗
- [ ] 步骤级超时优化：不同工具类型可能需要不同超时
- [ ] 审批集成：`request_approval` 控制函数的完整流程
- [ ] 步骤历史持久化：当前 SSE 实时推送，页面重载后无法回放

### 4. 性能调优

- [ ] `MAX_STEPS_PER_ROUND = 30` 是否合适？
- [ ] `TOKEN_BUDGET = 80000` 是否需要调整？
- [ ] `RECENT_WINDOW = 5` 压缩窗口大小
- [ ] `TOOL_TIMEOUT_MS = 300000` (5 min) 对不同工具是否合理？

### 5. 测试补充

- [ ] 为 react-worker 编写单元测试
- [ ] 为 ReactContextManager 编写压缩逻辑测试
- [ ] 为 function-calling 转换编写测试
- [ ] E2E 测试：验证 operations 页面 ReAct 展示

## 验收标准

- 4 个靶场均能完成至少 2 轮 ReAct 循环
- 每轮产出 assets 和/或 findings
- 无超时/崩溃/状态卡死
- 前端正确展示 ReAct 步骤和进度
- 全量单元测试通过
