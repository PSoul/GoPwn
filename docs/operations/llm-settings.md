# LLM 设置说明

## 1. 目标

`/settings/llm` 用来维护平台运行时真正使用的模型配置。

当前设计坚持两条规则：

- 配置先写入 PostgreSQL 数据库（Prisma ORM）
- 运行时优先读取数据库配置，只有未配置时才回退到环境变量

这意味着你在页面里保存的参数，会直接影响编排、审阅、分析等真实链路。

## 2. 当前角色

当前默认维护三类角色：

- `orchestrator`
  - 主编排模型，负责生成每轮计划
- `reviewer`
  - 结果审阅模型，负责项目收尾时的最终结论
- `analyzer`
  - 工具输出分析模型，负责 MCP 运行后的结果解析

其中当前真实运行链路主要会读取：

- `orchestrator`（必选）
- `reviewer`（可选，未配置时回退到 orchestrator）
- `analyzer`（可选，未配置时回退到 orchestrator）

## 3. 可编辑字段

页面和 API 当前支持以下字段：

- `id` — 角色标识（orchestrator / reviewer / analyzer）
- `provider` — 提供商类型（当前仅 `openai-compatible`）
- `label` — 显示名称
- `apiKey` — API 密钥
- `baseUrl` — API 基础 URL
- `model` — 模型名称
- `timeoutMs` — 请求超时（毫秒，范围 1000-600000）
- `temperature` — 温度（0-2）
- `enabled` — 是否启用
- `contextWindowSize` — 上下文窗口大小（4096-2000000，默认 65536）

> 推理模型（如 qwen3.6-plus、DeepSeek-R1）建议 `timeoutMs` 设为 300000（5 分钟），因为推理过程耗时较长。

## 4. API 合同

### `GET /api/settings/llm`

返回：

```json
{
  "profiles": []
}
```

### `PATCH /api/settings/llm`

请求体：

```json
{
  "id": "orchestrator",
  "provider": "openai-compatible",
  "label": "DashScope qwen3.6-plus",
  "apiKey": "sk-xxx",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen3.6-plus",
  "timeoutMs": 300000,
  "temperature": 0.2,
  "enabled": true,
  "contextWindowSize": 65536
}
```

成功返回：

```json
{
  "profile": {},
  "profiles": []
}
```

失败时：

- `400`：字段不合法
- `404`：指定的 profile 不存在

## 5. 运行时解析顺序

运行时 provider 解析顺序如下：

1. 先读 PostgreSQL 数据库中已启用的 `orchestrator` 配置
2. 如 `reviewer` / `analyzer` 也已启用，则单独读取；否则回退复用 `orchestrator`
3. 只有数据库中没有可用配置时，才回退读取环境变量：
   - `LLM_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_ORCHESTRATOR_MODEL`
   - `LLM_REVIEWER_MODEL`
   - `LLM_ANALYZER_MODEL`
   - `LLM_TIMEOUT_MS`

## 6. response_format 兼容性

平台默认使用 `response_format: { type: "json_object" }` 请求 JSON 输出。但部分 provider（如 DeepSeek）不支持该参数，返回 HTTP 400。

平台已内置自动降级机制：收到 400 后会移除 `response_format` 并在 system prompt 中追加 JSON 输出指令重试。无需额外配置。

## 7. 调试建议

- 真流联调时，优先在 `/settings/llm` 里保存一套明确配置
- 推理模型建议 `timeoutMs` 设为 `300000`（5 分钟）
- 如果只是临时脚本验证，也可以继续使用环境变量模式
- 首次联调建议先在 "AI 日志" 标签页检查 LLM 调用是否成功

## 8. 已验证的模型

| Provider | 模型 | 状态 | 备注 |
|----------|------|------|------|
| 阿里云 DashScope | qwen3.6-plus | 已验证 | 推理模型，timeout 建议 300s |
| SiliconFlow | DeepSeek-V3.2 | 已验证 | response_format 不兼容，已自动降级 |

## 9. 相关代码

- `app/api/settings/llm/route.ts`
- `components/settings/llm-settings-panel.tsx`
- `lib/llm/llm-settings-repository.ts`
- `lib/settings/llm-settings-write-schema.ts`
- `lib/llm-provider/registry.ts`
- `lib/llm-provider/openai-compatible-provider.ts`
