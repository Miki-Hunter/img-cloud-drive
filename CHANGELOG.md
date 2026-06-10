# Changelog

## 2026-06-11

### 🐛 修复

- **访问日志不完整**：之前仅 `/download` 端点记录 access_logs，前端 Gallery 使用的缩略图（`/thumbnail`）和图片详情页（`/raw`）均无记录。现在三个文件访问端点 `/download`、`/raw`、`/thumbnail` 都会被记录。
  - 涉及文件：`backend/src/routes/files.js`

- **修改密码弹窗浏览器自动填充管理员密码**：未登录用户的密码修改弹窗中的 `<input type="password">` 会被浏览器自动填充已保存的管理员密码，加上 `autocomplete="new-password"` 属性阻止该行为。
  - 涉及文件：`frontend/src/views/admin/Users.vue`

### ✨ 新增

- **修改密码弹窗「生成随机密码」功能**：管理员在修改用户密码时，可点击「🎲 生成」按钮自动生成 16 位强密码（含大小写字母、数字、特殊字符）。生成的密码自动复制到剪贴板，并在输入框中明文展示，方便直接发送给用户。
  - 涉及文件：`frontend/src/views/admin/Users.vue`

### 📝 文档

- 更新 `CLAUDE.md` 补充数据库路径说明（本地开发有两个数据库文件可能不同步）
- 创建 `CHANGELOG.md` 记录版本变更
