/**
 * Cloud Drive - Cloudflare Worker API
 * 基于 D1 数据库 + Telegram Bot 存储
 */

// ─── JWT 工具 ───
async function createJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400 }));
  const signature = await hmacSHA256(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = await hmacSHA256(`${parts[0]}.${parts[1]}`, secret);
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function hmacSHA256(data, key) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── 密码工具 ───
async function hashPassword(password) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return 'sha256$' + btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, hash) {
  if (hash.startsWith('sha256$')) {
    const enc = new TextEncoder();
    const inputHash = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const expected = 'sha256$' + btoa(String.fromCharCode(...new Uint8Array(inputHash)));
    return expected === hash;
  }
  // bcrypt 兼容（来自本地备份导入）
  return false;
}

// ─── Telegram Bot 工具 ───
async function getTgConfig(env) {
  if (!env.DB) return { enabled: false };
  try {
    const token = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'tg_bot_token'").first())?.value;
    const chatId = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'tg_chat_id'").first())?.value;
    const enabled = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'tg_enabled'").first())?.value;
    return { token, chatId, enabled: enabled === '1' && !!token && !!chatId };
  } catch { return { enabled: false }; }
}

async function tgUploadFile(env, fileBuffer, fileName, mimeType) {
  const cfg = await getTgConfig(env);
  if (!cfg.enabled) return { success: false };

  const boundary = '----' + Date.now().toString(36);
  const encFileName = encodeURIComponent(fileName);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${encFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cfg.chatId}\r\n--${boundary}--\r\n`;

  const enc = new TextEncoder();
  const bodyParts = [enc.encode(header), fileBuffer, enc.encode(footer)];
  const bodyLen = bodyParts.reduce((s, p) => s + p.byteLength, 0);

  try {
    const resp = await fetch(`https://api.telegram.org/bot${cfg.token}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: new Blob(bodyParts)
    });
    const result = await resp.json();
    if (result.ok && result.result?.document) {
      return { success: true, file_id: result.result.document.file_id, file_unique_id: result.result.document.file_unique_id };
    }
    return { success: false, error: JSON.stringify(result) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function tgUploadPhoto(env, fileBuffer, fileName, mimeType) {
  const cfg = await getTgConfig(env);
  if (!cfg.enabled) return { success: false };

  const boundary = '----' + Date.now().toString(36);
  const encFileName = encodeURIComponent(fileName);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${encFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cfg.chatId}\r\n--${boundary}--\r\n`;

  const enc = new TextEncoder();
  const bodyParts = [enc.encode(header), fileBuffer, enc.encode(footer)];
  const bodyLen = bodyParts.reduce((s, p) => s + p.byteLength, 0);

  try {
    const resp = await fetch(`https://api.telegram.org/bot${cfg.token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: new Blob(bodyParts)
    });
    const result = await resp.json();
    if (result.ok && result.result?.photo?.length > 0) {
      const photo = result.result.photo[result.result.photo.length - 1];
      return { success: true, file_id: photo.file_id, file_unique_id: photo.file_unique_id };
    }
    return { success: false, error: JSON.stringify(result) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function tgGetFileUrl(env, fileId) {
  const cfg = await getTgConfig(env);
  if (!cfg.token) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${cfg.token}/getFile?file_id=${fileId}`);
    const result = await resp.json();
    if (result.ok && result.result?.file_path) {
      return `https://api.telegram.org/file/bot${cfg.token}/${result.result.file_path}`;
    }
    return null;
  } catch { return null; }
}

async function tgTestConnection(token, chatId) {
  try {
    const meResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meResp.json();
    if (!me.ok) return { success: false, error: 'Bot Token 无效' };
    const msgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Cloud Drive 连接测试成功！' })
    });
    const msg = await msgResp.json();
    if (msg.ok) return { success: true, bot: me.result };
    return { success: false, error: '无法发送消息到该频道/群组' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── 响应帮助函数 ───
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Access-Control-Allow-Origin': '*' }
  });
}

// ─── 请求体解析 ───
async function parseBody(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return await request.json();
  if (ct.includes('multipart/form-data')) return await request.formData();
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const obj = {};
    for (const [k, v] of params) obj[k] = v;
    return obj;
  }
  return {};
}

// ─── 主要请求处理 ───
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
    }

    // 健康检查
    if (path === '/api/health') return json({ status: 'ok', time: new Date().toISOString() });

    // 公开设置
    if (path === '/api/settings' && method === 'GET') return handleGetSettings(env);

    try {
      // API 路由
      if (path.startsWith('/api/')) {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        const user = token ? await verifyJWT(token, env.JWT_SECRET || 'default-secret') : null;

        // 路由分发
        if (path === '/api/auth/admin/login' && method === 'POST') return handleLogin(request, env);
        if (path === '/api/auth/me' && method === 'GET') return handleGetMe(user, env);

        // 文件夹
        if (path === '/api/folders/tree' && method === 'GET') return handleFolderTree(env, url);
        if (path === '/api/folders' && method === 'GET') return handleGetFolders(env, url);
        if (path.match(/^\/api\/folders\/\d+\/breadcrumb$/) && method === 'GET') return handleBreadcrumb(env, path);
        if (path.match(/^\/api\/folders\/\d+$/) && method === 'GET') return handleGetFolder(env, path);
        if (path === '/api/folders' && method === 'POST') return handleCreateFolder(request, env);

        // 文件
        if (path === '/api/files/search' && method === 'GET') return handleSearchFiles(env, url);
        if (path === '/api/files/upload' && method === 'POST') return handleUpload(request, env, user);
        if (path.match(/^\/api\/files\/\d+\/(download|raw|thumbnail)$/) && method === 'GET') return handleFileServe(env, path, request);
        if (path.match(/^\/api\/files\/\d+$/) && method === 'GET') return handleGetFile(env, path);
        if (path === '/api/files' && method === 'GET') return handleListFiles(env, url);

        // 所有文件夹
        if (path === '/api/all-folders' && method === 'GET') return handleAllFolders(env, url);

        // ─── 管理后台 ───
        if (!user || !['super_admin', 'admin'].includes(user.role)) return json({ error: '需要管理员权限', needLogin: true }, 401);

        // 仪表盘
        if (path === '/api/admin/dashboard' && method === 'GET') return handleAdminDashboard(env);

        // 用户管理
        if (path === '/api/admin/users' && method === 'GET') return handleAdminUsers(env, url);
        if (path === '/api/admin/users' && method === 'POST') return handleCreateUser(request, env, user);
        if (path.match(/^\/api\/admin\/users\/\d+\/status$/) && method === 'PUT') return handleUserStatus(request, env, user);
        if (path.match(/^\/api\/admin\/users\/\d+\/password$/) && method === 'PUT') return handleUserPassword(request, env, path, user);
        if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'DELETE') return handleDeleteUser(env, path, user);

        // 文件管理
        if (path === '/api/admin/files' && method === 'GET') return handleAdminFiles(env, url);
        if (path.match(/^\/api\/admin\/files\/\d+$/) && method === 'DELETE') return handleAdminDeleteFile(env, path);
        if (path === '/api/admin/files/batch-delete' && method === 'POST') return handleAdminBatchDelete(request, env);

        // 日志
        if (path === '/api/admin/logs' && method === 'GET') return handleAdminLogs(env, url);
        if (path === '/api/admin/access-logs' && method === 'GET') return handleAccessLogs(env, url);

        // 设置
        if (path === '/api/admin/settings' && method === 'GET') return handleAdminSettings(env);
        if (path === '/api/admin/settings' && method === 'PUT') return handleUpdateSettings(request, env);
        if (path === '/api/admin/test-telegram' && method === 'POST') return handleTestTelegram(request);

        // 文件夹管理
        if (path.match(/^\/api\/admin\/folders\/\d+$/) && method === 'DELETE') return handleAdminDeleteFolder(env, path);

        return json({ error: '接口不存在' }, 404);
      }

      // SPA fallback - 返回前端 index.html
      return json({ error: '前端未部署。请将前端构建产物部署到 Cloudflare Pages', api: 'running' }, 200);

    } catch (err) {
      console.error('Worker Error:', err);
      return json({ error: '服务器内部错误', detail: err.message }, 500);
    }
  }
};

// ═══════════════════════════════════════════════════════
// 路由处理函数
// ═══════════════════════════════════════════════════════

// ─── 设置 ───
async function handleGetSettings(env) {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows.results) result[row.key] = row.value;
  delete result.tg_bot_token;
  return json(result);
}

// ─── 登录 ───
async function handleLogin(request, env) {
  const body = await parseBody(request);
  const { username, password } = body;
  if (!username || !password) return json({ error: '请输入用户名和密码' }, 400);

  let user = await env.DB.prepare('SELECT * FROM users WHERE username = ? AND role IN (?, ?)').bind(username, 'super_admin', 'admin').first();

  // 首次登录：如果用户不存在或密码不匹配，检查环境变量
  if (!user) {
    if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
      const hash = await hashPassword(password);
      await env.DB.prepare("INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, 'super_admin')").bind(username, hash, '超级管理员').run();
      user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    } else {
      return json({ error: '用户名或密码错误' }, 401);
    }
  } else {
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      // 尝试用环境变量密码
      if (password === env.ADMIN_PASSWORD && username === env.ADMIN_USERNAME) {
        const hash = await hashPassword(password);
        await env.DB.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").bind(hash, user.id).run();
      } else {
        return json({ error: '用户名或密码错误' }, 401);
      }
    }
  }

  const token = await createJWT({ id: user.id, username: user.username, role: user.role, nickname: user.nickname || '' }, env.JWT_SECRET || 'default-secret');
  return json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } });
}

// ─── 当前用户 ───
async function handleGetMe(user, env) {
  if (!user) return json({ error: '未登录', needLogin: true }, 401);
  const u = await env.DB.prepare('SELECT id, username, nickname, role, status, created_at FROM users WHERE id = ?').bind(user.id).first();
  if (!u) return json({ error: '用户不存在' }, 404);
  return json(u);
}

// ─── 文件夹 ───
async function handleFolderTree(env, url) {
  const showPrivate = url.searchParams.get('admin') === '1';
  const where = showPrivate ? "name != 'root'" : "is_private = 0 AND name != 'root'";
  const { results: folders } = await env.DB.prepare(`SELECT * FROM folders WHERE ${where} ORDER BY name`).all();
  const map = {};
  const tree = [];
  folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id]);
    else tree.push(map[f.id]);
  });
  return json(tree);
}

async function handleGetFolders(env, url) {
  const parentId = url.searchParams.get('parent_id');
  const showPrivate = url.searchParams.get('admin') === '1';
  const where = showPrivate ? "f.parent_id IS ? AND f.name != 'root'" : "f.parent_id IS ? AND f.is_private = 0 AND f.name != 'root'";
  const { results: folders } = await env.DB.prepare(
    `SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND (1=1 ${showPrivate ? '' : 'AND is_private = 0'})) as file_count FROM folders f WHERE ${where} ORDER BY f.name`
  ).bind(parentId || null).all();
  return json(folders);
}

async function handleGetFolder(env, path) {
  const id = path.match(/\/folders\/(\d+)/)[1];
  const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
  if (!folder) return json({ error: '文件夹不存在' }, 404);
  let parent = null;
  if (folder.parent_id) parent = await env.DB.prepare('SELECT id, name FROM folders WHERE id = ?').bind(folder.parent_id).first();
  return json({ ...folder, parent });
}

async function handleBreadcrumb(env, path) {
  const id = parseInt(path.match(/\/folders\/(\d+)/)[1]);
  const crumbs = [];
  let currentId = id;
  while (currentId) {
    const folder = await env.DB.prepare('SELECT id, name, parent_id FROM folders WHERE id = ?').bind(currentId).first();
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return json(crumbs);
}

async function handleCreateFolder(request, env) {
  const body = await parseBody(request);
  if (!body.name?.trim()) return json({ error: '请输入文件夹名称' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM folders WHERE name = ? AND parent_id IS ?').bind(body.name.trim(), body.parent_id || null).first();
  if (existing) return json({ error: '同级文件夹已存在相同名称' }, 409);
  const result = await env.DB.prepare('INSERT INTO folders (name, parent_id, is_private, description) VALUES (?, ?, ?, ?)').bind(body.name.trim(), body.parent_id || null, body.is_private ? 1 : 0, body.description || '').run();
  const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(result.meta.last_row_id).first();
  return json(folder);
}

// ─── 文件列表 ───
async function handleListFiles(env, url) {
  const folderId = url.searchParams.get('folder_id');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '24');
  const sort = url.searchParams.get('sort') || 'created_at';
  const order = url.searchParams.get('order') || 'desc';
  const admin = url.searchParams.get('admin');
  const offset = (page - 1) * pageSize;

  let where = admin === '1' ? '1=1' : 'f.is_private = 0';
  const params = [];
  if (folderId) { where += ' AND f.folder_id = ?'; params.push(folderId); }

  const sField = ['created_at', 'name', 'size'].includes(sort) ? sort : 'created_at';
  const sOrder = order === 'asc' ? 'ASC' : 'DESC';

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM files f WHERE ${where}`).bind(...params).first();
  const total = totalRow?.total || 0;

  const { results: files } = await env.DB.prepare(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id = u.id WHERE ${where} ORDER BY f.${sField} ${sOrder} LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return json({ files: addLinks(files), pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

// ─── 搜索 ───
async function handleSearchFiles(env, url) {
  const q = url.searchParams.get('q');
  if (!q?.trim()) return json({ files: [], pagination: { page: 1, page_size: 24, total: 0, total_pages: 0 } });

  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '24');
  const offset = (page - 1) * pageSize;
  const kw = `%${q.trim()}%`;

  const totalRow = await env.DB.prepare('SELECT COUNT(*) as total FROM files WHERE is_private = 0 AND (name LIKE ? OR original_name LIKE ?)').bind(kw, kw).first();
  const total = totalRow?.total || 0;

  const { results: files } = await env.DB.prepare(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id = u.id WHERE f.is_private = 0 AND (f.name LIKE ? OR f.original_name LIKE ?) ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
  ).bind(kw, kw, pageSize, offset).all();

  return json({ files: addLinks(files), pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

// ─── 单个文件 ───
async function handleGetFile(env, path) {
  const id = path.match(/\/files\/(\d+)/)[1];
  const file = await env.DB.prepare('SELECT f.*, u.nickname as uploader_name, u.username as uploader_username FROM files f LEFT JOIN users u ON f.uploader_id = u.id WHERE f.id = ?').bind(id).first();
  if (!file) return json({ error: '文件不存在' }, 404);
  return json({ ...file, ...makeLinks(file) });
}

// ─── 上传 ───
async function handleUpload(request, env, user) {
  const formData = await parseBody(request);
  const folderId = formData.get?.('folder_id') || formData.folder_id;
  const isPrivate = formData.get?.('is_private') || formData.is_private;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';

  // 获取上传的文件
  let files = [];
  if (formData instanceof FormData) {
    for (const [key, val] of formData) {
      if (val instanceof File) files.push(val);
    }
  }
  if (!files.length) return json({ error: '未选择文件' }, 400);

  // 匿名上传检查
  if (!user) {
    const allow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'allow_anonymous_upload'").first();
    if (allow?.value !== '1') return json({ error: '暂未开放匿名上传' }, 403);
  }

  let tgtPrivate = parseInt(isPrivate) || 0;
  if (folderId) {
    const folder = await env.DB.prepare('SELECT is_private FROM folders WHERE id = ?').bind(folderId).first();
    if (folder) tgtPrivate = folder.is_private;
  }

  const results = [];
  for (const file of files) {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const buffer = await file.arrayBuffer();
    const tgResult = file.type.startsWith('image/')
      ? await tgUploadPhoto(env, buffer, file.name, file.type)
      : await tgUploadFile(env, buffer, file.name, file.type);

    const tgFileId = tgResult.success ? tgResult.file_id : '';
    const tgUniqueId = tgResult.success ? (tgResult.file_unique_id || '') : '';

    const result = await env.DB.prepare(
      'INSERT INTO files (name, original_name, tg_file_id, tg_file_unique_id, size, mime_type, ext, folder_id, is_private, uploader_ip, uploader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(file.name, file.name, tgFileId, tgUniqueId, file.size, file.type, ext, folderId || null, tgtPrivate, ip, user?.id || null).run();

    const fileId = result.meta.last_row_id;
    const ua = request.headers.get('User-Agent') || '';
    const username = user?.username || '';

    await env.DB.prepare(
      'INSERT INTO upload_logs (file_id, file_name, file_size, mime_type, folder_id, uploader_ip, uploader_id, username, user_agent, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(fileId, file.name, file.size, file.type, folderId || null, ip, user?.id || null, username, ua, 'upload').run();

    const links = makeLinks({ id: fileId, original_name: file.name });
    results.push({ id: fileId, name: file.name, original_name: file.name, size: file.size, mime_type: file.type, ...links });
  }

  return json({ files: results, count: results.length });
}

// ─── 文件下载/查看 ───
async function handleFileServe(env, path, request) {
  const match = path.match(/\/files\/(\d+)\/(\w+)/);
  if (!match) return json({ error: '无效路径' }, 400);
  const id = match[1];
  const action = match[2]; // download, raw, thumbnail

  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
  if (!file) return json({ error: '文件不存在' }, 404);

  // 记录访问
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare('INSERT INTO access_logs (ip, user_agent, path, method) VALUES (?, ?, ?, ?)').bind(ip, request.headers.get('User-Agent') || '', path, 'GET').run();

  // 优先使用 TG 链接
  if (file.tg_file_id) {
    const tgUrl = await tgGetFileUrl(env, file.tg_file_id);
    if (tgUrl) return Response.redirect(tgUrl, 302);
  }

  return json({ error: '文件不可用' }, 404);
}

// ─── 所有文件夹 ───
async function handleAllFolders(env, url) {
  const showPrivate = url.searchParams.get('admin') === '1';
  const where = showPrivate ? "name != 'root'" : "is_private = 0 AND name != 'root'";
  const { results: folders } = await env.DB.prepare(`SELECT * FROM folders WHERE ${where} ORDER BY name`).all();
  return json(folders);
}

// ─── 管理后台 ───
async function handleAdminDashboard(env) {
  const totalFiles = (await env.DB.prepare('SELECT COUNT(*) as count FROM files').first())?.count || 0;
  const totalSize = (await env.DB.prepare('SELECT COALESCE(SUM(size), 0) as total FROM files').first())?.total || 0;
  const totalUsers = (await env.DB.prepare('SELECT COUNT(*) as count FROM users').first())?.count || 0;
  const totalFolders = (await env.DB.prepare('SELECT COUNT(*) as count FROM folders').first())?.count || 0;
  const todayUploads = (await env.DB.prepare("SELECT COUNT(*) as count FROM files WHERE date(created_at) = date('now')").first())?.count || 0;
  const todaySize = (await env.DB.prepare("SELECT COALESCE(SUM(size), 0) as total FROM files WHERE date(created_at) = date('now')").first())?.total || 0;
  const { results: weeklyUploads } = await env.DB.prepare("SELECT date(created_at) as date, COUNT(*) as count FROM files WHERE created_at >= date('now', '-7 days') GROUP BY date(created_at) ORDER BY date").all();
  const { results: typeDistribution } = await env.DB.prepare(`
    SELECT CASE WHEN mime_type LIKE 'image/%' THEN '图片' WHEN mime_type LIKE 'video/%' THEN '视频'
    WHEN mime_type LIKE 'audio/%' THEN '音频' WHEN mime_type LIKE 'text/%' THEN '文本'
    WHEN mime_type LIKE 'application/pdf%' THEN 'PDF' ELSE '其他' END as type,
    COUNT(*) as count FROM files GROUP BY type ORDER BY count DESC`).all();

  return json({ totalFiles, totalSize, totalUsers, totalFolders, todayUploads, todaySize, weeklyUploads, typeDistribution });
}

async function handleAdminUsers(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');
  const keyword = url.searchParams.get('keyword') || '';
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const params = [];
  if (keyword) { where += ' AND (username LIKE ? OR nickname LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  const total = (await env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE ${where}`).bind(...params).first())?.count || 0;
  const { results: users } = await env.DB.prepare(
    `SELECT id, username, nickname, role, status, created_at FROM users WHERE ${where} ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return json({ users, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

async function handleCreateUser(request, env, currentUser) {
  if (currentUser.role !== 'super_admin') return json({ error: '仅超级管理员可执行此操作' }, 403);
  const body = await parseBody(request);
  if (!body.username || !body.password) return json({ error: '请输入用户名和密码' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(body.username).first();
  if (existing) return json({ error: '用户名已存在' }, 409);

  const hash = await hashPassword(body.password);
  const targetRole = body.role === 'super_admin' ? 'admin' : (body.role || 'user');
  await env.DB.prepare('INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)').bind(body.username, hash, body.nickname || body.username, targetRole).run();
  return json({ message: '创建成功' });
}

async function handleUserStatus(request, env, currentUser) {
  if (currentUser.role !== 'super_admin') return json({ error: '仅超级管理员可执行此操作' }, 403);
  const url = new URL(request.url);
  const id = url.pathname.match(/\/users\/(\d+)/)[1];
  const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (!target) return json({ error: '用户不存在' }, 404);
  if (target.role === 'super_admin') return json({ error: '不能修改超级管理员状态' }, 400);
  const body = await parseBody(request);
  const newStatus = body.status ? 1 : 0;
  await env.DB.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(newStatus, id).run();
  return json({ message: '更新成功' });
}

async function handleUserPassword(request, env, path, currentUser) {
  const id = parseInt(path.match(/\/users\/(\d+)/)[1]);
  if (currentUser.role !== 'super_admin' && id !== currentUser.id) return json({ error: '您没有权限修改其他用户密码' }, 403);
  const body = await parseBody(request);
  if (!body.password) return json({ error: '请输入新密码' }, 400);
  const hash = await hashPassword(body.password);
  await env.DB.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").bind(hash, id).run();
  return json({ message: '密码已更新' });
}

async function handleDeleteUser(env, path, currentUser) {
  if (currentUser.role !== 'super_admin') return json({ error: '仅超级管理员可执行此操作' }, 403);
  const id = parseInt(path.match(/\/users\/(\d+)/)[1]);
  if (id === currentUser.id) return json({ error: '不能删除自己' }, 400);
  const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (!target) return json({ error: '用户不存在' }, 404);
  if (target.role === 'super_admin') return json({ error: '不能删除其他超级管理员' }, 400);
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return json({ message: '已删除' });
}

async function handleAdminFiles(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');
  const keyword = url.searchParams.get('keyword') || '';
  const folderId = url.searchParams.get('folder_id');
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const params = [];
  if (keyword) { where += ' AND (f.name LIKE ? OR f.original_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (folderId) { where += ' AND f.folder_id = ?'; params.push(folderId); }

  const total = (await env.DB.prepare(`SELECT COUNT(*) as count FROM files f WHERE ${where}`).bind(...params).first())?.count || 0;
  const { results: files } = await env.DB.prepare(
    `SELECT f.*, u.nickname as uploader_name, u.username as uploader_username, fo.name as folder_name FROM files f LEFT JOIN users u ON f.uploader_id = u.id LEFT JOIN folders fo ON f.folder_id = fo.id WHERE ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return json({ files, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

async function handleAdminDeleteFile(env, path) {
  const id = path.match(/\/files\/(\d+)/)[1];
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
  if (!file) return json({ error: '文件不存在' }, 404);
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
  return json({ message: '已删除' });
}

async function handleAdminBatchDelete(request, env) {
  const body = await parseBody(request);
  const ids = body.ids || [];
  if (!ids.length) return json({ error: '请选择要删除的文件' }, 400);
  for (const id of ids) {
    await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
  }
  return json({ message: `已删除 ${ids.length} 个文件` });
}

async function handleAdminLogs(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '30');
  const ip = url.searchParams.get('ip') || '';
  const username = url.searchParams.get('username') || '';
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const params = [];
  if (ip) { where += ' AND l.uploader_ip LIKE ?'; params.push(`%${ip}%`); }
  if (username) { where += ' AND l.username LIKE ?'; params.push(`%${username}%`); }

  const total = (await env.DB.prepare(`SELECT COUNT(*) as count FROM upload_logs l WHERE ${where}`).bind(...params).first())?.count || 0;
  const { results: logs } = await env.DB.prepare(
    `SELECT l.*, f.name as file_stored_name, fo.name as folder_name FROM upload_logs l LEFT JOIN files f ON l.file_id = f.id LEFT JOIN folders fo ON l.folder_id = fo.id WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return json({ logs, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

async function handleAccessLogs(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '50');
  const offset = (page - 1) * pageSize;

  const total = (await env.DB.prepare('SELECT COUNT(*) as count FROM access_logs').first())?.count || 0;
  const { results: logs } = await env.DB.prepare('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(pageSize, offset).all();

  return json({ logs, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
}

async function handleAdminSettings(env) {
  const { results: rows } = await env.DB.prepare('SELECT * FROM settings').all();
  const result = {};
  for (const row of rows) result[row.key] = row.value;
  if (result.tg_bot_token) {
    const t = result.tg_bot_token;
    result.tg_bot_token_masked = t.length > 8 ? t.substring(0, 4) + '****' + t.substring(t.length - 4) : '****';
  }
  return json(result);
}

async function handleUpdateSettings(request, env) {
  const body = await parseBody(request);
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith('_masked')) continue;
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(key, value).run();
  }
  return json({ message: '设置已更新' });
}

async function handleTestTelegram(request) {
  const body = await parseBody(request);
  if (!body.tg_bot_token || !body.tg_chat_id) return json({ error: '请提供 Bot Token 和 Chat ID' }, 400);
  const result = await tgTestConnection(body.tg_bot_token, body.tg_chat_id);
  return json(result);
}

async function handleAdminDeleteFolder(env, path) {
  const fid = parseInt(path.match(/\/folders\/(\d+)/)[1]);
  const children = (await env.DB.prepare('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?').bind(fid).first())?.count || 0;
  if (children > 0) return json({ error: '请先删除子文件夹' }, 400);
  const fcnt = (await env.DB.prepare('SELECT COUNT(*) as count FROM files WHERE folder_id = ?').bind(fid).first())?.count || 0;
  if (fcnt > 0) return json({ error: '文件夹非空，不能删除' }, 400);
  await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(fid).run();
  return json({ message: '已删除' });
}

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════
function makeLinks(file) {
  if (!file) return {};
  const base = `/api/files/${file.id}`;
  return {
    url: `${base}/download`,
    raw_url: `${base}/raw`,
    thumbnail_url: `${base}/thumbnail`,
    markdown: `![${file.original_name || ''}](${base}/download)`,
    html: `<img src="${base}/download" alt="${file.original_name || ''}" />`,
    bbcode: `[img]${base}/download[/img]`
  };
}

function addLinks(files) {
  return files.map(f => ({ ...f, ...makeLinks(f) }));
}
