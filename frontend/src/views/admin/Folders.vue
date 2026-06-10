<template>
  <div class="admin-folders fade-in">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button class="glass-btn" @click="showCreateDialog(null)">
          <el-icon><FolderAdd /></el-icon> 新建文件夹
        </el-button>
      </div>
    </div>

    <!-- 文件夹树 -->
    <div class="glass-card folder-tree">
      <div v-if="folders.length" class="tree-list">
        <div v-for="folder in folders" :key="folder.id" class="tree-item"
          :class="{ selected: selectedFolderId === folder.id }"
          :style="{ paddingLeft: (folder.level || 0) * 28 + 12 + 'px' }"
        >
          <div class="tree-item-content" @click="selectFolder(folder.id)">
            <!-- 层级连接线 -->
            <div class="tree-lines" v-if="folder.level > 0">
              <span v-for="l in folder.level" :key="l" class="tree-line"></span>
            </div>
            <div class="tree-item-info">
              <el-icon :size="18" style="color:var(--text-accent);flex-shrink:0">
                <FolderOpened />
              </el-icon>
              <span class="tree-item-name">{{ folder.name }}</span>
              <span class="tree-item-meta">{{ folder.file_count || 0 }} 文件</span>
              <el-tag v-if="folder.is_private" size="small" type="warning">私密</el-tag>
            </div>
            <div class="tree-item-actions">
              <el-tooltip content="重命名" placement="top">
                <el-button size="small" text @click.stop="renameFolder(folder)"><el-icon><Edit /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip content="私密文件夹" placement="top">
                <el-button size="small" text :type="folder.is_private ? 'warning' : 'info'"
                  @click.stop="togglePrivate(folder)">
                  <el-icon><Lock /></el-icon>
                </el-button>
              </el-tooltip>
              <el-button size="small" text @click.stop="showCreateDialog(folder.id)">
                <el-icon><Plus /></el-icon> 子文件夹
              </el-button>
              <el-button size="small" text type="danger" @click.stop="deleteFolder(folder)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <el-icon><FolderDelete /></el-icon>
        <p>暂无文件夹</p>
      </div>
    </div>

    <!-- 新建对话框（独立全局弹窗） -->
    <AppDialog v-model="dialog.visible" :title="dialog.title" :width="480" :close-on-click-overlay="false">
      <el-form :model="form" label-position="top">
        <el-form-item label="文件夹名称">
          <el-input v-model="form.name" placeholder="输入名称" class="glass-input" />
        </el-form-item>
        <el-form-item label="父文件夹">
          <el-tree-select
            v-model="form.parent_id"
            :data="folderTree"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            placeholder="顶级文件夹"
            clearable
            class="glass-input"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选描述" class="glass-input" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item>
          <el-switch v-model="form.is_private" /> <span style="margin-left:8px">私密文件夹</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" class="glass-btn" @click="createFolder">创建</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock, Edit } from '@element-plus/icons-vue'
import AppDialog from '../../components/AppDialog.vue'
import api from '../../api'

const { t } = useI18n()

const folders = ref([])
const folderTree = ref([])
const dialog = ref({ visible: false, title: '新建文件夹', parentId: null })
const form = ref({ name: '', parent_id: null, description: '', is_private: false })
const selectedFolderId = ref(null) // 当前选中的文件夹ID，用于新建时作为默认父文件夹

function buildTree(flatList) {
  const map = {}
  const tree = []
  flatList.forEach(f => { map[f.id] = { ...f, children: [] } })
  flatList.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id])
    else if (f.name !== 'root') tree.push(map[f.id])
  })
  return tree
}

async function loadFolders() {
  try {
    const all = await api.get('/all-folders', { params: { admin: '1' } })
    const sorted = all.filter(f => f.name !== 'root')
    // 计算层级
    const levelMap = {}
    function calcLevel(id, lv) {
      levelMap[id] = lv
      const item = sorted.find(f => f.id === id)
      if (item) item.level = lv
    }
    sorted.forEach(f => { if (!f.parent_id) calcLevel(f.id, 0) })
    let changed = true
    while (changed) {
      changed = false
      sorted.forEach(f => {
        if (f.level === undefined && f.parent_id && levelMap[f.parent_id] !== undefined) {
          calcLevel(f.id, levelMap[f.parent_id] + 1)
          changed = true
        }
      })
    }
    folders.value = sorted
    folderTree.value = buildTree(sorted)
  } catch (e) { console.error(e) }
}

function renameFolder(folder) {
  ElMessageBox.prompt('新名称', '重命名', { inputValue: folder.name, confirmButtonText: '确定', cancelButtonText: '取消' })
    .then(async ({ value }) => {
      if (!value?.trim()) return
      await api.put(`/admin/folders/${folder.id}/rename`, { name: value.trim() })
      folder.name = value.trim()
      ElMessage.success('已重命名')
      loadFolders()
    }).catch(() => {})
}

function selectFolder(id) {
  selectedFolderId.value = id
}

function showCreateDialog(parentId) {
  // 确保 parentId 是数字或 null（修复 click 事件传入的问题）
  const pid = (typeof parentId === 'number') ? parentId : selectedFolderId.value
  form.value = { name: '', parent_id: pid, description: '', is_private: false }
  dialog.value.title = pid ? '创建子文件夹' : '新建文件夹'
  dialog.value.visible = true
}

async function createFolder() {
  if (!form.value.name.trim()) {
    ElMessage.warning(t('admin.folderName'))
    return
  }
  try {
    await api.post('/folders', form.value)
    ElMessage.success(t('admin.createSuccess'))
    dialog.value.visible = false
    loadFolders()
  } catch (e) { ElMessage.error(e?.error || t('admin.createFailed')) }
}

async function togglePrivate(folder) {
  try {
    const newVal = folder.is_private ? 0 : 1
    await api.put(`/admin/folders/${folder.id}/private`, { is_private: newVal })
    folder.is_private = newVal
    ElMessage.success(newVal ? '已设为私密' : '已取消私密')
    loadFolders()
  } catch (e) { ElMessage.error(e?.error || '操作失败') }
}

function deleteFolder(folder) {
  ElMessageBox.confirm(t('admin.confirmDeleteFolder') + ` "${folder.name}"？`, t('common.tip'), {
    confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning'
  }).then(async () => {
    try {
      await api.delete(`/admin/folders/${folder.id}`)
      ElMessage.success(t('admin.deleted'))
      loadFolders()
    } catch (e) { ElMessage.error(e?.error || t('admin.deleteFailed')) }
  }).catch(() => {})
}

onMounted(loadFolders)
</script>

<style scoped>
.toolbar { margin-bottom: 16px; }

.folder-tree {
  padding: 8px 0;
}

.tree-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-radius: 8px;
  transition: background var(--transition-fast);
  cursor: pointer;
}

.tree-item.selected > .tree-item-content {
  background: rgba(79, 70, 229, 0.15);
  border: 1px solid rgba(79, 70, 229, 0.3);
}

.tree-item-content:hover {
  background: var(--bg-hover);
}

.tree-lines {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  flex-shrink: 0;
}

.tree-line {
  display: inline-block;
  width: 20px;
  height: 100%;
  position: relative;
  flex-shrink: 0;
}

.tree-line::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-color);
}

.tree-item:last-child > .tree-item-content .tree-line:last-child::before {
  height: 50%;
}

.tree-item-content:hover .tree-line::before {
  background: var(--text-tertiary);
}

.tree-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.tree-item-name {
  font-weight: 500;
}

.tree-item-meta {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.tree-item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tree-item-content:hover .tree-item-actions {
  opacity: 1;
}

@media (max-width: 768px) {
  .tree-item-content {
    flex-wrap: wrap;
    gap: 4px;
  }
  .tree-item-info {
    min-width: 0;
    flex-wrap: wrap;
  }
  .tree-item-actions {
    opacity: 1 !important;
    padding-left: 28px;
  }
}
</style>
