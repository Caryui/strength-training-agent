# 力量训练方案设计师

一个基于 CodeBuddy Agent SDK 构建的 Web Agent 应用，专注于根据个人训练水平设计科学的力量训练方案。

## 特性

- 💪 **力量训练专家** - 内置专业力量训练教练 Agent，根据你的水平定制方案
- 💬 **流式对话** - 实时显示 AI 回复，训练方案逐步呈现
- 🔧 **工具调用** - 可视化展示 Agent 工具使用
- 🔒 **权限控制** - 支持多种权限模式
- 📝 **会话管理** - 多会话切换和持久化，保存你的训练方案历史
- 🎨 **主题切换** - 支持深色/浅色主题
- 🤖 **自定义 Agent** - 可创建和管理多个 Agent 配置

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **UI**: TDesign React 组件库
- **训练引擎**: 周期化计划 / RPE 调节 / 处方计算，纯 TypeScript（`server/planGenerator.ts`），可在浏览器内直接运行
- **数据持久化**: 浏览器 localStorage（训练打卡、个人档案），刷新不丢、按用户独立
- **AI（可选）**: CodeBuddy Agent SDK，仅「AI 教练对话」需要本地后端（`npm run dev` 启动的 Express）；计划生成 / 打卡 / RPE 调节完全离线可用

> 因为核心功能无需后端，本应用可打包为**纯静态网页**直接分享（见下方「分享与部署」）。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

这会同时启动前端（端口 5173）和后端（端口 3000）

### 3. 访问应用

打开浏览器访问 http://localhost:5173

## 项目结构

```
web-agent/
├── server/                    # 后端服务
│   ├── index.ts              # Express 服务器
│   └── db.ts                 # 数据库操作
├── src/                      # 前端源码
│   ├── components/           # React 组件
│   ├── hooks/                # 自定义 Hooks
│   ├── pages/                # 页面组件
│   ├── types.ts              # 类型定义
│   ├── config.ts             # 应用配置
│   └── App.tsx               # 应用入口
├── data/                     # 数据存储
│   └── chat.db               # SQLite 数据库
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md                 # 项目说明
└── DEVELOPMENT.md            # 二次开发指南
```

## 核心功能

### Agent SDK 集成

- 使用 `query()` API 发送消息并接收流式响应
- 使用 `unstable_v2_createSession()` 创建和管理 Agent 会话
- 使用 `unstable_v2_authenticate()` 处理身份认证
- 支持会话恢复（使用 `resume` 参数）

### 权限控制

支持四种权限模式：
- `default` - 每次工具调用需要确认
- `acceptEdits` - 自动接受编辑类操作
- `plan` - 计划模式（只读）
- `bypassPermissions` - 跳过所有权限检查

### 流式响应

使用 Server-Sent Events (SSE) 实现实时流式响应：
- 文本内容流式输出
- 工具调用实时展示
- 权限请求实时弹窗

### 数据持久化

使用 SQLite 存储：
- 会话信息和配置
- 消息历史记录
- Agent SDK 的 session_id（用于恢复对话）

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/check-login` | GET | 检查 CodeBuddy 登录状态 |
| `/api/models` | GET | 获取可用模型列表 |
| `/api/sessions` | GET | 获取所有会话 |
| `/api/sessions` | POST | 创建新会话 |
| `/api/sessions/:id` | GET | 获取单个会话 |
| `/api/sessions/:id` | PATCH | 更新会话 |
| `/api/sessions/:id` | DELETE | 删除会话 |
| `/api/chat` | POST | 发送消息（SSE 流式响应） |
| `/api/permission-response` | POST | 响应权限请求 |

## 环境要求

- Node.js 18+
- npm 或 yarn

## 配置

### 方式一：环境变量配置

创建 `.env` 文件：

```bash
PORT=3000
CODEBUDDY_API_KEY=your_api_key
CODEBUDDY_AUTH_TOKEN=your_auth_token
CODEBUDDY_BASE_URL=https://api.example.com
CODEBUDDY_INTERNET_ENVIRONMENT=external
```

### 方式二：使用 CodeBuddy CLI 登录

```bash
# 登录 CodeBuddy
codebuddy login

# 启动应用（会自动使用 CLI 的登录信息）
npm run dev
```

### 方式三：Web UI 配置

在应用的设置页面中配置环境变量（仅在当前服务器进程有效）。

## 开发

```bash
# 开发模式（同时启动前后端）
npm run dev

# 单独启动后端
npm run dev:server

# 单独启动前端
npm run dev:client

# 构建生产版本
npm run build

# 运行生产版本
npm start
```

## 二次开发

如果你想基于这个模板进行定制化开发，请查看 [DEVELOPMENT.md](./DEVELOPMENT.md) 获取详细指南，包括：

- 项目架构详解
- 核心功能实现原理
- 10+ 常见定制场景示例
- API 完整参考
- 调试和部署指南

## 分享与部署（静态网页）

本应用核心功能（周期化计划生成、训练打卡、RPE 自动调节）**完全在浏览器内运行，不依赖任何后端**。因此可以直接打包成静态网页，发给任何人——对方打开链接即可使用，无需安装、无需配密钥、数据存在各自浏览器里。

### 1. 构建静态产物

```bash
npm install
npm run build      # 输出到 dist/（base 已设为相对路径，可直接丢到任意静态托管）
```

### 2. 部署到任意静态托管

| 平台 | 做法 |
|------|------|
| **CloudStudio / Vercel / Netlify** | 连接仓库后构建命令填 `npm run build`、输出目录填 `dist`，一键部署即得公网 URL |
| **GitHub Pages** | 把 `dist/` 推到 `gh-pages` 分支，开启 Pages 即可（已用 `base: './'`，无需额外 path 配置）|
| **任意服务器 / 网盘 / U 盘** | 直接拷贝 `dist/` 整个文件夹，用任意静态服务器托管或直接双击 `index.html` 也能跑（HashRouter 已启用，深链可用）|

### 3. 分享方式

- **公网**：部署后把 URL 发微信 / 群聊，对方手机浏览器打开即用。
- **局域网（临时演示）**：本机 `npm run dev`，因已设 `host: 0.0.0.0`，同 WiFi 的人访问 `http://你的内网IP:5173` 即可。
- **二维码**：把公网 URL 生成二维码，扫码即开。

### 4. 关于「AI 教练对话」

只有「AI 教练对话」功能需要本地后端（CodeBuddy SDK + 密钥）。静态部署版会自动隐藏/提示该项，其余功能照常离线可用。若你也想部署 AI 对话，需要另起一个 Express 后端（`npm run server`）并配置 `CODEBUDDY_API_KEY`，再把前端指向它——这通常只在你自己的服务器上进行。

### 5. 示例数据

打开后若想看一份完整的示范：进入「个人档案」→ 点「导入 Excel 真实数据」，即会把一份三周期真实训练记录（蹲 160 / 推 100 / 拉 180 / 举 55 的 TX 目标 + 各阶段实际负荷）回填进浏览器本地，用于体验 RPE 自动调节。

## License

MIT
