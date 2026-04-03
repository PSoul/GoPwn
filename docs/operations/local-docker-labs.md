# 本地 Docker 靶场

## 目标

本地靶场环境为平台提供一组可重复启动的漏洞目标，服务于以下场景：

- 验证 `LLM 规划 → MCP 调度 → 审批阻塞 → 审批恢复 → 结果沉淀` 完整链路
- 给前后端联调提供稳定、低成本、可重复的目标环境
- 多轮自动渗透测试的回归验证

## 当前靶场清单

### HTTP 靶场

| 靶场 | 入口 | 镜像 | 漏洞类型 |
|------|------|------|----------|
| DVWA | `http://127.0.0.1:8081` | `vulnerables/web-dvwa` | SQL注入、XSS、命令注入、文件上传 |
| Juice Shop | `http://127.0.0.1:3000` | `bkimminich/juice-shop` | OWASP Top 10 |
| WebGoat | `http://127.0.0.1:18080/WebGoat` | `webgoat/webgoat` | 教学型 Web 漏洞 |
| WordPress | `http://127.0.0.1:8082` | `wordpress:6.4-apache` | CMS 弱口令、插件漏洞 |
| phpMyAdmin | `http://127.0.0.1:8083` | `phpmyadmin/phpmyadmin` | 管理面板暴露 |
| Tomcat | `http://127.0.0.1:8888` | 自定义 (弱管理员) | 管理面板弱口令 |

### TCP 服务靶场

| 靶场 | 端口 | 镜像 | 漏洞类型 |
|------|------|------|----------|
| Redis 无认证 | `127.0.0.1:6379` | `redis:7-alpine` | 未授权访问 |
| SSH 弱口令 | `127.0.0.1:2222` | `panubo/sshd` | root/root 弱口令 |
| MySQL 弱口令 | `127.0.0.1:13307` | `mysql:5.7` | root/123456 弱口令 |
| MongoDB 无认证 | `127.0.0.1:27017` | `mongo:6` | 未授权访问 |
| Elasticsearch 无认证 | `127.0.0.1:9200` | `elasticsearch:7.17.18` | 集群信息泄露 |

## 启动

在项目根目录执行：

```bash
docker compose -f docker/local-labs/compose.yaml up -d
```

查看状态：

```bash
docker compose -f docker/local-labs/compose.yaml ps
```

停止并清理容器：

```bash
docker compose -f docker/local-labs/compose.yaml down
```

## 主机侧连通性检查

```bash
# HTTP 靶场
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081   # DVWA
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000   # Juice Shop
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8082   # WordPress
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9200   # Elasticsearch

# TCP 服务
redis-cli -h 127.0.0.1 -p 6379 ping       # Redis
nc -zv 127.0.0.1 2222                       # SSH
nc -zv 127.0.0.1 13307                      # MySQL
nc -zv 127.0.0.1 27017                      # MongoDB
```

## 在平台中的使用方式

### 方式一：通过项目创建（推荐）

1. 登录平台 `http://127.0.0.1:3001`（账号 `admin@company.local`）
2. 创建新项目，`targetInput` 填写靶场入口地址（如 `http://127.0.0.1:8081`）
3. 在项目页面启动调度（scheduler lifecycle → running）
4. LLM 自动生成计划，MCP 工具自动执行
5. 需要审批的高风险操作会暂停等待人工确认

### 方式二：通过 API 自动化

```bash
# 登录
curl -c cookies.txt -X POST http://127.0.0.1:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin@company.local","password":"Prototype@2026"}'

# 创建项目
curl -b cookies.txt -H "x-csrf-token: $(grep csrf cookies.txt | awk '{print $NF}')" \
  -X POST http://127.0.0.1:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"DVWA Test","targetInput":"http://127.0.0.1:8081"}'

# 启动调度
curl -b cookies.txt -H "x-csrf-token: ..." \
  -X PATCH http://127.0.0.1:3001/api/projects/{id}/scheduler-control \
  -H "Content-Type: application/json" \
  -d '{"lifecycle":"running"}'
```

### 方式三：通过操作面板本地闭环

1. 进入 `/projects/:projectId/operations`
2. 在"LLM 编排与本地闭环"里选择靶场
3. 先点"生成计划"，确认计划项
4. 再点"执行本地闭环"

## E2E 测试验证结果

DVWA 靶场多轮自动测试已验证通过：

- 12 轮自动规划与执行
- 21 个资产发现
- 55 条证据采集
- 16 个漏洞发现（1 高危、4 中危、4 低危、7 信息）
- LLM 自主进行 SQL 注入、XSS、认证绕过、路径穿越等测试
- 完全通用化 prompt，无任何靶场特定代码

## 注意事项

- 不要把真实 API Key 写进仓库。真实 LLM 只通过环境变量或设置页面配置。
- Next.js 开发服务器使用端口 3001（3000 被 Juice Shop 占用）。
- 推理模型（如 qwen3.6-plus）建议 `timeoutMs` 设为 300000（5 分钟）。
- 当前 compose 主要服务本地验证，不承担生产级隔离或团队共享环境职责。
- 靶场配置信息见 `docker/local-labs/compose.yaml`，靶场目录由 `lib/infra/local-lab-catalog.ts` 维护。
