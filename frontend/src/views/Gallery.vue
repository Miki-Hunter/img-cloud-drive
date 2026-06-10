<template>
  <div class="page-container gallery-page">
    <div class="gallery-layout">
      <!-- 文件夹树侧边栏 -->
      <aside class="folder-sidebar" :class="{ open: treeOpen }">
        <div class="sidebar-header">
          <span class="sidebar-title">📂 {{ $t('home.folders') }}</span>
          <button class="sidebar-close" @click="treeOpen = false" v-if="isMobile">✕</button>
        </div>
        <div class="tree-scroll">
          <div class="tree-node" :class="{ active: !currentFolderId }" @click="goToFolder(null); if(isMobile) treeOpen=false">
            <span class="tree-icon">📂</span> {{ $t('gallery.allFiles') }}
          </div>
          <div v-for="f in flatFolders" :key="f.id" class="tree-node"
            :class="{ active: currentFolderId == f.id, private: f.is_private }"
            :style="{ paddingLeft: (f.level || 0) * 20 + 12 + 'px' }"
            @click="goToFolder(f.id); if(isMobile) treeOpen=false">
            <span class="tree-icon">{{ f.is_private ? (isLoggedIn ? '🔓' : '🔒') : '📁' }}</span>
            <span class="tree-name" :title="f.name">{{ f.name }}</span>
            <span v-if="f.is_private" class="private-badge" :title="isLoggedIn ? '登录后可查看' : '私密文件夹'">🔒</span>
          </div>
        </div>
      </aside>

      <!-- 手机端：打开树按钮 -->
      <button class="tree-toggle-btn" @click="treeOpen = !treeOpen" v-if="isMobile">
        <el-icon><FolderOpened /></el-icon>
        <span>{{ currentFolderName }}</span>
      </button>
      <!-- 手机端遮罩 -->
      <div v-if="treeOpen && isMobile" class="tree-overlay" @click="treeOpen = false"></div>

      <!-- 主内容区 -->
      <div class="gallery-main">

    <!-- 子文件夹卡片 -->
    <div v-if="folders.length" class="glass-grid folder-section">
      <div v-for="folder in folders" :key="folder.id" class="glass-card folder-card"
        :class="{ 'is-private': folder.is_private }" @click="goToFolder(folder.id)">
        <div class="folder-icon">
          <span v-if="folder.is_private" style="font-size:1.5rem">{{ isLoggedIn ? '🔓' : '🔒' }}</span>
          <el-icon v-else :size="40"><FolderOpened /></el-icon>
        </div>
        <div class="folder-info">
          <div class="folder-name">
            {{ folder.name }}
            <el-tag v-if="folder.is_private" size="small" type="warning" style="margin-left:4px;vertical-align:middle">私密</el-tag>
          </div>
          <div class="folder-count" v-if="!folder.is_private || isLoggedIn">{{ folder.file_count || 0 }} 文件</div>
          <div class="folder-count" v-else style="color:var(--text-tertiary)">登录后可查看</div>
        </div>
      </div>
    </div>

    <!-- 排序 + 视图切换 + 选择 -->
    <div class="toolbar">
      <span class="toolbar-label">{{ pagination.total }} {{ $t('gallery.files') }}</span>
      <div class="toolbar-actions">
        <el-select v-model="sortField" size="small" @change="loadFiles" style="width:120px">
          <el-option :label="$t('gallery.sortNewest')" value="created_at" />
          <el-option :label="$t('gallery.sortName')" value="name" />
          <el-option :label="$t('gallery.sortSize')" value="size" />
        </el-select>
        <el-button size="small" :icon="sortOrder === 'desc' ? 'SortDown' : 'SortUp'" @click="toggleOrder" text bg />
        <!-- 视图切换 -->
        <el-button-group size="small">
          <el-button :type="viewMode === 'card' ? 'primary' : ''" @click="viewMode='card'" :icon="Grid" />
          <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode='list'" :icon="List" />
        </el-button-group>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedFiles.size" class="batch-bar">
      <span class="batch-info">已选 {{ selectedFiles.size }} 个文件</span>
      <el-button size="small" class="glass-btn" @click="batchDownload">📥 批量下载</el-button>
      <el-button size="small" text @click="copySelectedLinks">📋 复制链接</el-button>
      <el-button size="small" text @click="selectedFiles.clear()">取消选择</el-button>
    </div>

    <!-- 卡片视图 -->
    <template v-if="viewMode === 'card'">
      <div v-if="files.length" class="glass-grid">
        <div v-for="file in files" :key="file.id" class="glass-card file-card"
          :class="{ selected: selectedFiles.has(file.id) }" @click="openFile(file.id)">
          <!-- 多选勾选框 -->
          <div class="file-check" @click.stop="toggleSelect(file.id)">
            <el-checkbox :model-value="selectedFiles.has(file.id)" size="small" />
          </div>
          <img :src="file.thumbnail_url" :alt="file.original_name" class="file-thumb" loading="lazy" @error="onImgError" />
          <div class="file-overlay">
            <div class="file-name" :title="file.original_name">{{ formatFileName(file.original_name, 16) }}</div>
            <div class="file-meta">{{ formatSize(file.size) }}</div>
          </div>
          <div class="file-actions">
            <el-tooltip :content="$t('gallery.copyLink')" placement="top">
              <el-button size="small" circle @click.stop="showLinks(file)"><el-icon><Link /></el-icon></el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <el-icon><FolderDelete /></el-icon>
        <p>{{ $t('gallery.empty') }}</p>
        <router-link to="/upload" class="glass-btn" style="display:inline-block;margin-top:12px">{{ $t('nav.upload') }}</router-link>
      </div>
    </template>

    <!-- 列表视图 -->
    <template v-if="viewMode === 'list'">
      <div v-if="files.length" class="glass-card list-view-wrap">
        <div class="list-header">
          <span class="list-col-check" style="width:32px">
            <el-checkbox :indeterminate="selectedFiles.size > 0 && selectedFiles.size < files.length"
              :model-value="files.length > 0 && selectedFiles.size === files.length"
              @change="val => files.forEach(f => val ? selectedFiles.add(f.id) : selectedFiles.delete(f.id))" size="small" />
          </span>
          <span class="list-col-preview"></span>
          <span class="list-col-name">{{ $t('gallery.sortName') }}</span>
          <span class="list-col-type">{{ $t('detail.fileType') }}</span>
          <span class="list-col-size">{{ $t('gallery.sortSize') }}</span>
          <span class="list-col-time">{{ $t('admin.time') }}</span>
          <span class="list-col-action"></span>
        </div>
        <div v-for="file in files" :key="file.id" class="list-row" :class="{ selected: selectedFiles.has(file.id) }" @click="openFile(file.id)">
          <span class="list-col-check" style="width:32px" @click.stop="toggleSelect(file.id)">
            <el-checkbox :model-value="selectedFiles.has(file.id)" size="small" />
          </span>
          <span class="list-col-preview">
            <img v-if="file.mime_type?.startsWith('image/')" :src="file.thumbnail_url" loading="lazy" @error="e => e.target.style.display='none'" />
            <el-icon v-else><Document /></el-icon>
          </span>
          <span class="list-col-name" :title="file.original_name">{{ formatFileName(file.original_name, 24) }}</span>
          <span class="list-col-type"><span class="file-type-badge">{{ getFileType(file) }}</span></span>
          <span class="list-col-size">{{ formatSize(file.size) }}</span>
          <span class="list-col-time">{{ formatBeijingTime(file.created_at) }}</span>
          <span class="list-col-action" @click.stop>
            <el-button size="small" text @click.stop="showLinks(file)"><el-icon><Link /></el-icon></el-button>
          </span>
        </div>
      </div>
      <div v-else class="empty-state">
        <el-icon><FolderDelete /></el-icon>
        <p>{{ $t('gallery.empty') }}</p>
        <router-link to="/upload" class="glass-btn" style="display:inline-block;margin-top:12px">{{ $t('nav.upload') }}</router-link>
      </div>
    </template>

    <!-- 分页 -->
    <div v-if="pagination.total_pages > 1" class="pagination-wrap">
      <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="pagination.total"
        layout="prev, pager, next" @current-change="loadFiles" background small />
    </div>

    </div><!-- .gallery-main -->
    </div><!-- .gallery-layout -->

    <!-- 链接弹窗 -->
    <AppDialog v-model="linkDialog.visible" :title="$t('gallery.copyLink')" :width="480">
      <div class="link-content" v-if="linkDialog.file">
        <img :src="linkDialog.file.thumbnail_url" class="link-preview" />
        <div class="link-info"><p class="link-name">{{ linkDialog.file.original_name }}</p></div>
        <div class="link-items">
          <div class="link-item" v-for="(val, key) in links" :key="key">
            <label>{{ key }}</label>
            <div class="link-value">
              <code>{{ val }}</code>
              <el-button size="small" @click="copyText(val)">{{ $t('gallery.copyLink') }}</el-button>
            </div>
          </div>
        </div>
      </div>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Grid, List } from '@element-plus/icons-vue'
import AppDialog from '../components/AppDialog.vue'
import { formatFileName, formatBeijingTime } from '../utils/format'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isLoggedIn = computed(() => auth.isLoggedIn)

const files = ref([])
const folders = ref([])
const breadcrumbs = ref([])
const treeOpen = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const flatFolders = ref([]) // 带 level 的扁平文件夹列表，用于树形渲染

// 当前文件夹信息
const currentFolderId = computed(() => route.params.folderId || null)
const currentFolderName = computed(() => {
  if (!currentFolderId.value) return ''
  const f = flatFolders.value.find(x => x.id == currentFolderId.value)
  return f ? f.name : ''
})

function buildFlatTree(all) {
  const sorted = all.filter(f => f.name !== 'root')
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
  flatFolders.value = sorted
}

// 响应式窗口检测
window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768 })
const currentPage = ref(1)
const pageSize = 24
const sortField = ref('created_at')
const sortOrder = ref('desc')
const pagination = ref({ total: 0, total_pages: 0 })
const linkDialog = ref({ visible: false, file: null })
const links = ref({})
const selectedFiles = ref(new Set())

// 视图模式
const viewMode = ref(localStorage.getItem('gallery_view') || 'card')
watch(viewMode, val => localStorage.setItem('gallery_view', val))

function toggleSelect(id) {
  const s = selectedFiles.value
  if (s.has(id)) s.delete(id); else s.add(id)
  // 触发响应式更新
  selectedFiles.value = new Set(s)
}

function batchDownload() {
  const ids = [...selectedFiles.value]
  if (!ids.length) return
  ElMessage.success(`正在下载 ${ids.length} 个文件...`)
  ids.forEach((id, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = `/api/files/${id}/raw`
      a.download = ''
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }, i * 600)
  })
  selectedFiles.value = new Set()
}

function copySelectedLinks() {
  const ids = [...selectedFiles.value]
  if (!ids.length) return
  const links = ids.map(id => `${window.location.origin}/api/files/${id}/download`).join('\n')
  navigator.clipboard.writeText(links).then(() => {
    ElMessage.success(`已复制 ${ids.length} 个链接`)
    selectedFiles.value = new Set()
  }).catch(() => {})
}

function getFileType(file) {
  const ext = file.original_name?.split('.').pop()?.toLowerCase() || ''
  // 统一返回原始后缀，最多显示6字符
  return '.' + ext.substring(0, 6)
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}


function onImgError(e) {
  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23333" width="200" height="200"/><text x="50%" y="50%" fill="%23666" font-size="40" text-anchor="middle" dy=".3em">📄</text></svg>'
}

function openFile(id) { router.push(`/file/${id}`) }
function goToFolder(id) {
  // 未登录用户不可进入私密文件夹
  if (id && !isLoggedIn) {
    const folder = flatFolders.value.find(f => f.id == id) || folders.value.find(f => f.id == id)
    if (folder?.is_private) {
      ElMessage.warning('请先登录查看私密文件夹')
      return
    }
  }
  router.push(id ? `/gallery/${id}` : '/gallery')
}
function toggleOrder() { sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'; loadFiles() }

async function loadFiles() {
  try {
    const folderId = route.params.folderId || null
    const params = { page: currentPage.value, page_size: pageSize, sort: sortField.value, order: sortOrder.value }
    if (folderId) params.folder_id = folderId
    const res = await api.get('/files', { params })
    files.value = res.files || []
    pagination.value = res.pagination
  } catch (e) { console.error(e) }
}

async function loadFolders() {
  try {
    const folderId = route.params.folderId || null
    // 加载当前子文件夹（用于卡片展示）
    const res = await api.get('/folders', { params: { parent_id: folderId || '' } })
    folders.value = res || []
    // 加载全量文件夹树（用于侧边栏树形导航）
    const all = await api.get('/all-folders')
    buildFlatTree(all || [])
  } catch (e) { console.error(e) }
}

async function loadBreadcrumbs() {
  const folderId = route.params.folderId
  if (!folderId) { breadcrumbs.value = []; return }
  try { breadcrumbs.value = await api.get(`/folders/${folderId}/breadcrumb`) }
  catch (e) { breadcrumbs.value = [] }
}

function showLinks(file) {
  links.value = {
    'URL': file.raw_url,
    'Markdown': file.markdown,
    'HTML': file.html,
    'BBCode': file.bbcode
  }
  linkDialog.value.file = file
  linkDialog.value.visible = true
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制')).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta)
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    ElMessage.success('已复制')
  })
}

watch(() => route.params.folderId, () => { currentPage.value = 1; loadFiles(); loadFolders(); loadBreadcrumbs() })
onMounted(() => { loadFiles(); loadFolders(); loadBreadcrumbs() })
</script>

<style scoped>
.folder-section { margin-bottom: 20px; }

.folder-card {
  display: flex; align-items: center; gap: 16px; padding: 16px 20px; cursor: pointer;
}
.folder-icon { color: var(--text-accent); flex-shrink: 0; }
.folder-info { flex: 1; min-width: 0; }
.folder-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-count { color: var(--text-tertiary); font-size: 0.8rem; margin-top: 2px; }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; padding: 12px 0;
}
.toolbar-label { color: var(--text-secondary); font-size: 0.9rem; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }

/* ─── 卡片视图 ─── */
.file-card { aspect-ratio: 1; overflow: hidden; cursor: pointer; }
.file-card.selected {
  outline: 3px solid var(--primary-light);
  outline-offset: -3px;
}
.file-check {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  background: rgba(0,0,0,0.5); border-radius: 4px; padding: 2px;
  opacity: 0; transition: opacity var(--transition-fast);
}
.file-card:hover .file-check,
.file-card.selected .file-check { opacity: 1; }
.list-row.selected {
  background: rgba(79, 70, 229, 0.1) !important;
}
.file-thumb { width: 100%; height: 100%; object-fit: cover; }

/* 批量操作栏 */
.batch-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; margin-bottom: 12px;
  background: var(--bg-glass); backdrop-filter: blur(10px);
  border: 1px solid var(--primary-light);
  border-radius: var(--radius-md);
  animation: fadeIn 0.2s ease;
}
.batch-info { color: var(--text-primary); font-size: 0.9rem; font-weight: 500; flex: 1; }
.file-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; padding: 16px;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
}
.file-name { font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-meta { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px; }
.file-actions { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity var(--transition-fast); }
.file-card:hover .file-actions { opacity: 1; }

/* ─── 列表视图 ─── */
.list-view-wrap {
  overflow-x: auto;
  padding: 0;
}

.list-header, .list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.list-header {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
}

.list-row {
  cursor: pointer;
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--border-color);
}

.list-row:last-child { border-bottom: none; }
.list-row:hover { background: var(--bg-hover); }

.list-col-preview {
  width: 40px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.list-col-preview img { width: 36px; height: 36px; border-radius: 4px; object-fit: cover; }
.list-col-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
.list-col-size { width: 80px; flex-shrink: 0; color: var(--text-secondary); font-size: 0.85rem; }
.list-col-type { width: 60px; flex-shrink: 0; text-align: center; }
.list-col-time { width: 140px; flex-shrink: 0; color: var(--text-tertiary); font-size: 0.8rem; }
.list-col-action { width: 40px; flex-shrink: 0; text-align: center; }

.file-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  white-space: nowrap;
}

.pagination-wrap { display: flex; justify-content: center; padding: 24px 0; }
.breadcrumb-sep { color: var(--text-tertiary); margin: 0 4px; }

/* 链接弹窗 */
.link-content { text-align: center; }
.link-preview { max-width: 200px; max-height: 200px; border-radius: 8px; margin-bottom: 12px; }
.link-name { color: var(--text-secondary); margin-bottom: 16px; }
.link-items { text-align: left; }
.link-item { margin-bottom: 12px; }
.link-item label { display: block; font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 4px; }
.link-value { display: flex; gap: 8px; align-items: center; }
.link-value code {
  flex: 1; padding: 8px 12px; background: rgba(0,0,0,0.3);
  border-radius: 6px; font-size: 0.8rem; word-break: break-all; color: var(--text-secondary);
}

/* ─── 树形侧边栏 ─── */
.gallery-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.folder-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.sidebar-close {
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
}

.tree-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.85rem;
  transition: all var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tree-node.active {
  background: rgba(79, 70, 229, 0.15);
  color: var(--primary-light);
  font-weight: 500;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 0.9rem;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.gallery-main {
  flex: 1;
  min-width: 0;
}

/* 手机端树形导航 */
.tree-toggle-btn {
  display: none;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  width: 100%;
}

.tree-overlay {
  display: none;
}

@media (max-width: 768px) {
  .gallery-layout { flex-direction: column; }
  .gallery-main { width: 100%; }

  /* ─── 手机端侧边栏 ─── */
  .folder-sidebar {
    display: none;
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999; width: 280px; max-height: 100vh;
    border-radius: 0; backdrop-filter: blur(30px);
  }
  .folder-sidebar.open { display: flex; }
  .tree-toggle-btn { display: flex; }
  .tree-overlay {
    display: block; position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 9998;
  }

  /* ─── 手机端子文件夹卡片 ─── */
  .folder-section .folder-card { padding: 10px 12px !important; gap: 8px !important; }

  /* ─── 手机端卡片视图 ─── */
  .glass-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }

  /* ─── 手机端列表视图 ─── */
  .list-view-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .list-view-wrap > * { min-width: 500px; }
  .list-col-time { display: none; }
  .list-col-check { width: 28px !important; }
  .list-col-action { width: 32px; }
  .list-col-size { width: 55px; }
  .list-col-type { width: 40px; }

  /* ─── 工具栏 ─── */
  .toolbar { flex-wrap: wrap; gap: 6px; }
  .toolbar-label { width: 100%; }
  .toolbar-actions .el-select { width: 100px !important; }

  /* ─── 批量操作栏 ─── */
  .batch-bar { flex-wrap: wrap; gap: 6px; padding: 8px 12px !important; }
  .batch-bar .batch-info { width: 100%; font-size: 0.8rem; }
  .batch-bar .el-button { font-size: 0.75rem !important; padding: 4px 8px !important; }
}

@media (max-width: 480px) {
  .glass-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 4px !important; }
  .file-card .file-name { font-size: 0.7rem; }
  .file-card .file-meta { font-size: 0.65rem; }
  .folder-section .folder-card { padding: 8px 10px !important; }
}
</style>
