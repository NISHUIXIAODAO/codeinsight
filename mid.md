**项目概述**
- 我做的是一个“智能代码理解与自动化开发辅助系统”的原型，围绕“代码仓库解析 → 依赖图谱构建 → 可视化交互 → 任务调度 → 智能问答”形成了一个可运行闭环
- 目标是把真实代码仓库快速结构化成图数据，用多视图的方式辅助理解工程分层与依赖关系，并把图谱摘要接入到问答里，服务于学习、重构和研发协作

**整体架构**
- 三段式本地系统：
  - 前端 Web：React + TypeScript + Vite，提供导入项目、任务中心、依赖图谱与问答页面
  - Node API：Express 本地服务，负责项目与任务管理、解析调度、图数据持久化到 Supabase（Postgres）
  - 可选 AI 服务：
    - Python（Flask）：问答接口，接入通义千问（DashScope）兼容 OpenAI chat/completions
    - Java（Spring Boot）：预留扩展，适配 JavaParser 和消息队列（Kafka）做任务调度
- 数据流：
  - 前端发起导入/解析 → Node API 写 tasks → 异步构建依赖图 → 存到 parse_results → 前端拉取并渲染

**技术栈**
- 前端：React 18、TypeScript、Vite、TailwindCSS、react-router-dom、react-force-graph-2d
- Node API：Express、dotenv、cors，数据库用 Supabase（Postgres）
- 解析核心：[repoGraph.js](file:///e:/Download_E/Java/codeinsight/api/lib/repoGraph.js)（TypeScript/JavaScript/Python/Java 多语言解析）
- Python 服务：[app.py](file:///e:/Download_E/Java/codeinsight/api/python-service/app.py)（Flask + DashScope）
- Java 扩展：JavaParser CLI + Spring Boot 预留

**已完成能力闭环**
- 多语言 AST/语义索引
  - JS/TS：抽取 import/export/require/import()，顶层 class/function 建模为节点
  - Python：内置 ast 抽取 imports + 顶层 class/function
  - Java：JavaParser 提取 imports、class/method、extends/implements、注入关系，并对类做角色识别（controller/service/repository/…）
- 依赖图可视化（多视图）
  - Package View：按包路径/目录聚合，跨包依赖计数加权显示
  - Layer View：按 Java 角色聚合层级节点，展示跨层依赖强度
  - Class View：原始节点级（file/class/function/external），支持角色过滤和下钻
  - 一键主链路：Injects Chain（切换 Layer 视图并筛选注入边）
  - 前端实现见 [Dependencies.tsx](file:///e:/Download_E/Java/codeinsight/src/pages/Projects/Dependencies.tsx)
- 任务中心与项目管理
  - 列表、筛选、查看 config/result，界面见 [Tasks 页面](file:///e:/Download_E/Java/codeinsight/src/pages/Tasks/index.tsx) 与 [Projects 页面](file:///e:/Download_E/Java/codeinsight/src/pages/Projects/index.tsx)
  - 后端接口实现见 [projects.js](file:///e:/Download_E/Java/codeinsight/api/routes/projects.js)、[tasks.js](file:///e:/Download_E/Java/codeinsight/api/routes/tasks.js)
- 问答能力（可选）
  - Python 服务的 `/api/qa` 对接通义千问，前端页面见 [QA.tsx](file:///e:/Download_E/Java/codeinsight/src/pages/Projects/QA.tsx)

**关键技术点 / 创新点**
- 多语言统一图谱建模：节点稳定为 file/class/function/external，语义通过属性和边扩展；利于跨语言融合
- Java 分层角色识别：结合包名、类名与注解推断角色，Layer View 直接反映 controller→service→repo 结构
- 依赖图多尺度视图与下钻：包→层→类多维切换，并提供主链路快速聚焦，兼顾全局与细节
- 解析管线“轻量异步”：导入即落库任务，后台解析写入图谱，前端轮询/刷新即可看到最新结果
- 可扩展的解析后端：JavaParser CLI 落地，后续可切换到独立 worker/队列（Kafka）增强弹性

**数据库与接口**
- 表设计：projects / tasks / parse_results（dependencies 图数据 JSONB）
- 对外接口（Node API，见 [app.js](file:///e:/Download_E/Java/codeinsight/api/app.js)）：
  - 项目：GET /api/projects、POST /api/projects/import、POST /api/projects/:id/parse、GET /api/projects/:id/dependencies
  - 任务：GET /api/tasks、GET /api/tasks/:id
  - 健康：GET /api/health
- 前端开发代理：见 [vite.config.ts](file:///e:/Download_E/Java/codeinsight/vite.config.ts)，将 `/api` 代理到 `http://localhost:3001`

**演示脚本（老师面前的走查路径）**
- Step 1：在 “Projects” 页面点击 Import，填本地仓库路径 → 任务中心出现 parse 任务
- Step 2：任务完成后，打开项目的 “Graph” → 展示 Package View，全局依赖分布
- Step 3：切换 Layer View → 展示按角色聚合的跨层依赖强度；点击 “Injects Chain”
- Step 4：切至 Class View → 选定 package 下钻，按角色过滤，查看具体类之间的 import/extends/implements/injects
- Step 5（可选）：进入 “Chat”，提问“该项目的核心调用链路是什么？”并说明问答会结合项目上下文

**当前进度与状态**
- 已完成：多语言解析、角色识别、依赖图谱构建与可视化三视图、项目导入与任务调度闭环、问答接口打通
- 正在完善：大图渲染优化（聚合/分页/按需加载）、更稳定的异步任务执行（准备引入队列/worker）
- 待办/规划：
  - Java 方法级调用关系（call graph）补充到图谱，并与 Layer View 联动展示
  - 问答注入真实图谱摘要，让回答更贴近仓库事实
  - 用户鉴权与多用户隔离（users 表已预留）

**已知限制与解决思路**
- 大规模仓库渲染压力：增加服务端聚合与前端渐进加载
- 解析任务弹性不足：迁移到独立 worker 或 Kafka 保证容错与重试
- 外部服务可用性风险：当前演示依赖 Supabase；准备离线/本地 JSON 模式兜底（可将 parse_results 先写回本地文件供前端读取）

**近期阻塞与说明（老师关心的“为什么 500”）**
- 目前我机器连接到 Supabase 的项目域名解析失败（DNS ENOTFOUND），Node API 在访问 DB 时返回 500
  - 已做的定位：写了连接测试脚本验证域名不可达；Node 控制台现已打印出完整错误信息便于巡检
  - 解决计划：在 Supabase 后台恢复/核对项目 URL 与 Key；必要时切换 DNS 或加本地离线数据源做演示

**我的个人贡献**
- 解析管线与统一图谱建模（多语言、节点/边设计、Java 角色识别）— [repoGraph.js](file:///e:/Download_E/Java/codeinsight/api/lib/repoGraph.js)
- Node API 全链路（项目/任务/结果、接口、错误处理）— [projects.js](file:///e:/Download_E/Java/codeinsight/api/routes/projects.js)、[tasks.js](file:///e:/Download_E/Java/codeinsight/api/routes/tasks.js)
- 前端三视图图谱 + 任务中心 + 项目页交互 — [Dependencies.tsx](file:///e:/Download_E/Java/codeinsight/src/pages/Projects/Dependencies.tsx)、[Tasks](file:///e:/Download_E/Java/codeinsight/src/pages/Tasks/index.tsx)、[Projects](file:///e:/Download_E/Java/codeinsight/src/pages/Projects/index.tsx)
- Python 问答服务打通 DashScope — [app.py](file:///e:/Download_E/Java/codeinsight/api/python-service/app.py)

**答辩可能问题与我的回答准备**
- 问：多语言解析如何统一建模？  
  - 答：抽象稳定节点类型（file/class/function/external）与通用关系（contains/import/extends/implements/injects），语言特有语义以节点属性扩展（如 role、stereotypes）
- 问：Layer View 的角色识别准确性如何保证？  
  - 答：优先使用注解（Controller/Service/Repository 等），其次包名/类名启发式规则；冲突时以注解优先，提供手工校正空间
- 问：大图性能如何优化？  
  - 答：包/层聚合、边计数加权、懒加载与阈值分页，必要时服务端返回视图级子图
- 问：为什么要用图谱而不是表格/树？  
  - 答：跨文件/跨层的依赖是网状结构，图模型便于揭示“跨层耦合、主链路、外部依赖集中区”等宏观结构

**总结**
- 目前我已经打通了“代码 → 图谱 → 可视化 → 任务管理 → 问答”的核心闭环，并做了面向工程实践的分层识别与多视图下钻
- 下一步我会补充方法级调用关系和离线演示兜底方案，同时把任务执行迁移到独立 worker，提升稳定性与可演示性