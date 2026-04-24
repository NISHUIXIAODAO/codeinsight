# CodeInsight

智能代码理解与自动化开发辅助系统（毕设项目原型）。

## 本地运行

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

复制 [.env.example](file:///e:/Download_E/Java/codeinsight/.env.example) 为 `.env` 并填入 Supabase 配置：

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

不要把 `.env` 提交到仓库。

如果导入项目时报 `new row violates row-level security policy for table "projects"`：
- 确认后端使用的是 `SUPABASE_SERVICE_ROLE_KEY`（service_role 会绕过 RLS）
- 或在 Supabase 执行 [02_rls_policies_dev.sql](file:///e:/Download_E/Java/codeinsight/supabase/migrations/02_rls_policies_dev.sql) 为 anon 增加开发期策略

### 3) 启动前后端

```bash
pnpm dev
```

前端默认 http://localhost:5173 ，API 默认 http://localhost:3001 。

## API

- GET `/api/health`
- GET `/api/projects`
- POST `/api/projects/import`
- GET `/api/projects/:id/dependencies`
