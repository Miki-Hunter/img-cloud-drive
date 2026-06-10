const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../../config');

let db = null;
let SQL = null;

function saveDb() {
  if (!db) return;
  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(config.DB_PATH, Buffer.from(data));
}

async function getDb() {
  if (db) return db;
  if (!SQL) SQL = await initSqlJs();

  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  if (fs.existsSync(config.DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(config.DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  initSchema();
  seedData();
  saveDb();
  return db;
}

function initSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    role TEXT DEFAULT 'user' CHECK(role IN ('super_admin','admin','user')),
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    is_private INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    storage_path TEXT DEFAULT '',
    tg_file_id TEXT DEFAULT '',
    tg_file_unique_id TEXT DEFAULT '',
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    ext TEXT DEFAULT '',
    folder_id INTEGER DEFAULT NULL,
    is_private INTEGER DEFAULT 0,
    uploader_ip TEXT DEFAULT '',
    uploader_id INTEGER DEFAULT NULL,
    hash TEXT DEFAULT '',
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS upload_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER DEFAULT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    folder_id INTEGER DEFAULT NULL,
    uploader_ip TEXT DEFAULT '',
    uploader_id INTEGER DEFAULT NULL,
    username TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    referer TEXT DEFAULT '',
    action TEXT DEFAULT 'upload',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // access_logs 表已移除，使用 CF D1 时若表存在则忽略

  // 索引（忽略已存在错误）
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_private ON files(is_private)',
    'CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)',
    'CREATE INDEX IF NOT EXISTS idx_files_tg ON files(tg_file_id)',
    'CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_upload_logs_ip ON upload_logs(uploader_ip)',
    'CREATE INDEX IF NOT EXISTS idx_upload_logs_time ON upload_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type)',
  ];
  for (const idx of indexes) {
    try { db.run(idx); } catch(e) { /* ignore duplicate index */ }
  }
}

function seedData() {
  const bcrypt = require('bcryptjs');

  // 创建默认超级管理员（参数化查询）
  const existing = getOne('SELECT id FROM users WHERE username = ?', [config.ADMIN_USERNAME]);
  if (!existing) {
    const hash = bcrypt.hashSync(config.ADMIN_PASSWORD, 10);
    db.run('INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
      [config.ADMIN_USERNAME, hash, '超级管理员', 'super_admin']);
  } else {
    db.run("UPDATE users SET role = ? WHERE username = ? AND role = ?",
      ['super_admin', config.ADMIN_USERNAME, 'admin']);
  }

  // 创建根文件夹
  const rootExists = getOne("SELECT id FROM folders WHERE name = ? AND parent_id IS NULL", ['root']);
  if (!rootExists) {
    db.run("INSERT INTO folders (name, description) VALUES (?, ?)", ['root', '根目录']);
  }

  // 默认设置
  const settings = [
    ['site_name', '📷 Cloud Drive'],
    ['site_description', 'Free Image Hosting & Sharing Platform'],
    ['site_logo', ''],
    ['allow_anonymous_upload', '0'],  // 默认关闭匿名上传
    ['allow_register', '0'],
    ['max_file_size', '50'],
    ['default_private', '0'],
    ['footer_text', 'Cloud Drive © 2026'],
    ['tg_bot_token', ''],
    ['tg_chat_id', ''],
    ['tg_enabled', '0'],
    ['language', 'zh-CN'],
    ['github_url', 'https://github.com/Miki-Hunter']
  ];

  for (const [key, value] of settings) {
    const existingSet = getOne('SELECT value FROM settings WHERE key = ?', [key]);
    if (!existingSet) {
      db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
  }
}

// ─── 工具函数 ───

function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    results.push(row);
  }
  stmt.free();
  return results;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { changes: db.getRowsModified() };
}

function insert(sql, params = []) {
  db.run(sql, params);
  saveDb();
  // sql.js 没有 lastInsertRowid，改用 max(id)
  // 从 sql 中提取表名
  const match = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (match) {
    const tableName = match[1];
    // 表名来自我们自己的代码（非用户输入），安全
    const result = db.exec(`SELECT MAX(id) as id FROM ${tableName}`);
    if (result.length && result[0].values.length) {
      return { lastInsertRowid: result[0].values[0][0] };
    }
  }
  return { lastInsertRowid: null };
}

function closeDb() {
  if (db) { saveDb(); db.close(); db = null; }
}

module.exports = { getDb, closeDb, getOne, getAll, runSql, insert };
