# Prompt 工程设计

> 最后更新: 2026-04-02
> 核心原则：只教通用方法论，不给任何具体代码示例或靶场特定路径。LLM 必须自主思考。

---

## 设计原则

1. **不给代码就是不作弊** — Prompt 中绝不包含任何 JavaScript/Python 代码片段、特定靶场路径（如 `/vulnerabilities/sqli/`）、具体 payload 字符串（如 `' OR '1'='1`）
2. **教方法论不教答案** — 告诉 LLM "分析页面 HTML 提取表单字段"，而不是给出 `document.querySelector('input[name=user_token]')` 的代码
3. **让 LLM 自主决策** — 侦察结果 + 方法论 = LLM 自己决定写什么代码、测什么漏洞
4. **换目标不需改 prompt** — 同一套 prompt 对 DVWA、Juice Shop、真实网站都应该有效

---

## 三个 Prompt 模板

### 1. 编排器 System Prompt

**常量**: `ORCHESTRATOR_BRAIN_SYSTEM_PROMPT`  
**Temperature**: 0.2  
**用途**: 定义 LLM 的角色和行为规则

**内容结构**:
```
角色定义 → 你是编排大脑
行为约束 → 不伪造结果、不直接交互目标
8 条核心规则 → 工具约束、风险控制、输出格式
```

### 2. 编排器 User Prompt

**函数**: `buildProjectBrainPrompt(input)`  
**用途**: 每轮计划生成时动态组装

**组装顺序**:
```
1. 控制指令行（start/resume/replan）
2. 项目元数据（名称、阶段、说明）
3. 目标（原文 + 标准化列表）
4. 当前结果摘要（资产/证据/发现/待审批计数）
5. 最近上下文（8条活动记录）
6. 研究员备注
7. 可用工具列表（每行：capability, toolName, risk, boundary, approval）
8. 输出要求（数量、首轮混合策略、范围约束、TCP 服务处理）
9. 自主脚本能力说明（execute_code/execute_command）
10. 输出格式（JSON 漏洞报告格式）
11. 通用 Web 测试方法论（6步）
12. 通用非 HTTP 测试方法论（3步）
13. 关键原则（不能只侦察、必须主动测试、自主编码）
14. 运行环境（OS、Shell、Docker 状态）
```

### 3. 审阅器 Prompt

**System**: `REVIEWER_BRAIN_SYSTEM_PROMPT`  
**User**: `buildProjectReviewerPrompt(input)`  
**Temperature**: 0.1  
**用途**: 项目收尾时生成最终结论

**关键设计 — 结论客观性原则**:
- findings=0 && evidence=0 → **不能说** "安全状态良好"
- 正确结论：扫描覆盖不足，不能排除安全风险
- 只有多种工具成功执行且未发现问题 → 才能说 "未发现高危漏洞"
- 工具失败/超时/无法连接 = 覆盖不足的证据
- 已知靶场（DVWA、WebGoat 等）需明确说明是故意脆弱应用

---

## 多轮续跑的 Prompt 增强

第 2 轮起，User Prompt 额外包含：

| 上下文 | 内容 |
|--------|------|
| `roundHistory` | 前 N 轮摘要（执行了什么、成功/失败数） |
| `assetSnapshot` | 当前资产按类型分组 |
| `lastRoundDetail` | 上轮的具体执行结果 |
| `unusedCapabilities` | 还没用过的工具列表 |
| `failedToolsSummary` | 失败工具名 + 失败原因 |

---

## LLM 输出 JSON Schema

```typescript
{
  summary: string,        // 本轮计划摘要
  items: Array<{
    capability: string,   // 必须匹配已注册工具 capability
    requestedAction: string, // 具体到 MCP 能做的事
    target: string,       // 单一可执行目标值
    riskLevel: "低"|"中"|"高",
    rationale: string,    // 为什么现在做
    toolName: string,     // 选择的工具名
    code?: string         // execute_code 专用：完整 Node.js 脚本
  }>
}
```

---

## 通用方法论（Prompt 中的核心教学内容）

### Web 应用测试

1. 先侦察再行动（httpx/dirsearch 了解技术栈和入口点）
2. 分析页面结构（GET HTML，解析表单字段含隐藏的 CSRF token）
3. 处理认证（GET 登录页 → 提取字段 → POST → 保存 session cookie）
4. 逐入口点测试（URL 参数、表单字段、HTTP Header）
5. 覆盖常见漏洞（SQLi、XSS、命令注入、路径穿越、认证绕过、信息泄露）
6. 处理防护机制（编码绕过、变形 payload）

### 非 HTTP 服务测试

1. TCP banner grab 确认服务类型
2. 根据协议自主编写客户端代码
3. 弱口令、默认配置、未授权访问检测

---

## 已知局限

- 模型能力差异显著：Claude/GPT-4 生成的 execute_code 脚本质量远高于小模型
- DeepSeek V3.2 在 CSRF token 处理上的自主能力有限
- 第 2 轮 LLM 有时返回空计划（可能因上下文不足或模型过于保守）
- 优化方向：增强多轮 context 传递、使用更大模型、或增加专用工具减少对 execute_code 的依赖
