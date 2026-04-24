# CodeInsight: 智能代码理解与自动化开发辅助系统

CodeInsight 是一款面向开发者的智能工具，旨在通过宏观依赖图谱分析与微观代码语义检索，辅助开发者快速理解复杂代码库并生成高质量的开发计划。

## 核心功能

- **🚀 统一 Copilot 助手**: 集成两种核心模式，支持流式输出与 Markdown 渲染。
  - **Code 模式 (RAG)**: 基于向量检索（Pinecone）的“与代码对话”，支持引用证据溯源。
  - **Plan 模式**: 自动化开发辅助，根据需求生成结构化的改动计划（包含前提假设、文件清单、实施步骤、API 变动及风险评估）。
- **📊 深度代码解析**:
  - **宏观层面**: 自动解析 Java 项目依赖图谱，可视化类与方法间的调用关系。
  - **微观层面**: 基于行窗口切块的代码索引，支持细粒度的语义检索。
- **🧠 智能思考过程**: 支持 DeepSeek Reasoning 模型，可在 UI 实时展示 AI 的“推理过程”。
- **💾 混合持久化架构**:
  - **MySQL**: 存储会话、消息、任务元数据及项目记忆。
  - **MongoDB**: 存储大规模代码切块（Code Chunks）与检索证据文档。
  - **Redis**: 用于短期数据缓存与性能优化。
- **⚡ 异步任务调度**: 接入 Kafka 消息队列，高效处理大规模项目的解析与索引任务。

## 技术栈

### 前端
- **框架**: React + TypeScript + Vite
- **UI**: Tailwind CSS + Lucide Icons
- **内容渲染**: react-markdown + @tailwindcss/typography
- **状态/路由**: React Router v7 + Axios

### 后端
- **核心**: Spring Boot 3.3 (Java 17)
- **安全/架构**: Jakarta EE (JPA/Validation)
- **AI/向量**: DeepSeek API + Pinecone Vector DB
- **中间件**: Kafka, Redis, MongoDB, MySQL

## 快速开始

### 环境依赖
- JDK 17
- Node.js & pnpm
- MySQL 8.0+
- MongoDB & Redis
- Kafka (本地或 Docker 运行)

### 配置
1. 在 `api/java-service/src/main/resources/application.properties` 中配置：
   - `PINECONE_API_KEY`
   - DeepSeek API Key
2. 在 `application-mysql.properties` 中配置数据库连接信息。

### 运行
```bash
# 安装前端依赖
pnpm install

# 启动全栈开发环境 (Vite + Spring Boot)
pnpm run dev
```

## 项目结构
- `src/`: React 前端源码。
- `api/java-service/`: Java 后端源码。
  - `controller/`: REST API 接口。
  - `service/`: 核心业务逻辑（RAG, Plan, Indexing）。
  - `entity/` / `repo/`: MySQL 持久化层。
  - `mongo/`: MongoDB 文档存储层。

## 开发规范
- 本项目后端已从 Node.js 全面迁移至 Java，请勿向 `api/` 根目录添加旧版 Node 代码。
- 所有的 AI 对话统一走 `/api/copilot` 接口。
- 代码切块内容必须存储在 MongoDB 中，MySQL 仅保留元数据指针。
