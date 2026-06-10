const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, getOne, getAll, runSql, insert } = require('../models/database');
const config = require('../../config');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 管理员登录
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  await getDb();
  const user = getOne("SELECT * FROM users WHERE username = ? AND role IN ('super_admin','admin')", [username]);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, nickname: user.nickname },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role
    }
  });
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  await getDb();
  const user = getOne('SELECT id, username, nickname, role, status, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json(user);
});

// 用户注册 (如果开启)
router.post('/register', async (req, res) => {
  await getDb();
  const allowRegister = getOne("SELECT value FROM settings WHERE key = 'allow_register'");
  if (allowRegister?.value !== '1') {
    return res.status(403).json({ error: '暂未开放注册' });
  }

  const { username, password, nickname } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const existing = getOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  const hash = bcrypt.hashSync(password, 10);
  insert('INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)', [
    username, hash, nickname || username, 'user'
  ]);

  res.json({ message: '注册成功' });
});

module.exports = router;
