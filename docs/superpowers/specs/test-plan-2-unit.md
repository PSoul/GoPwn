# Plan 2: 单元测试

> 前置: Plan 1 (helpers, vitest 配置)
> 产出: domain + LLM 模块 + worker 增强，约 75 个用例
> 验证: `npm run test:unit` 全绿

## Step 1: Domain — lifecycle.test.ts

文件: `tests/unit/domain/lifecycle.test.ts`
源文件: `lib/domain/lifecycle.ts`

用例清单:
- 合法转换: idle→planning (START_REACT), planning→executing (PLAN_DONE), executing→reviewing (ROUND_DONE), reviewing→executing (CONTINUE), reviewing→settling (SETTLE), settling→completed (SETTLE_DONE), executing→waiting_approval (REQUEST_APPROVAL), waiting_approval→executing (RESOLVED), *→stopping (STOP), stopping→stopped (STOPPED), *→failed (FAIL)
- 非法转换: idle + ROUND_DONE, stopped + START_REACT, completed + START_REACT 等（取 5-6 个代表性组合）
- isTerminal(): stopped=true, completed=true, failed=true, executing=false, idle=false
- isActive(): executing=true, planning=true, reviewing=true, idle=false, stopped=false
- RETRY_REACT: failed→planning

Mock: 无（纯逻辑）

## Step 2: Domain — errors.test.ts + phases.test.ts + scope-policy.test.ts

**errors.test.ts** (`tests/unit/domain/errors.test.ts`):
- NotFoundError("Project", "abc") → message 含 "Project" 和 "abc", statusCode=404
- DomainError("msg", "CODE", 409) → statusCode=409, code="CODE"
- DomainError 默认 statusCode=400

**phases.test.ts** (`tests/unit/domain/phases.test.ts`):
- 读取 `lib/domain/phases.ts`，测试阶段列表和标签映射
- 阶段顺序: recon → discovery → assessment → verification → reporting

**scope-policy.test.ts** (`tests/unit/domain/scope-policy.test.ts`):
- 读取 `lib/domain/scope-policy.ts`，测试 normalizeTarget (在 project-service.ts 中) 或相关作用域判定函数
- 注意: normalizeTarget 是 project-service.ts 的内部函数，如果不导出则跳过此文件，在 service 集成测试中覆盖

## Step 3: LLM — call-logger.test.ts

文件: `tests/unit/llm/call-logger.test.ts`
源文件: `lib/llm/call-logger.ts`

Mock:
- `@/lib/repositories/llm-log-repo` → create/complete/fail 全部 mock
- `@/lib/infra/event-bus` → publishEvent mock
- 提供真实 LlmProvider mock（使用 factories.ts 的 mockLlmProvider）

用例:
1. 正常调用 → llmLogRepo.create 被调用 1 次，complete 被调用 1 次
2. 正常调用 → complete 收到 response.model 参数
3. provider.chat 抛错 → llmLogRepo.fail 被调用，原始错误被 rethrow
4. response 超长(>100k) → complete 收到截断后的 response
5. response 含 functionCall → logged response 包含 "[Function Call]" 摘要
6. publishEvent 失败 → 不影响主流程（.catch 吞掉）

## Step 4: LLM — function-calling.test.ts + tool-input-mapper.test.ts

**function-calling.test.ts** (`tests/unit/llm/function-calling.test.ts`):
源文件: `lib/llm/function-calling.ts`
- 先读源文件确认导出函数签名
- MCP 工具列表 → 转换为 OpenAI function definitions（name, description, parameters）
- 空工具列表 → 返回空数组
- 工具含 inputSchema → 正确映射为 parameters

**tool-input-mapper.test.ts** (`tests/unit/llm/tool-input-mapper.test.ts`):
源文件: `lib/llm/tool-input-mapper.ts`
- 先读源文件确认导出函数签名
- 正常映射: LLM args → MCP tool input
- 缺少参数 → 对应行为（抛错或默认值）
- 多余参数 → 忽略或透传

## Step 5: Worker — react-worker.test.ts (新增)

文件: `tests/unit/workers/react-worker.test.ts`
源文件: `lib/workers/react-worker.ts`

Mock（参考现有 lifecycle-worker.test.ts 的 mock 模式）:
- `@/lib/repositories/*` — 全部 mock
- `@/lib/infra/*` — 全部 mock
- `@/lib/llm` — getLlmProvider mock，返回可控 LLM
- `@/lib/mcp` — callTool mock

用例:
1. 正常 ReAct round: LLM 返回 function_call → callTool 执行 → 结果反馈 → LLM 返回 final answer → round 完成
2. LLM 返回非法 JSON → 不崩溃，记录错误，继续或终止
3. callTool 抛错 → 错误作为 observation 反馈给 LLM
4. abort signal 触发 → 循环终止，round 标记 aborted
5. 项目 lifecycle 非 active → 跳过执行
6. 达到 maxSteps → 循环终止，stopReason="max_steps"
7. LLM 多次 function_call 后返回文本 → 循环正常结束

## Step 6: Worker — 增强现有测试

**verification-worker.test.ts** 新增用例:
- PoC callTool 超时 (>120s) → 状态回退 suspected，错误消息含 "timeout"
- finding 状态为 "verifying"（上次崩溃遗留） → 允许重新验证
- 项目 lifecycle 为 "stopping" → 跳过验证

**analysis-worker.test.ts** 新增用例:
- LLM 返回重复 finding title → 去重逻辑生效（检查 findingRepo.create 调用次数）
- LLM 返回非法 severity "unknown" → 处理方式（降级或忽略）

**lifecycle-worker.test.ts** 新增用例:
- handleRoundCompleted: round === maxRounds 且 reviewer 说 continue → 仍然强制 settle
- handleSettleClosure: 项目已 stopped → 跳过结算

## Step 7: 验证

```bash
npm run test:unit
```

所有用例通过。运行 `npx tsc --noEmit` 确认类型正确。
