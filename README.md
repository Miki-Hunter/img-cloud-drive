# 📷 Cloud Drive - 图片网盘

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

# 中文说明

**Cloud Drive** 是一个基于 Vue 3 + Node.js 的图片托管与分享平台，使用 Telegram Bot 存储文件，Cloudflare Pages Functions + D1 作为后端，部署在 Cloudflare 边缘网络上。

## ⚠️ 安全配置（首次部署必读）

本项目**默认无硬编码密码**，所有敏感配置通过环境变量注入。

| 变量 | 说明 | 必须？ |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | ✅ 生产环境必须 |
| `ADMIN_PASSWORD` | 管理员密码 | ✅ 生产环境必须 |
| `TG_BOT_TOKEN` | Telegram Bot Token | 启用 TG 时必须 |
| `TG_CHAT_ID` | Telegram 频道 ID | 启用 TG 时必须 |

### 本地开发

默认使用 dev fallback，无需配置。

**生产部署前请确保**：

在 Cloudflare Dashboard → Pages → 你的项目 → **Settings → Environment variables** 中添加：

| 变量名 | 说明 |
|--------|-------|
| `ADMIN_PASSWORD` | 管理员登录密码（首次登录用） |
| `JWT_SECRET` | 随机字符串（用于签发登录token） |

并在 **Settings → Functions → D1 database bindings** 中绑定 D1 数据库（变量名: `DB`）。

## ✨ 功能特性

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🖼️ **图床功能** | 上传即生成永久链接，支持 Markdown / HTML / BBCode |
| 📂 **文件夹管理** | 多级子文件夹，拖拽式浏览 |
| 🌓 **日间/夜间模式** | 一键切换，自动跟随系统 |
| 🌐 **中英文双语** | 完整国际化，一键切换语言 |
| 📱 **响应式设计** | 电脑/平板/手机全适配 |
| 🔍 **模糊搜索** | 按文件名快速查找 |
| 📤 **拖拽上传** | 支持多文件、选择路径、即时创建文件夹 |
| 🤖 **Telegram 存储** | 文件自动同步到 Telegram CDN |
| 🔐 **权限体系** | 超级管理员 / 管理员 / 匿名三级 |
| 📊 **管理后台** | 仪表盘、文件管理、用户管理、上传日志、系统设置 |

## 🏗 技术栈

| 层 | 技术 |
|----|------|
| **前端** | Vue 3 + Vite + Element Plus + Pinia + vue-i18n |
| **后端** | Express.js + sql.js (SQLite) |
| **生产部署** | Cloudflare Workers + D1 + Telegram Bot API |
| **存储** | 本地文件系统 / Telegram Bot |
| **认证** | JWT + bcrypt |

## 🚀 快速开始

### 本地运行

```bash
# Windows: 双击 start.bat
# 或命令行:
start.bat

# Linux/Mac:
chmod +x start.sh && ./start.sh
```

### 手动启动

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 构建前端
cd ../frontend && npm run build

# 3. 启动后端
cd ../backend && node src/index.js
```

访问 http://localhost:3000

**首次启动**：管理员密码会在控制台随机生成并显示，请妥善保存。也可以通过 `backend/config/index.js` 自定义。

### 手机端测试

确保手机和电脑在同一 WiFi，打开电脑的局域网 IP：

```
http://192.168.x.x:3000
```

## ☁️ 部署到 Cloudflare

### 前提

- [Cloudflare](https://dash.cloudflare.com) 账号（免费即可）
- 安装 [wrangler](https://developers.cloudflare.com/workers/wrangler/)

```bash
# 1. 登录 Cloudflare
npx wrangler login

# 2. 创建 D1 数据库
npx wrangler d1 create cloud-drive-db
# → 复制输出的 database_id 到 cf-worker/wrangler.toml

# 3. 初始化数据库
cd cf-worker
npx wrangler d1 execute cloud-drive-db --file=./schema.sql

# 4. 设置环境变量
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_PASSWORD

# 5. 部署 Worker
npx wrangler deploy

# 6. 部署前端到 Pages
cd ../frontend
npm run build
npx wrangler pages deploy dist/ --project-name=cloud-drive
```

## 🤖 配置 Telegram Bot

1. 在 [@BotFather](https://t.me/BotFather) 创建 Bot，获取 Token
2. 创建频道/群组，将 Bot 设为管理员
3. 获取 Chat ID（可用 `@getidsbot`）
4. 在管理后台 → 系统设置 → Telegram Bot 填入

## 📸 截图

> *（截图待补充）*

## 📄 项目结构

```
cloud-drive/
├── frontend/          # Vue 3 前端
│   ├── src/views/     # 页面组件
│   ├── src/i18n/      # 国际化
│   └── src/components/ # 公共组件
├── backend/           # Express + sql.js 后端
│   ├── src/routes/    # API 路由
│   └── src/models/    # 数据库封装
├── cf-worker/         # Cloudflare Worker 后端
│   ├── src/index.js   # Worker 入口
│   └── schema.sql     # D1 数据库架构
├── start.bat          # Windows 一键启动
├── start.sh           # Linux/Mac 一键启动
└── CLAUDE.md          # AI 编程参考文档
```

## 📝 License

MIT

---

<a name="english"></a>

# English

**Cloud Drive** is an image hosting and sharing platform built with Vue 3 + Node.js. It supports Telegram Bot storage backend and can be deployed to Cloudflare Workers + D1.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🖼️ **Image Hosting** | Permanent links with Markdown/HTML/BBCode support |
| 📂 **Folder Management** | Multi-level folders with tree view |
| 🌓 **Dark/Light Mode** | One-click toggle, follows system preference |
| 🌐 **i18n** | Full Chinese/English localization |
| 📱 **Responsive** | Desktop, tablet, and mobile friendly |
| 🔍 **Fuzzy Search** | Quick file search by name |
| 📤 **Drag & Drop Upload** | Multi-file, path selection, instant folder creation |
| 🤖 **Telegram Storage** | Auto-sync to Telegram CDN |
| 🔐 **Role System** | Super admin / Admin / Anonymous |
| 📊 **Admin Panel** | Dashboard, files, users, logs, settings |

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vue 3 + Vite + Element Plus + Pinia + vue-i18n |
| **Backend** | Express.js + sql.js (SQLite) |
| **Production** | Cloudflare Workers + D1 + Telegram Bot API |
| **Storage** | Local filesystem / Telegram Bot |
| **Auth** | JWT + bcrypt |

## 🚀 Quick Start

### Local Development

```bash
# Windows: Double click start.bat
# Or via command line:
start.bat

# Linux/Mac:
chmod +x start.sh && ./start.sh
```

### Manual Setup

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Build frontend
cd ../frontend && npm run build

# 3. Start backend
cd ../backend && node src/index.js
```

Open http://localhost:3000

**Admin**: `admin` / (initial password is randomly generated and printed in the console on first start)

### Mobile Testing

Make sure your phone and computer are on the same WiFi network, then open:

```
http://192.168.x.x:3000
```

## ☁️ Cloudflare Deployment

### Prerequisites

- [Cloudflare](https://dash.cloudflare.com) account (free tier works)
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Create D1 database
npx wrangler d1 create cloud-drive-db
# → Copy database_id to cf-worker/wrangler.toml

# 3. Initialize database
cd cf-worker
npx wrangler d1 execute cloud-drive-db --file=./schema.sql

# 4. Set secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_PASSWORD

# 5. Deploy Worker
npx wrangler deploy

# 6. Deploy frontend to Pages
cd ../frontend
npm run build
npx wrangler pages deploy dist/ --project-name=cloud-drive
```

## 🤖 Telegram Bot Setup

1. Create a Bot via [@BotFather](https://t.me/BotFather), get the Token
2. Create a channel/group, add Bot as admin
3. Get Chat ID (use `@getidsbot`)
4. Go to Admin Panel → Settings → Telegram Bot, fill in the config

## 📄 Project Structure

```
cloud-drive/
├── frontend/          # Vue 3 frontend
│   ├── src/views/     # Page components
│   ├── src/i18n/      # Internationalization
│   └── src/components/ # Shared components
├── backend/           # Express + sql.js backend
│   ├── src/routes/    # API routes
│   └── src/models/    # Database wrapper
├── cf-worker/         # Cloudflare Worker backend
│   ├── src/index.js   # Worker entry
│   └── schema.sql     # D1 schema
├── start.bat          # Windows one-click start
├── start.sh           # Linux/Mac one-click start
└── CLAUDE.md          # AI programming reference
```

## 📝 License

MIT
