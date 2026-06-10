const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getDb, getAll, getOne } = require('./models/database');
const config = require(path.resolve(__dirname, '../config'));

const app = express();

// 中间件
// 开发环境允许局域网访问
const isDev = process.env.NODE_ENV !== 'production'
app.use(cors({
  origin: isDev ? true : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/')) {
      console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// 限速
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', apiLimiter);

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/files', require('./routes/files'));
app.use('/api/admin', require('./routes/admin'));

// 获取设置（公开）
app.get('/api/settings', async (req, res) => {
  const db = await getDb();
  const settings = getAll('SELECT * FROM settings');
  const result = {};
  settings.forEach(s => { result[s.key] = s.value; });
  // 不暴露 TG_TOKEN 给前端
  delete result.tg_bot_token;
  res.json(result);
});

// 获取所有文件夹
app.get('/api/all-folders', async (req, res) => {
  await getDb();
  const showPrivate = req.query.admin === '1';
  const where = showPrivate ? "name != 'root'" : "is_private = 0 AND name != 'root'";
  const folders = getAll(`SELECT * FROM folders WHERE ${where} ORDER BY name`);
  res.json(folders);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 静态文件托管
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: '接口不存在' });
  }
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ message: '前端未构建，请先构建前端或访问API', api: 'http://localhost:3000/api/health' });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '文件大小超过限制' });
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: '服务器内部错误', detail: err.message });
});

async function start() {
  await getDb();

  // HTTP (always on)
  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`\n  ✨ 图片网盘服务已启动`);
    console.log(`  🌐 http://localhost:${config.PORT}`);
    if (config.HTTPS) console.log(`  🔒 https://localhost:${config.HTTPS_PORT}`);
    console.log(`  🔑 管理后台: http://localhost:${config.PORT}/admin`);
    console.log(`  👤 管理员: ${config.ADMIN_USERNAME} / ${config.ADMIN_PASSWORD}\n`);
  });

  // HTTPS 支持（可选：需先生成证书放在 backend/config/ 下）
  // 生成: openssl req -x509 -newkey rsa:2048 -keyout backend/config/key.pem -out backend/config/cert.pem -days 365 -nodes
  if (config.HTTPS && process.env.NODE_ENV === 'production') {
    try {
      const https = require('https');
      const fs = require('fs');
      const certPath = path.join(__dirname, '../config/cert.pem');
      const keyPath = path.join(__dirname, '../config/key.pem');
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
          .listen(config.HTTPS_PORT, '0.0.0.0');
      }
    } catch (e) { /* ignore */ }
  }
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

process.on('SIGINT', () => { const { closeDb } = require('./models/database'); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { const { closeDb } = require('./models/database'); closeDb(); process.exit(0); });
