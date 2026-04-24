# CodeInsight 项目总结

本项目是一个“智能代码理解与自动化开发辅助系统”原型，围绕“代码仓库解析 → 依赖图谱构建 → 可视化交互 → 任务调度 → 智能问答”形成可运行闭环。

## 1. 当前形态与技术栈

### 前端（Web）
- React 18 + TypeScript + Vite
- 路由：react-router-dom
- 依赖图可视化：react-force-graph-2d
- UI：TailwindCSS + lucide-react

### Node API（本地服务）
- Express + dotenv + cors
- Supabase（Postgres）作为持久化存储与任务表

### Python 服务（可选能力）
- Flask + python-dotenv + requests
- DashScope（通义千问）兼容 OpenAI 的 chat/completions 调用，用于代码问答
- 内置 Python AST 解析接口（示例）

### Java 服务（可选能力/未来扩展）
- Spring Boot + JavaParser + Kafka（任务调度框架已接入）

## 2. 系统架构与数据流

### 2.1 代码解析与依赖图谱（已闭环）
1) 前端导入项目（可填本地路径）  
2) Node API 写入 `projects` 与 `tasks(parse)`  
3) Node API 异步执行解析，生成 `{ nodes, links }` 形式的图数据  
4) 写入 `parse_results.dependencies`，并更新任务/项目状态  
5) 前端依赖图页面读取 `/api/projects/:id/dependencies` 渲染交互式图谱

### 2.2 任务中心（已闭环）
- Node API 提供任务列表与详情接口
- 前端“任务中心”页面支持搜索、筛选、刷新、查看任务 config/result

### 2.3 智能问答（已可用）
- Python 服务 `/api/qa` 接入 DashScope（通义千问）对话接口
- 当前实现以“项目ID + 问题 + 可选上下文”作为输入，返回回答文本

## 3. 关键能力清单（截至目前）

### 3.1 多语言 AST / 语义解析（核心）
- TS/JS：TypeScript AST 提取 `import/export/require/import()`，并抽取顶层 class/function 作为符号节点
- Python：内置 `ast` 批量索引（imports + 顶层 class/function）
- Java：JavaParser AST 接入（imports + class/method + annotations + extends/implements + injects）

> 节点结构保持稳定（file/class/function/external），语义标签通过属性扩展（如 Java 的 role/stereotypes/isInterface）。

### 3.2 Java 分层识别（已实现）
- Java 类节点新增属性：
  - `role`：controller/service/serviceImpl/repository/mapper/entity/dto/config/util/component/other
  - `stereotypes`：注解列表（用于 Spring/MyBatis 识别）
  - `isInterface`、`fqn`
- Java 语义边：
  - `extends`、`implements`
  - `injects`（字段注入、构造器注入）
  - `import`（文件级）

### 3.3 依赖图可视化（已增强）
依赖图页面提供三种视图与下钻：
- Package View（默认）：按包路径聚合，跨包依赖计数汇总（边粗细表示强度）
- Layer View：按 Java 角色（role）聚合为层节点，跨层依赖计数汇总
- Class View：原始节点级视图（file/class/function/external），支持 role 过滤

并提供边类型筛选：
- All / injects / import / implements / extends  
以及一键主链路：
- Injects Chain（自动切到 Layer View 且筛选 injects）

## 4. 对外 API 约定（Node API）

### 健康检查
- GET `/api/health`

### 项目
- GET `/api/projects`
- POST `/api/projects/import`
- POST `/api/projects/:id/parse`
- GET `/api/projects/:id/dependencies`

### 任务
- GET `/api/tasks?limit=100&status=running&task_type=parse&project_id=...`
- GET `/api/tasks/:id`

## 5. 数据库模型（Supabase / Postgres）

迁移文件：
- `supabase/migrations/01_init_schema.sql`
- `supabase/migrations/02_rls_policies_dev.sql`（开发期 RLS 策略）

核心表：
- `projects`：项目元信息与状态
- `tasks`：任务（parse 等）与运行状态、结果
- `parse_results`：解析结果（dependencies 图数据存 JSONB）
- `users`：预留（当前未接入完整登录鉴权）

RLS 说明：
- 已启用 RLS；开发期可通过 `02_rls_policies_dev.sql` 为 anon 开放必要读写策略
- 生产建议使用 service_role 在后端写入，并收紧 anon 权限

## 6. 本地运行与配置要点

### Node API（必须）
需要在项目根目录配置 `.env`：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

脚本：
- `pnpm run server:dev`
- `pnpm run client:dev`
- `pnpm run dev`（并行启动）

### Python 服务（可选：问答/解析）
目录：`api/python-service/`
需要配置 `.env`：
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_CHAT_MODEL`（默认 qwen-max）
- `DASHSCOPE_BASE_URL`（默认 compatible-mode chat/completions）

### Java 解析 CLI（JavaParser）
Node 侧解析 Java 时会：
- 自动下载 `javaparser-core-3.26.1.jar`
- 自动编译 `JavaParserCli.java`
- 运行 CLI 输出 AST 索引

要求：
- 本机可用 `java/javac`（JDK）

## 7. 当前限制与改进方向

### 已知限制
- 依赖图规模较大时仍可能出现渲染压力（需进一步做聚合/分页/按需加载）
- Java 的“调用关系（call graph）”尚未构建（目前以 injects/extends/implements/import 为主）
- 用户鉴权与多用户隔离未完整接入（users 表为预留）
- 解析任务目前在 Node 进程内异步执行，缺少独立 worker/队列的弹性与容错

### 下一步建议（论文/演示价值高）
- Java：补齐方法调用依赖（MethodCallExpr/ObjectCreationExpr）构建 call graph，并与 role 结合展示 controller→service→repo 的调用主链路
- 任务调度：将解析任务迁移为独立 worker（或 Kafka/队列），实现更可靠的异步执行
- 可视化：Layer View 增加“层级方向约束/边标签（count/type）/只展示主链路”的演示模式
- 问答：把 parse_results 的图谱摘要注入到 LLM 上下文，实现“基于真实依赖图”的问答

