-- Cloud Drive D1 数据库架构
-- 运行: wrangler d1 execute cloud-drive-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK(role IN ('super_admin', 'admin', 'user')),
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  is_private INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS files (
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
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS upload_logs (
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
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);


-- 索引
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_private ON files(is_private);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_tg ON files(tg_file_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_upload_logs_ip ON upload_logs(uploader_ip);
CREATE INDEX IF NOT EXISTS idx_upload_logs_time ON upload_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type);

-- 默认数据
INSERT OR IGNORE INTO users (id, username, password, nickname, role) VALUES (1, 'admin', '$2b$10$placeholder', '超级管理员', 'super_admin');

INSERT OR IGNORE INTO folders (id, name, description) VALUES (1, 'root', '根目录');

INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', '📷 Cloud Drive');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_description', 'Free Image Hosting & Sharing Platform');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_logo', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('allow_anonymous_upload', '0'); -- 默认关闭匿名上传，需管理员手动开启
INSERT OR IGNORE INTO settings (key, value) VALUES ('allow_register', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_file_size', '50');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_private', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('footer_text', 'Cloud Drive © 2026');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tg_bot_token', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tg_chat_id', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tg_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'zh-CN');
INSERT OR IGNORE INTO settings (key, value) VALUES ('github_url', 'https://github.com/Miki-Hunter');
