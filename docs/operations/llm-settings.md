# LLM 设置说明

## 1. 目标

`/settings/llm` 用来维护平台运行时真正使用的模型配置。

当前设计坚持两条规则：

- 配置先写入本地持久化 store
- 运行时优先读取 store，只有未配置时才回退到环境变量

这意味着你在页面里保存的参数，会直接影响编排、审阅等真实链路。

## 2. 当前角色

当前默认维护三类角色：

- `orchestrator`
  - 主编排模型
- `reviewer`
  - 结果审阅模型
- `extractor`
  - 轻量提取模型

其中当前真实运行链路主要会读取：

- `orchestrator`
- `reviewer`

## 3. 可编辑字段

页面和 API 当前支持以下字段：

- `id`
- `provider`
- `label`
- `apiKey`
- `baseUrl`
- `model`
- `timeoutMs`
- `temperature`
- `enabled`

当前为了调试方便，`apiKey` 在页面中明文显示。后续可再切换成掩码模式。

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
  "label": "SiliconFlow Orchestrator",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.siliconflow.cn/",
  "model": "Pro/deepseek-ai/DeepSeek-V3.2",
  "timeoutMs": 300000,
  "temperature": 0.15,
  "enabled": true
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

1. 先读 `prototype-store.json` 中已启用的 `orchestrator` 配置
2. 如 `reviewer` 也已启用，则单独读取；否则回退复用 `orchestrator`
3. 只有 store 中没有可用配置时，才回退读取环境变量：
   - `LLM_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_ORCHESTRATOR_MODEL`
   - `LLM_REVIEWER_MODEL`
   - `LLM_TIMEOUT_MS`

## 6. 调试建议

- 真流联调时，优先在 `/settings/llm` 里保存一套明确配置
- 如果模型端点响应较慢，建议把 `timeoutMs` 调高到 `300000`
- 如果只是临时脚本验证，也可以继续使用环境变量模式

## 7. 相关代码

- `app/api/settings/llm/route.ts`
- `components/settings/llm-settings-panel.tsx`
- `lib/llm-settings-repository.ts`
- `lib/llm-settings-write-schema.ts`
- `lib/llm-provider/registry.ts`
- `lib/llm-provider/openai-compatible-provider.ts`
