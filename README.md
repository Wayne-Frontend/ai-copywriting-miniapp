# 文案轻工坊

面向微信小程序的 AI 文案生成项目。目前仓库包含项目设计文档、PostgreSQL/Prisma 数据库迁移、NestJS API、共享契约，以及基于 Art Design Pro 的 Vue 3 管理后台。微信小程序、模型生成和支付闭环尚未完成；当前可体验后台登录、模板列表及小红书标题模板草稿编辑。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `apps/api` | NestJS + Fastify API，包括健康检查、管理员认证和模板接口 |
| `apps/admin` | Vue 3 管理后台，基于 Art Design Pro |
| `packages/contracts` | 前后端共享的模板与 API 契约 |
| `prisma` | 数据模型和数据库迁移 |
| `scripts` | Windows 本地开发脚本 |
| `docs` | 需求、架构、交互和 Prompt 设计文档 |

## 本地启动（Windows）

准备 Node.js 24、pnpm 和 PostgreSQL 18。以下脚本默认连接本机 `localhost:5432`，使用 `postgres` 用户和 `ai_copywriting_dev` 数据库。

1. 创建空数据库 `ai_copywriting_dev`，并安装依赖：

   ```powershell
   pnpm install
   ```

2. 将项目根目录的 `.env.local.example` 复制为 `.env.local`，填入 `POSTGRES_PASSWORD`、`ADMIN_MFA_KEY` 和需要时使用的 `DASHSCOPE_API_KEY`。文件必须使用 UTF-8，逐行写 `KEY=value`；值可以用成对的单引号或双引号包裹，等号旁不要留空格。数据库密码填原文，脚本会自动对连接地址编码。`DASHSCOPE_BASE_URL` 和 `DASHSCOPE_MODEL` 可留空，分别使用北京地域兼容接口和 `qwen-plus`。根目录 `.env.local` 已被 Git 忽略；不要把密钥写进前端的 `apps/admin/.env`。

   将 `apps/admin/.env.example` 复制为 `apps/admin/.env`，按本机情况调整 `VITE_PORT` 和 API 代理地址。这个文件只放前端配置，也已被 Git 忽略。

3. 执行迁移并导入模板目录：

   ```powershell
   pnpm run db:migrate:local
   pnpm run templates:seed:local
   ```

4. 首次创建管理员时生成一个 **32 字节 Base64** 管理员 MFA 加密密钥，填入根目录 `.env.local` 的 `ADMIN_MFA_KEY`。如果已经创建过管理员，必须填入此前使用的同一个密钥，不要重新生成；更换或丢失该密钥会影响已配置 MFA 的管理员登录。

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
   pnpm run admin:create:local
   ```

5. 分别打开两个终端，启动 API 和管理后台：

   ```powershell
   pnpm run api:start:local
   ```

   ```powershell
   pnpm run admin:dev
   ```

   API 默认地址为 `http://127.0.0.1:3000`，管理后台默认地址为 `http://127.0.0.1:3006`。可用 `http://127.0.0.1:3000/health/ready` 检查 API 与数据库连接。

   API 从 `.env.local` 读取百炼配置。`DASHSCOPE_API_KEY` 应与所选地域匹配；留空时不能运行模型测试。脚本只把密钥传给当前 API 子进程，不会传给管理后台。请根据[百炼 Base URL 文档](https://help.aliyun.com/zh/model-studio/base-url)核对地域和业务空间地址。测试调用会产生模型费用，但不会扣除普通用户额度。

## 常用检查

```powershell
pnpm run contracts:check
pnpm --filter @ai-copywriting/api build
pnpm run admin:build
```

详细产品范围和设计约束见 [`docs/项目概述.md`](docs/项目概述.md) 及 `docs` 目录中的其他文档。管理后台所基于框架的许可证见 [`apps/admin/LICENSE`](apps/admin/LICENSE)。
