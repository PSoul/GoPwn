# GoPwn Landing Page Design Spec

> gopwn.ai 官网首页设计规格

## Page Goal

吸引安全研究员和开发者了解 GoPwn，主要转化路径是 GitHub Star 和 Quick Start。

**目标受众：** 安全研究员、红队工程师、渗透测试工程师、DevSecOps 工程师

**核心 CTA：** Star on GitHub + Quick Start

## Page Structure

```
┌─────────────────────────────────────┐
│           Navigation Bar            │
├─────────────────────────────────────┤
│              Hero                   │
├─────────────────────────────────────┤
│          What is GoPwn?             │
├─────────────────────────────────────┤
│            Features                 │
├─────────────────────────────────────┤
│          Architecture               │
├─────────────────────────────────────┤
│          Quick Start                │
├─────────────────────────────────────┤
│            Footer                   │
└─────────────────────────────────────┘
```

## Section Details

### 1. Navigation Bar

固定顶部，简洁透明。

| 元素 | 内容 |
|------|------|
| 左侧 | GoPwn Logo + 文字 |
| 中部 | Features / Architecture / Quick Start（锚点跳转） |
| 右侧 | GitHub Star 按钮（显示实时 star 数） + "Get Started" 按钮 |

### 2. Hero Section

首屏，传达核心价值。

```
[GoPwn Logo]

The Next Generation of
Penetration Testing.

AI Agent 驱动的自动化渗透测试平台。
LLM 规划，MCP 执行，全流程自动编排。

[★ Star on GitHub]  [Quick Start →]
```

**设计要点：**
- 标题大字，tagline 次之，两个 CTA 按钮并排
- 下方可选：一张平台 dashboard 的截图或动画（暗色主题）
- 简洁，不需要装饰性元素

### 3. What is GoPwn?

一段话 + 核心概念图。

**文案：**

> GoPwn 是一个开源的 AI Agent 驱动渗透测试平台。它用 LLM（大语言模型）作为大脑进行推理和规划，用 MCP 工具作为四肢执行真实探测，平台作为中枢负责调度和审计。从信息收集到漏洞验证，全流程自动编排，无需人工逐步操作。

**核心概念（三列布局）：**

| LLM = 大脑 | Platform = 中枢 | MCP = 四肢 |
|------------|-----------------|------------|
| ReAct 迭代推理 | 调度、审批、持久化 | 14 个工具服务器 |
| 工具选择与规划 | 状态机驱动生命周期 | 36+ 安全工具 |
| 结果审阅与分析 | 审计链路 | 真实探测与证据采集 |

### 4. Features Section

核心能力展示，4-6 个 feature 卡片。

**Feature 1: ReAct 自主编排**
> LLM 通过 ReAct 模式逐步推理，自主选择工具、分析结果、决定下一步。不是固定流水线，而是动态适应目标的智能编排。

**Feature 2: 36+ MCP 安全工具**
> 14 个 MCP Server 覆盖 DNS 侦察、Web 探测、端口扫描、漏洞验证、截图取证等完整攻击面。基于 MCP 协议，可扩展接入任意工具。

**Feature 3: 多轮迭代执行**
> 不是跑一次就结束。每轮 LLM 审阅结果后决定是否需要更深入的探测，自动推进下一轮，直到充分覆盖攻击面。

**Feature 4: 实时可视化**
> 每一步 LLM 推理和工具执行都实时展示。SSE 流式推送，可以看到 AI 在"想什么"和"做什么"。

**Feature 5: 审批与审计**
> 高风险操作自动暂停等待人工审批。所有操作留有完整审计记录，满足合规要求。

**Feature 6: Docker 靶场开箱即用**
> 内置 13 个 Docker 靶场环境（DVWA、Juice Shop、WebGoat、Redis、SSH 等），`docker compose up` 即可开始练习。

### 5. Architecture Section

一张架构图 + 简要说明。

**架构图内容（文字描述，后续制作为图片/SVG）：**

```
┌─────────┐    规划/审阅    ┌──────────────┐    调度/执行    ┌─────────────┐
│   LLM   │ ◄────────────► │   Platform   │ ◄────────────► │  MCP Tools  │
│  (大脑)  │   ReAct Loop   │    (中枢)     │   MCP stdio    │   (四肢)     │
└─────────┘                └──────────────┘                └─────────────┘
                                  │
                           ┌──────┴──────┐
                           │  PostgreSQL  │
                           │  (持久化)    │
                           └─────────────┘
```

**说明文案：**
> GoPwn 采用 ReAct（Reason + Act）执行引擎。每一轮次内，LLM 逐步推理并选取 MCP 工具执行真实探测，获取结果后继续推理，直到完成本轮目标。轮次间由 LLM 审阅决定是否继续深入。

### 6. Quick Start Section

3 步启动，代码块展示。

```bash
# 1. Clone & Install
git clone https://github.com/PSoul/LLMPentest.git
cd LLMPentest && npm install

# 2. Start Services
cd docker/postgres && docker compose up -d
npx prisma migrate dev

# 3. Launch
npm run dev
# Open http://localhost:3000
```

**补充：** 下方显示默认账号信息和 LLM 配置提示。

### 7. Footer

```
GoPwn — The Next Generation of Penetration Testing.

GitHub | Documentation | License (MIT)

© 2026 GoPwn Contributors
```

## Responsive Design

- **Desktop (>1024px):** 全宽布局，feature 卡片 3 列
- **Tablet (768-1024px):** feature 卡片 2 列
- **Mobile (<768px):** 单列，Hero 文案居中，CTA 按钮竖排

## Technical Notes

- 官网可以是独立仓库，也可以放在 `docs/` 目录用 GitHub Pages 部署
- 推荐技术栈：静态站（Next.js static export 或 Astro）
- 暗色主题优先（安全工具用户偏好）
- GitHub Star 数通过 GitHub API 实时获取
