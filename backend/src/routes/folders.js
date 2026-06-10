const express = require('express');
const { getDb, getOne, getAll, runSql, insert } = require('../models/database');

const router = express.Router();

// 获取文件夹树 (只返回非私密文件夹)
router.get('/tree', async (req, res) => {
  await getDb();
  const showPrivate = req.query.admin === '1';

  let folders;
  if (showPrivate) {
    folders = getAll("SELECT * FROM folders WHERE name != 'root' ORDER BY name");
  } else {
    folders = getAll("SELECT * FROM folders WHERE is_private = 0 AND name != 'root' ORDER BY name");
  }

  // 构建树结构
  const map = {};
  const tree = [];

  folders.forEach(f => {
    map[f.id] = { ...f, children: [] };
  });

  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) {
      map[f.parent_id].children.push(map[f.id]);
    } else {
      tree.push(map[f.id]);
    }
  });

  res.json(tree);
});

// 获取文件夹列表 (平铺)
router.get('/', async (req, res) => {
  await getDb();
  const parentId = req.query.parent_id || null;
  const showPrivate = req.query.admin === '1';

  let folders;
  if (showPrivate) {
    folders = getAll(
      "SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count FROM folders f WHERE f.parent_id IS ? AND f.name != 'root' ORDER BY f.name",
      parentId ? [parentId] : [null]
    );
  } else {
    folders = getAll(
      "SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_private = 0) as file_count FROM folders f WHERE f.parent_id IS ? AND f.is_private = 0 AND f.name != 'root' ORDER BY f.name",
      parentId ? [parentId] : [null]
    );
  }

  res.json(folders);
});

// 获取单个文件夹
router.get('/:id', async (req, res) => {
  await getDb();
  const folder = getOne('SELECT * FROM folders WHERE id = ?', [req.params.id]);
  if (!folder) {
    return res.status(404).json({ error: '文件夹不存在' });
  }

  let parent = null;
  if (folder.parent_id) {
    parent = getOne('SELECT id, name FROM folders WHERE id = ?', [folder.parent_id]);
  }

  res.json({ ...folder, parent });
});

// 创建文件夹
router.post('/', async (req, res) => {
  const { name, parent_id, is_private, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入文件夹名称' });
  }

  await getDb();

  const existing = getOne('SELECT id FROM folders WHERE name = ? AND parent_id IS ?', [name.trim(), parent_id || null]);
  if (existing) {
    return res.status(409).json({ error: '同级文件夹已存在相同名称' });
  }

  const result = insert('INSERT INTO folders (name, parent_id, is_private, description) VALUES (?, ?, ?, ?)', [
    name.trim(),
    parent_id || null,
    is_private ? 1 : 0,
    description || ''
  ]);

  const folder = getOne('SELECT * FROM folders WHERE id = ?', [result.lastInsertRowid]);
  res.json(folder);
});

// 获取面包屑导航
router.get('/:id/breadcrumb', async (req, res) => {
  await getDb();
  const crumbs = [];
  let currentId = parseInt(req.params.id);

  while (currentId) {
    const folder = getOne('SELECT id, name, parent_id FROM folders WHERE id = ?', [currentId]);
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }

  res.json(crumbs);
});

module.exports = router;
