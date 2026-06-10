const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, getOne, getAll, runSql, insert } = require('../models/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const fs = require('fs');
const config = require('../../config');
const telegram = require('../utils/telegram');

const router = express.Router();

// ═══════════════════════════════════════════
// 扩展中间件：仅超级管理员
// ═══════════════════════════════════════════
function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: '仅超级管理员可执行此操作' });
  }
  next();
}

// ═══════════════════════════════════════════
// 仪表盘
// ═══════════════════════════════════════════
router.get('/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const totalFiles = getOne('SELECT COUNT(*) as count FROM files')?.count || 0;
  const totalSize = getOne('SELECT COALESCE(SUM(size), 0) as total FROM files')?.total || 0;
  const totalUsers = getOne('SELECT COUNT(*) as count FROM users')?.count || 0;
  const totalFolders = getOne('SELECT COUNT(*) as count FROM folders')?.count || 0;
  const todayUploads = getOne("SELECT COUNT(*) as count FROM files WHERE date(created_at) = date('now')")?.count || 0;
  const todaySize = getOne("SELECT COALESCE(SUM(size), 0) as total FROM files WHERE date(created_at) = date('now')")?.total || 0;

  const weeklyUploads = getAll(
    `SELECT date(created_at) as date, COUNT(*) as count FROM files
     WHERE created_at >= date('now', '-7 days') GROUP BY date(created_at) ORDER BY date`);

  const typeDistribution = getAll(`
    SELECT CASE WHEN mime_type LIKE 'image/%' THEN '图片' WHEN mime_type LIKE 'video/%' THEN '视频'
    WHEN mime_type LIKE 'audio/%' THEN '音频' WHEN mime_type LIKE 'text/%' THEN '文本'
    WHEN mime_type LIKE 'application/pdf%' THEN 'PDF' ELSE '其他' END as type,
    COUNT(*) as count FROM files GROUP BY type ORDER BY count DESC`);

  res.json({ totalFiles, totalSize, totalUsers, totalFolders, todayUploads, todaySize, weeklyUploads, typeDistribution });
});

// ═══════════════════════════════════════════
// 用户管理（超级管理员可管理所有；普通管理员只能查看）
// ═══════════════════════════════════════════
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const { page = 1, page_size = 20, keyword } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const limit = parseInt(page_size);

  let where = '1=1';
  const params = [];
  if (keyword) { where += ' AND (username LIKE ? OR nickname LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  const total = getAll(`SELECT COUNT(*) as count FROM users WHERE ${where}`, params)[0]?.count || 0;
  const users = getAll(
    `SELECT id, username, nickname, role, status, created_at,
       (SELECT COUNT(*) FROM files WHERE uploader_id = users.id) as file_count,
       (SELECT MAX(created_at) FROM files WHERE uploader_id = users.id) as last_upload
     FROM users WHERE ${where} ORDER BY
       CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
       created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);

  res.json({ users, pagination: { page: parseInt(page), page_size: limit, total, total_pages: Math.ceil(total / limit) } });
});

// 创建管理员（仅超级管理员）
router.post('/users', authMiddleware, superAdminOnly, async (req, res) => {
  await getDb();
  const { username, password, nickname, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });

  const targetRole = role === 'super_admin' ? 'admin' : (role || 'admin'); // 默认创建管理员
  if (getOne('SELECT id FROM users WHERE username = ?', [username]))
    return res.status(409).json({ error: '用户名已存在' });

  const hash = bcrypt.hashSync(password, 10);
  insert('INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
    [username, hash, nickname || username, targetRole]);
  res.json({ message: '创建成功' });
});

// 修改用户状态
router.put('/users/:id/status', authMiddleware, superAdminOnly, async (req, res) => {
  await getDb();
  const target = getOne('SELECT role FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'super_admin') return res.status(400).json({ error: '不能修改超级管理员状态' });

  const { status } = req.body;
  runSql('UPDATE users SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [status ? 1 : 0, req.params.id]);
  res.json({ message: '更新成功' });
});

// 修改密码（超级管理员可改任何人；普通管理员只能改自己）
router.put('/users/:id/password', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const targetId = parseInt(req.params.id);
  if (req.user.role !== 'super_admin' && targetId !== req.user.id) {
    return res.status(403).json({ error: '您没有权限修改其他用户密码' });
  }

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请输入新密码' });
  const hash = bcrypt.hashSync(password, 10);
  runSql('UPDATE users SET password = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [hash, targetId]);
  res.json({ message: '密码已更新' });
});

// 删除用户（仅超级管理员，不能删自己/其他超级管理员）
router.delete('/users/:id', authMiddleware, superAdminOnly, async (req, res) => {
  await getDb();
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: '不能删除自己' });

  const target = getOne('SELECT role FROM users WHERE id = ?', [targetId]);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'super_admin') return res.status(400).json({ error: '不能删除其他超级管理员' });

  runSql('DELETE FROM users WHERE id = ?', [targetId]);
  res.json({ message: '已删除' });
});

// ═══════════════════════════════════════════
// 文件管理
// ═══════════════════════════════════════════
router.get('/files', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const { page = 1, page_size = config.PAGE_SIZE, sort = 'created_at', order = 'desc', keyword, folder_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const limit = parseInt(page_size);

  let where = '1=1';
  const params = [];
  if (keyword) { where += ' AND (f.name LIKE ? OR f.original_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (folder_id) { where += ' AND f.folder_id = ?'; params.push(folder_id); }

  const sField = ['created_at', 'name', 'size'].includes(sort) ? sort : 'created_at';
  const sOrder = order === 'asc' ? 'ASC' : 'DESC';

  const total = getAll(`SELECT COUNT(*) as count FROM files f WHERE ${where}`, params)[0]?.count || 0;
  const files = getAll(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username, fo.name as folder_name
     FROM files f LEFT JOIN users u ON f.uploader_id = u.id LEFT JOIN folders fo ON f.folder_id = fo.id
     WHERE ${where} ORDER BY f.${sField} ${sOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]);

  res.json({ files, pagination: { page: parseInt(page), page_size: limit, total, total_pages: Math.ceil(total / limit) } });
});

// 删除文件
router.delete('/files/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const file = getOne('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!file) return res.status(404).json({ error: '文件不存在' });

  try { if (file.storage_path && fs.existsSync(file.storage_path)) fs.unlinkSync(file.storage_path); } catch(e) {}
  runSql('DELETE FROM files WHERE id = ?', [req.params.id]);
  res.json({ message: '已删除' });
});

// 批量删除
router.post('/files/batch-delete', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ error: '请选择要删除的文件' });

  for (const id of ids) {
    const file = getOne('SELECT * FROM files WHERE id = ?', [id]);
    if (file) {
      try { if (file.storage_path && fs.existsSync(file.storage_path)) fs.unlinkSync(file.storage_path); } catch(e) {}
      runSql('DELETE FROM files WHERE id = ?', [id]);
    }
  }
  res.json({ message: `已删除 ${ids.length} 个文件` });
});

// ═══════════════════════════════════════════
// 上传日志
// ═══════════════════════════════════════════
router.get('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const { page = 1, page_size = 30, action, ip, username } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const limit = parseInt(page_size);

  let where = '1=1';
  const params = [];
  if (action) { where += ' AND l.action = ?'; params.push(action); }
  if (ip) { where += ' AND l.uploader_ip LIKE ?'; params.push(`%${ip}%`); }
  if (username) { where += ' AND l.username LIKE ?'; params.push(`%${username}%`); }

  const total = getAll(`SELECT COUNT(*) as count FROM upload_logs l WHERE ${where}`, params)[0]?.count || 0;
  const logs = getAll(
    `SELECT l.*, f.name as file_stored_name, fo.name as folder_name
     FROM upload_logs l LEFT JOIN files f ON l.file_id = f.id LEFT JOIN folders fo ON l.folder_id = fo.id
     WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);

  res.json({ logs, pagination: { page: parseInt(page), page_size: limit, total, total_pages: Math.ceil(total / limit) } });
});

// ═══════════════════════════════════════════
// 系统设置（含 Telegram 配置）
// ═══════════════════════════════════════════
router.get('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const settings = getAll('SELECT * FROM settings');
  const result = {};
  settings.forEach(s => { result[s.key] = s.value; });
  // 返回 tg_bot_token 给管理员（用掩码）
  if (result.tg_bot_token) {
    const token = result.tg_bot_token;
    result.tg_bot_token_masked = token.length > 8 ? token.substring(0, 4) + '****' + token.substring(token.length - 4) : '****';
  }
  res.json(result);
});

router.put('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    // 跳过掩码字段
    if (key.endsWith('_masked')) continue;
    const existing = getOne('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) {
      runSql('UPDATE settings SET value = ?, updated_at = datetime(\'now\',\'localtime\') WHERE key = ?', [value, key]);
    } else {
      insert('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
  res.json({ message: '设置已更新' });
});

// 测试 Telegram 连接
router.post('/test-telegram', authMiddleware, adminMiddleware, async (req, res) => {
  const { tg_bot_token, tg_chat_id } = req.body;
  if (!tg_bot_token || !tg_chat_id) return res.status(400).json({ error: '请提供 Bot Token 和 Chat ID' });

  const result = await telegram.testConnection(tg_bot_token, tg_chat_id);
  res.json(result);
});

// ═══════════════════════════════════════════
// 文件夹管理
// ═══════════════════════════════════════════
router.delete('/folders/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await getDb();
  const fid = parseInt(req.params.id);

  const children = getOne('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?', [fid])?.count || 0;
  if (children > 0) return res.status(400).json({ error: '请先删除子文件夹' });

  const fcnt = getOne('SELECT COUNT(*) as count FROM files WHERE folder_id = ?', [fid])?.count || 0;
  if (fcnt > 0) return res.status(400).json({ error: '文件夹非空，不能删除' });

  runSql('DELETE FROM folders WHERE id = ?', [fid]);
  res.json({ message: '已删除' });
});

module.exports = router;
