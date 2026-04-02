# MCP 工具矩阵

> 最后更新: 2026-04-02 | 14 个 MCP 服务器、36+ 工具

---

## 工具总览

| 服务器 | 工具 | 能力分类 | 风险 | 边界 | 需审批 |
|--------|------|----------|------|------|--------|
| httpx-mcp-server | httpx_probe | Web 页面探测类 | 低 | 外部目标交互 | 否 |
| httpx-mcp-server | httpx_tech_detect | Web 页面探测类 | 低 | 外部目标交互 | 否 |
| httpx-mcp-server | httpx_crawl | Web 页面探测类 | 低 | 外部目标交互 | 否 |
| dirsearch-mcp-server | dirsearch_scan | HTTP / API 结构发现类 | 低 | 外部目标交互 | 否 |
| dirsearch-mcp-server | dirsearch_deep | HTTP / API 结构发现类 | 中 | 外部目标交互 | 否 |
| subfinder-mcp-server | subfinder_enum | DNS 与子域情报类 | 低 | 外部目标交互 | 否 |
| subfinder-mcp-server | crtsh_query | DNS 与子域情报类 | 低 | 外部目标交互 | 否 |
| fscan-mcp-server | fscan_port_scan | 端口与网络探测类 | 中 | 外部目标交互 | 否 |
| fscan-mcp-server | tcp_banner_grab | 端口与网络探测类 | 低 | 外部目标交互 | 否 |
| fscan-mcp-server | fscan_vuln_scan | 端口与网络探测类 | 高 | 外部目标交互 | 是 |
| wafw00f-mcp-server | wafw00f_detect | Web 页面探测类 | 低 | 外部目标交互 | 否 |
| wafw00f-mcp-server | wafw00f_list | Web 页面探测类 | 低 | 平台内部 | 否 |
| curl-mcp-server | http_request | HTTP 请求类 | 中 | 外部目标交互 | 否 |
| curl-mcp-server | http_download | HTTP 请求类 | 中 | 外部目标交互 | 否 |
| netcat-mcp-server | nc_connect | TCP 交互类 | 中 | 外部目标交互 | 否 |
| netcat-mcp-server | nc_listen | TCP 交互类 | 高 | 外部目标交互 | 是 |
| script-mcp-server | execute_code | 脚本执行与自动化类 | 低 | 外部目标交互 | 否 |
| script-mcp-server | execute_command | 脚本执行与自动化类 | 中 | 外部目标交互 | 否 |
| script-mcp-server | read_file | 脚本执行与自动化类 | 低 | 平台内部 | 否 |
| script-mcp-server | write_file | 脚本执行与自动化类 | 高 | 平台内部 | 是 |
| afrog-mcp-server | afrog_scan | 漏洞扫描类 | 高 | 外部目标交互 | 是 |
| afrog-mcp-server | afrog_list_pocs | 漏洞扫描类 | 低 | 平台内部 | 否 |
| fofa-mcp-server | fofa_search | 情报查询类 | 低 | 外部API | 否 |
| fofa-mcp-server | fofa_stats | 情报查询类 | 低 | 外部API | 否 |
| github-recon-mcp-server | github_search_code | 情报查询类 | 低 | 外部API | 否 |
| github-recon-mcp-server | github_search_repos | 情报查询类 | 低 | 外部API | 否 |
| whois-mcp-server | whois_lookup | 情报查询类 | 低 | 外部API | 否 |
| encode-mcp-server | base64_encode/decode | 编解码工具类 | 低 | 平台内部 | 否 |
| encode-mcp-server | url_encode/decode | 编解码工具类 | 低 | 平台内部 | 否 |
| (内置) | seed-normalizer | 目标解析类 | 低 | 平台内部 | 否 |
| (内置) | report-exporter | 报告导出类 | 低 | 平台内部 | 否 |

---

## 风险等级说明

| 等级 | 说明 | 执行方式 |
|------|------|----------|
| 低 | 被动探测、信息收集、不改变目标状态 | 自动执行，并行(max=3) |
| 中 | 主动探测、可能触发目标日志 | 自动执行，并行(max=3) |
| 高 | 漏洞扫描、利用尝试、写入操作 | 需人工审批后串行执行 |

---

## 工具执行模式

### stdio 连接器（大多数工具）
```
平台 → spawn("node", ["mcps/<server>/index.mjs"]) → JSON-RPC stdin/stdout
```

### 内置连接器（seed-normalizer, report-exporter）
```
平台 → 直接调用 lib/ 内的函数
```

---

## execute_code 特殊说明

`execute_code` 是 LLM 自主漏洞验证的核心工具：

1. LLM 在计划中提供 `code` 字段（完整 Node.js 脚本）
2. 平台通过 `setLlmCodeForRun()` 存储代码
3. stdio 连接器从 `consumeLlmCodeForRun()` 取出代码
4. 通过 script-mcp-server 执行
5. stdout 输出被 `mcp-execution-service.ts` 中的 `normalizeStdioMcpArtifacts` 解析：
   - 从 `{exitCode, stdout, stderr, ...}` wrapper 中提取 stdout 字符串
   - 逐行解析 JSON `{"vulnerability":"...","severity":"...","detail":"..."}` → 自动转为 Finding
   - 即使无 findings，也会创建 Evidence 保存 rawOutput（供后续 LLM 轮次参考）
6. 如果 LLM 没有提供 code → 使用通用 fallback 探测脚本（banner grab + 协议自动检测）

---

## Docker 靶场

| 靶场 | 端口 | 协议 | 说明 |
|------|------|------|------|
| DVWA | 8081 | HTTP | PHP 漏洞靶场 |
| Juice Shop | 3000 | HTTP | 现代 Web 靶场 |
| WebGoat | 18080 | HTTP | Java 教学靶场 |
| WordPress | 8082 | HTTP | CMS 靶场 |
| Tomcat | 8888 | HTTP | Java 弱管理员 |
| phpMyAdmin | 8083 | HTTP | 数据库面板 |
| Elasticsearch | 9200 | HTTP | 未授权访问 |
| Redis | 6379 | TCP | 未授权访问 |
| SSH | 2222 | TCP | 弱口令 |
| MySQL | 13307 | TCP | 弱口令 |
| MongoDB | 27017 | TCP | 未授权访问 |
