const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb, getOne, getAll, runSql, insert } = require('../models/database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { isUtf8 } = require('buffer');
const upload = require('../middleware/upload');
const config = require('../../config');
const telegram = require('../utils/telegram');

const router = express.Router();

// ─── 文件列表 ───
router.get('/', async (req, res) => {
  await getDb();
  const { folder_id, page = 1, page_size = config.PAGE_SIZE, sort = 'created_at', order = 'desc', admin } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const limit = parseInt(page_size);

  let where = admin === '1' ? '1=1' : 'f.is_private = 0';
  const params = [];
  if (folder_id) { where += ' AND f.folder_id = ?'; params.push(folder_id); }

  const sField = ['created_at', 'name', 'size'].includes(sort) ? sort : 'created_at';
  const sOrder = order === 'asc' ? 'ASC' : 'DESC';

  const total = getAll(`SELECT COUNT(*) as total FROM files f WHERE ${where}`, params)[0]?.total || 0;
  const files = getAll(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username
     FROM files f LEFT JOIN users u ON f.uploader_id = u.id
     WHERE ${where} ORDER BY f.${sField} ${sOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const filesWithLinks = files.map(f => ({
    ...f,
    url: `${baseUrl}/api/files/${f.id}/download`,
    raw_url: `${baseUrl}/api/files/${f.id}/raw`,
    thumbnail_url: `${baseUrl}/api/files/${f.id}/thumbnail`,
    markdown: `![${f.original_name}](${baseUrl}/api/files/${f.id}/download)`,
    html: `<img src="${baseUrl}/api/files/${f.id}/download" alt="${f.original_name}" />`,
    bbcode: `[img]${baseUrl}/api/files/${f.id}/download[/img]`
  }));

  res.json({ files: filesWithLinks, pagination: { page: parseInt(page), page_size: limit, total, total_pages: Math.ceil(total / limit) } });
});

// ─── 搜索 ───
router.get('/search', async (req, res) => {
  await getDb();
  const { q, page = 1, page_size = config.PAGE_SIZE } = req.query;
  if (!q?.trim()) return res.json({ files: [], pagination: { page: 1, page_size, total: 0, total_pages: 0 } });

  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const limit = parseInt(page_size);
  const kw = `%${q.trim()}%`;

  const total = getAll('SELECT COUNT(*) as total FROM files WHERE is_private = 0 AND (name LIKE ? OR original_name LIKE ?)', [kw, kw])[0]?.total || 0;
  const files = getAll(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username
     FROM files f LEFT JOIN users u ON f.uploader_id = u.id
     WHERE f.is_private = 0 AND (f.name LIKE ? OR f.original_name LIKE ?)
     ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [kw, kw, limit, offset]
  );

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    files: files.map(f => ({
      ...f,
      url: `${baseUrl}/api/files/${f.id}/download`,
      raw_url: `${baseUrl}/api/files/${f.id}/raw`,
      thumbnail_url: `${baseUrl}/api/files/${f.id}/thumbnail`,
      markdown: `![${f.original_name}](${baseUrl}/api/files/${f.id}/download)`,
      html: `<img src="${baseUrl}/api/files/${f.id}/download" alt="${f.original_name}" />`,
      bbcode: `[img]${baseUrl}/api/files/${f.id}/download[/img]`
    })),
    pagination: { page: parseInt(page), page_size: limit, total, total_pages: Math.ceil(total / limit) }
  });
});

// ─── 上传文件（支持中文路径 + TG Bot） ───
router.post('/upload', upload.array('files', 20), async (req, res) => {
  await getDb();
  const { folder_id, is_private } = req.body;
  const ip = req.ip || req.connection?.remoteAddress || '';
  const userId = req.user?.id || null;
  const username = req.user?.username || '';

  if (!req.files?.length) return res.status(400).json({ error: '未选择文件' });

  // 匿名上传检查
  if (!req.user) {
    const allow = getOne("SELECT value FROM settings WHERE key = 'allow_anonymous_upload'");
    if (allow?.value !== '1') {
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(403).json({ error: '暂未开放匿名上传' });
    }
  }

  let tgtPrivate = parseInt(is_private) || 0;
  if (folder_id) {
    const folder = getOne('SELECT is_private FROM folders WHERE id = ?', [folder_id]);
    if (folder) tgtPrivate = folder.is_private;
  }

  const results = [];

  for (const file of req.files) {
    // 修复中文文件名编码
    file.originalname = fixFilename(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();
    const storagePath = file.path.replace(/\\/g, '/');
    let tgFileId = '';
    let tgFileUniqueId = '';

    // 上传到 Telegram Bot
    const isImage = file.mimetype.startsWith('image/');
    const tgResult = isImage
      ? await telegram.uploadPhoto(file.path, file.originalname, file.mimetype)
      : await telegram.uploadFile(file.path, file.originalname, file.mimetype);

    if (tgResult.success) {
      tgFileId = tgResult.file_id;
      tgFileUniqueId = tgResult.file_unique_id || '';
      console.log(`  📤 TG upload OK: ${file.originalname} → ${tgFileId}`);
    } else {
      console.log(`  ⚠️ TG upload skipped for ${file.originalname}: ${tgResult.error}`);
    }

    const result = insert(
      `INSERT INTO files (name, original_name, storage_path, tg_file_id, tg_file_unique_id, size, mime_type, ext, folder_id, is_private, uploader_ip, uploader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [file.filename, file.originalname, storagePath, tgFileId, tgFileUniqueId,
       file.size, file.mimetype, ext, folder_id || null, tgtPrivate, ip, userId]
    );

    const fileId = result.lastInsertRowid;

    insert(
      `INSERT INTO upload_logs (file_id, file_name, file_size, mime_type, folder_id, uploader_ip, uploader_id, username, user_agent, referer, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fileId, file.originalname, file.size, file.mimetype, folder_id || null, ip, userId, username,
       req.headers['user-agent'] || '', req.headers['referer'] || '', 'upload']
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    results.push({
      id: fileId, name: file.filename, original_name: file.originalname,
      size: file.size, mime_type: file.mimetype,
      url: `${baseUrl}/api/files/${fileId}/download`,
      raw_url: `${baseUrl}/api/files/${fileId}/raw`,
      thumbnail_url: `${baseUrl}/api/files/${fileId}/thumbnail`,
      tg_file_id: tgFileId,
      markdown: `![${file.originalname}](${baseUrl}/api/files/${fileId}/download)`,
      html: `<img src="${baseUrl}/api/files/${fileId}/download" alt="${file.originalname}" />`,
      bbcode: `[img]${baseUrl}/api/files/${fileId}/download[/img]`
    });
  }

  res.json({ files: results, count: results.length });
});

// ─── 获取文件详情 ───
router.get('/:id', async (req, res) => {
  await getDb();
  const file = getOne(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username
     FROM files f LEFT JOIN users u ON f.uploader_id = u.id WHERE f.id = ?`,
    [req.params.id]
  );
  if (!file) return res.status(404).json({ error: '文件不存在' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...file,
    url: `${baseUrl}/api/files/${file.id}/download`,
    raw_url: `${baseUrl}/api/files/${file.id}/raw`,
    thumbnail_url: `${baseUrl}/api/files/${file.id}/thumbnail`,
    markdown: `![${file.original_name}](${baseUrl}/api/files/${file.id}/download)`,
    html: `<img src="${baseUrl}/api/files/${file.id}/download" alt="${file.original_name}" />`,
    bbcode: `[img]${baseUrl}/api/files/${file.id}/download[/img]`
  });
});

const { Readable } = require('stream');

// ─── 修复文件名编码（Windows 可能用 GBK 编码文件名） ───
function fixFilename(name) {
  if (!name) return name;
  // 检查字符串中是否包含「可能的乱码」字符：
  // 典型的 Latin-1 扩展字符（À-ÿ）出现在文件名中，说明编码可能不对
  const garbledPattern = /[À-ÿ-ÿĀ-ſ]/;
  // 也检查是否已经包含正常汉字
  const hasChinese = /[一-鿿]/.test(name);
  if (hasChinese) return name; // 已经是中文，没问题
  if (!garbledPattern.test(name)) return name; // 看起来正常，没问题

  // 尝试用 GBK 解码（Windows 中文场景）
  try {
    const buf = Buffer.from(name, 'binary');
    const gbkDecoder = new TextDecoder('gbk');
    const decoded = gbkDecoder.decode(buf);
    // 检查是否解码出了中文字符或其他亚洲字符
    if (/[一-鿿぀-ヿ가-힯]/.test(decoded)) return decoded;
    return name;
  } catch {
    return name;
  }
}

// ─── 代理TG文件（不暴露临时链接，加永久缓存头） ───
async function proxyFromTelegram(tgFileId, mimeType, res) {
  try {
    const tgUrl = await telegram.getFileUrl(tgFileId);
    if (!tgUrl) return false;
    const response = await fetch(tgUrl);
    if (!response.ok) return false;
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (mimeType) res.set('Content-Type', mimeType);
    // 将 Web ReadableStream 转为 Node Readable 并 pipe
    Readable.fromWeb(response.body).pipe(res);
    return true;
  } catch (e) {
    return false;
  }
}

// ─── 下载文件 ───
router.get('/:id/download', async (req, res) => {
  await getDb();
  const file = getOne('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!file) return res.status(404).json({ error: '文件不存在' });

  // 优先从 TG 代理（不重定向，加永久缓存）
  if (file.tg_file_id) {
    const proxied = await proxyFromTelegram(file.tg_file_id, file.mime_type, res);
    if (proxied) return;
  }

  // 降级到本地文件
  const filePath = path.resolve(file.storage_path);
  if (fs.existsSync(filePath)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  res.status(404).json({ error: '文件不可用' });
});

// ─── 原始文件（图床直链，永久缓存） ───
router.get('/:id/raw', async (req, res) => {
  await getDb();
  const file = getOne('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!file) return res.status(404).json({ error: '文件不存在' });

  // 优先从 TG 代理
  if (file.tg_file_id) {
    const proxied = await proxyFromTelegram(file.tg_file_id, file.mime_type, res);
    if (proxied) return;
  }

  // 降级本地文件
  const filePath = path.resolve(file.storage_path);
  if (fs.existsSync(filePath)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (file.mime_type.startsWith('image/')) res.set('Content-Type', file.mime_type);
    return res.sendFile(filePath);
  }
  res.status(404).json({ error: '文件不可用' });
});

// ─── 缩略图 ───
router.get('/:id/thumbnail', async (req, res) => {
  await getDb();
  const file = getOne('SELECT * FROM files WHERE id = ?', [req.params.id]);
  if (!file) return res.status(404).json({ error: '文件不存在' });

  if (file.mime_type.startsWith('image/')) {
    if (file.tg_file_id) {
      const proxied = await proxyFromTelegram(file.tg_file_id, file.mime_type, res);
      if (proxied) return;
    }
    const filePath = path.resolve(file.storage_path);
    if (fs.existsSync(filePath)) {
      res.set('Content-Type', file.mime_type);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    }
  }
  res.status(404).json({ error: '非图片文件或文件不可用' });
});

module.exports = router;
