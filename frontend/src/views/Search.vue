<template>
  <div class="page-container search-page">
    <div class="search-hero fade-in">
      <h1 class="section-title" style="text-align:center;font-size:2rem;margin-bottom:24px">
        🔍 {{ $t('search.title') }}
      </h1>
      <div class="search-box">
        <el-input
          v-model="keyword"
          :placeholder="$t('search.placeholder')"
          size="large"
          clearable
          @keyup.enter="doSearch"
          @clear="clearSearch"
          class="glass-input search-input"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button @click="doSearch" class="search-btn">{{ $t('search.searchBtn') }}</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 搜索提示 -->
    <div v-if="!searched" class="empty-state fade-in" style="animation-delay:0.1s">
      <el-icon><Search /></el-icon>
      <p>{{ $t('search.hint') }}</p>
      <p style="font-size:0.85rem;margin-top:8px">{{ $t('search.hintDetail') }}</p>
    </div>

    <!-- 搜索结果 -->
    <template v-if="searched">
      <div class="toolbar">
        <span class="toolbar-label">{{ $t('search.results', { n: pagination.total }) }}</span>
      </div>

      <div v-if="files.length" class="glass-grid">
        <div v-for="file in files" :key="file.id" class="glass-card file-card" @click="openFile(file.id)">
          <img :src="file.thumbnail_url" :alt="file.original_name" class="file-thumb" @error="onImgError" />
          <div class="file-overlay">
            <div class="file-name" :title="file.original_name">{{ formatFileName(file.original_name, 16) }}</div>
            <div class="file-meta">{{ formatSize(file.size) }}</div>
          </div>
          <div class="file-actions">
            <el-tooltip content="复制链接" placement="top">
              <el-button size="small" circle @click.stop="copyText(file.raw_url)">
                <el-icon><Link /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <el-icon><FolderDelete /></el-icon>
        <p>{{ $t('search.noResults') }}</p>
      </div>

      <div v-if="pagination.total_pages > 1" class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="pagination.total"
          layout="prev, pager, next"
          @current-change="onPageChange"
          background
          small
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { formatFileName } from '../utils/format'
import api from '../api'

const router = useRouter()
const keyword = ref('')
const files = ref([])
const currentPage = ref(1)
const pageSize = 24
const searched = ref(false)
const pagination = ref({ total: 0, total_pages: 0 })

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

async function doSearch() {
  if (!keyword.value.trim()) return
  searched.value = true
  currentPage.value = 1
  await search()
}

// 翻页时保留关键词重新搜索
async function onPageChange(page) {
  currentPage.value = page
  await search()
}

async function search() {
  try {
    const res = await api.get('/files/search', {
      params: { q: keyword.value, page: currentPage.value, page_size: pageSize }
    })
    files.value = res.files || []
    pagination.value = res.pagination
  } catch (e) {
    console.error(e)
  }
}

function clearSearch() {
  files.value = []
  searched.value = false
  pagination.value = { total: 0, total_pages: 0 }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta)
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    ElMessage.success('已复制到剪贴板')
  })
}
</script>

<style scoped>
.search-hero {
  padding: 40px 0;
}

.search-box {
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  --el-input-bg-color: rgba(255,255,255,0.08) !important;
  --el-input-border-color: rgba(255,255,255,0.2) !important;
  --el-input-text-color: #fff !important;
  --el-input-placeholder-color: rgba(255,255,255,0.4) !important;
}

.search-input :deep(.el-input-group__append) {
  background: var(--gradient-primary);
  border: none;
}

.search-btn {
  background: transparent !important;
  border: none !important;
  color: white !important;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.file-card {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
}

.file-thumb { width:100%; height:100%; object-fit:cover; }

.file-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
}

.file-name { font-size:0.85rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-meta { font-size:0.75rem; color:var(--text-tertiary); margin-top:2px; }

.file-actions {
  position: absolute;
  top: 8px; right: 8px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.file-card:hover .file-actions { opacity: 1; }

.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>
