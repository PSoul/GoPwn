# GoPwn Brand Guidelines

## Brand Story

**GoPwn** — "Go Pwn. 出发，攻破。"

GoPwn 是一个 AI Agent 驱动的下一代渗透测试平台。名字是一个祈使句：Go（出发）+ Pwn（攻破），像在命令行里输入一条指令一样直接。

LLM 是大脑，负责推理、规划、审阅；MCP 工具是四肢，负责真实探测和证据采集；平台是中枢，负责调度、审批、持久化。三者协作，实现从信息收集到漏洞验证的全流程自动化渗透测试。

**品牌定位：混合路线**
- 外层（官网、README、对外展示）：专业可信，面向企业安全团队和开源社区
- 内层（平台 UI、技术文档、社区交流）：保留黑客文化基因，直接高效

**叙事锚点：**
- Metasploit 定义了 exploit 框架 → GoPwn 定义 AI 驱动的自动化渗透
- 手动渗透测试 → AI Agent 自主渗透测试
- 单工具扫描 → 多轮 ReAct 迭代编排

## Naming Convention

| 场景 | 写法 | 示例 |
|------|------|------|
| 品牌名（正式场合） | **GoPwn** | "GoPwn is an AI-driven pentesting platform." |
| 代码/CLI/包名 | **gopwn** | `npm install gopwn`, `gopwn.ai` |
| 标题/大写环境 | **GOPWN** | Logo、Banner |
| 中文语境 | **GoPwn** | "GoPwn 渗透测试平台" |

**禁止写法：** GoPWN, Go-Pwn, Go Pwn（分开写）, goPwn

## Tagline

**主 tagline:**
> The Next Generation of Penetration Testing.

**备选/场景化 tagline:**
- "Go Pwn. AI Does the Rest." — 强调自动化
- "AI Agent-Driven Penetration Testing." — 强调技术定位
- "从规划到验证，全程 AI 编排。" — 中文场景

## Voice & Tone

### 外层（官网、README、商务场合）
- **专业简洁**：不卖弄术语，但假设读者有安全基础
- **自信但不夸张**：用事实说话（"14 个 MCP 工具"而非"海量工具"）
- **动作导向**：CTA 用祈使句（"Star on GitHub"、"Get Started"）

### 内层（平台 UI、社区、技术文档）
- **直接高效**：像同事间对话，不需要客套
- **允许黑客俚语**：pwn、exploit、recon、0day 等安全社区通用词
- **中英混用**：技术术语保持英文，说明文字用中文

### 避免
- 过度营销话术（"革命性"、"颠覆性"、"业界领先"）
- 贬低其他工具（不说"比 X 更好"，说"GoPwn 的不同之处在于"）
- 虚假承诺（不说"发现所有漏洞"，说"自动化覆盖常见攻击面"）

## Logo

> Logo 设计待完成。以下为规范框架。

**设计方向：**
- 简洁几何图形，适合缩放到 favicon (16x16)
- 与 "Go" 或 "攻破" 的动作感相关
- 适配亮色/暗色背景双版本

**使用规范：**
- 最小尺寸：16x16px
- 安全区域：logo 四周留至少 logo 高度 50% 的空白
- 不可拉伸、旋转、加阴影、改颜色

## Color Palette

> 具体色值待用户确认。以下为方向指引。

- 主色：待定（当前使用 sky-500 #0ea5e9 作为临时主色）
- 暗色主题：深色背景 + 主色作为强调色
- 亮色主题：白色背景 + 主色作为交互元素色

## Domain

- **主域名：** gopwn.ai
- **可用后缀：** .ai, .io, .dev, .app, .sh, .run, .cc, .so, .one（9/10，.com 不可用）
- **推荐注册：** gopwn.ai（主站）、gopwn.dev（文档/开发者）

## Legal

- GoPwn 不包含任何注册商标（GPT、Cobalt 等）
- "pwn" 是安全社区通用词汇，无商标风险
- GitHub 上 gopwn 有一个 28 星的 Go CTF 框架（定位完全不同，可共存）
