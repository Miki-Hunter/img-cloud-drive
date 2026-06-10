<template>
  <div class="admin-files fade-in">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="keyword" placeholder="搜索文件名..." clearable class="glass-input search-input"
          @keyup.enter="search" @clear="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button class="glass-btn" @click="search">搜索</el-button>
      </div>
      <div class="toolbar-right">
        <el-button v-if="selectedIds.length" type="danger" @click="batchDelete">
          <el-icon><Delete /></el-icon> 删除选中 ({{ selectedIds.length }})
        </el-button>
      </div>
    </div>

    <div class="glass-card table-wrap">
      <el-table :data="files" style="width:100%" @selection-change="onSelectionChange"
        v-loading="loading" stripe :max-height="620" size="small">
        <el-table-column type="selection" width="36" />
        <el-table-column label="文件名" min-width="140">
          <template #default="{ row }">
            <div class="file-cell">
              <div class="file-preview">
                <img v-if="row.mime_type?.startsWith('image/')" :src="`/api/files/${row.id}/thumbnail`"
                  @error="e => e.target.style.display='none'" />
                <el-icon v-else size="18"><Document /></el-icon>
              </div>
              <div class="file-cell-info">
                <div class="file-cell-name">{{ row.original_name }}</div>
                <div class="file-cell-meta">
                  <span class="file-ext">{{ getExt(row) }}</span>
                  <span>{{ formatSize(row.size) }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="目录" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ getFolderPath(row) }}</template>
        </el-table-column>
        <el-table-column label="上传者" min-width="80">
          <template #default="{ row }">{{ row.uploader_username || row.uploader_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="IP" min-width="60">
          <template #default="{ row }">{{ row.uploader_ip || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="130">
          <template #default="{ row }">{{ formatBeijingTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip :content="$t('admin.preview')" placement="top">
                <el-button size="small" text @click="previewFile(row)"><el-icon><View /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip content="重命名" placement="top">
                <el-button size="small" text @click="renameFile(row)"><el-icon><Edit /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip :content="$t('admin.copyLink')" placement="top">
                <el-button size="small" text @click="copyLink(row)"><el-icon><Link /></el-icon></el-button>
              </el-tooltip>
              <el-tooltip :content="$t('admin.delete')" placement="top">
                <el-button size="small" text type="danger" @click="deleteFile(row)"><el-icon><Delete /></el-icon></el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-wrap">
      <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="pagination.total"
        layout="total, prev, pager, next" @current-change="loadFiles" background small />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View, Link, Delete, Edit } from '@element-plus/icons-vue'
import { formatBeijingTime } from '../../utils/format'
import api from '../../api'

const { t } = useI18n()

const files = ref([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = 20
const pagination = ref({ total: 0, total_pages: 0 })
const selectedIds = ref([])
const folderMap = ref({}) // id → {name, parent_id}

function getExt(row) {
  const ext = row.original_name?.split('.').pop()?.toLowerCase() || ''
  return '.' + ext.substring(0, 6)
}

function getFolderPath(row) {
  if (!row.folder_id || !folderMap.value[row.folder_id]) return '根目录'
  const parts = []
  let currentId = row.folder_id
  while (currentId && folderMap.value[currentId]) {
    const f = folderMap.value[currentId]
    parts.unshift(f.name)
    currentId = f.parent_id
  }
  return parts.join(' / ')
}

async function loadFolderMap() {
  try {
    const all = await api.get('/all-folders', { params: { admin: '1' } })
    const map = {}
    all.forEach(f => { map[f.id] = { name: f.name, parent_id: f.parent_id } })
    folderMap.value = map
  } catch (e) { console.error(e) }
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function onSelectionChange(selection) {
  selectedIds.value = selection.map(s => s.id)
}

async function loadFiles() {
  loading.value = true
  try {
    const res = await api.get('/admin/files', {
      params: { page: currentPage.value, page_size: pageSize, keyword: keyword.value }
    })
    files.value = res.files || []
    pagination.value = res.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function search() { currentPage.value = 1; loadFiles() }

function renameFile(row) {
  ElMessageBox.prompt('新文件名', '重命名', { inputValue: row.original_name, confirmButtonText: '确定', cancelButtonText: '取消' })
    .then(async ({ value }) => {
      if (!value?.trim()) return
      await api.put(`/admin/files/${row.id}/rename`, { name: value.trim() })
      row.original_name = value.trim()
      ElMessage.success('已重命名')
    }).catch(() => {})
}

function previewFile(row) {
  window.open(`/#/file/${row.id}`, '_blank')
}

function copyLink(row) {
  const link = `${window.location.origin}/api/files/${row.id}/download`
  navigator.clipboard.writeText(link).then(() => ElMessage.success(t('gallery.copied'))).catch(() => {})
}

function deleteFile(row) {
  ElMessageBox.confirm(`${t('admin.confirmDelete')} "${row.original_name}"？`, t('common.tip'), {
    confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning'
  }).then(async () => {
    try {
      await api.delete(`/admin/files/${row.id}`)
      ElMessage.success(t('admin.deleted'))
      loadFiles()
    } catch (e) { ElMessage.error(e?.error || t('admin.deleteFailed')) }
  }).catch(() => {})
}

function batchDelete() {
  ElMessageBox.confirm(t('admin.deleteSelected'), t('common.tip'), {
    confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning'
  }).then(async () => {
    try {
      await api.post('/admin/files/batch-delete', { ids: selectedIds.value })
      ElMessage.success(t('admin.deleted'))
      selectedIds.value = []
      loadFiles()
    } catch (e) { ElMessage.error(e?.error || t('admin.deleteFailed')) }
  }).catch(() => {})
}

onMounted(async () => {
  await loadFolderMap()
  loadFiles()
})
</script>

<style scoped>
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px; gap: 12px; flex-wrap: wrap;
}
.toolbar-left { display: flex; gap: 8px; align-items: center; }
.search-input { width: 260px; }
.table-wrap { border-radius: var(--radius-lg); overflow: hidden; }
/* 表格内容等分且允许换行 */
.table-wrap :deep(.el-table__body td.el-table__cell) {
  white-space: normal !important;
  word-break: break-all;
  vertical-align: top;
}

/* 文件单元格 */
.file-cell {
  display: flex; align-items: center; gap: 10px;
}
.file-preview {
  width: 36px; height: 36px; border-radius: 6px; overflow: hidden;
  background: var(--bg-secondary); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.file-preview img { width: 100%; height: 100%; object-fit: cover; }
.file-cell-info { flex: 1; min-width: 0; }
.file-cell-name { font-size: 0.85rem; word-break: break-all; line-height: 1.4; }
.file-cell-meta {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px;
}
.file-ext {
  padding: 1px 6px; border-radius: 3px;
  background: var(--bg-secondary); border: 1px solid var(--border-color);
  font-weight: 600; font-size: 0.65rem;
}

.action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding-right: 8px;
}

.action-btns .el-button {
  font-size: 0.9rem;
}

.pagination-wrap {
  display: flex; justify-content: flex-end; padding: 16px 0;
}

@media (max-width: 768px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-left { flex-wrap: wrap; }
  .search-input { width: 100% !important; min-width: 0 !important; }
  .toolbar-right { width: 100%; }
  .toolbar-right .el-button { width: 100%; }
}
</style>
