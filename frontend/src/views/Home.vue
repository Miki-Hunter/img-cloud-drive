<template>
  <div class="page-container home-page">
    <!-- Hero 区域 -->
    <section class="hero-section fade-in">
      <div class="hero-content">
        <h1 class="hero-title">{{ appStore.settings.site_name || '📷 图片网盘' }}</h1>
        <p class="hero-desc">{{ appStore.settings.site_description || '免费图片托管与分享平台' }}</p>
        <div class="hero-actions">
          <router-link to="/upload" class="glass-btn hero-btn">
            <el-icon style="margin-right:6px"><Upload /></el-icon>
            {{ $t('home.uploadNow') }}
          </router-link>
          <router-link to="/gallery" class="glass-btn-outline hero-btn">
            <el-icon style="margin-right:6px"><FolderOpened /></el-icon>
            {{ $t('home.browseGallery') }}
          </router-link>
        </div>
      </div>
    </section>

    <!-- 统计信息 -->
    <section class="stats-section fade-in" style="animation-delay:0.1s">
      <div class="stats-grid">
        <div class="glass-card stat-card">
          <div class="stat-icon"><el-icon :size="32"><Picture /></el-icon></div>
          <div class="stat-value">{{ stats.totalFiles }}</div>
          <div class="stat-label">{{ $t('home.totalFiles') }}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-icon"><el-icon :size="32"><Folder /></el-icon></div>
          <div class="stat-value">{{ stats.totalFolders }}</div>
          <div class="stat-label">{{ $t('home.totalFolders') }}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-icon"><el-icon :size="32"><DataBoard /></el-icon></div>
          <div class="stat-value">{{ formatSize(stats.totalSize) }}</div>
          <div class="stat-label">{{ $t('home.totalSize') }}</div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-icon"><el-icon :size="32"><UploadFilled /></el-icon></div>
          <div class="stat-value">{{ stats.todayUploads }}</div>
          <div class="stat-label">{{ $t('home.todayUploads') }}</div>
        </div>
      </div>
    </section>

    <!-- 最近上传 -->
    <section class="section fade-in" style="animation-delay:0.2s">
      <div class="section-header">
        <h2 class="section-title">📸 {{ $t('home.recentUploads') }}</h2>
        <router-link to="/gallery" class="view-all">{{ $t('home.viewAll') }}</router-link>
      </div>
      <div v-if="recentFiles.length" class="glass-grid">
        <div v-for="file in recentFiles" :key="file.id" class="file-card glass-card" @click="openFile(file.id)">
          <img :src="file.thumbnail_url" :alt="file.original_name" class="file-thumb" @error="onImgError" />
          <div class="file-overlay">
            <div class="file-name" :title="file.original_name">{{ formatFileName(file.original_name, 15) }}</div>
            <div class="file-meta">{{ formatSize(file.size) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <el-icon><Picture /></el-icon>
        <p>{{ $t('home.noFiles') }}</p>
      </div>
    </section>

    <!-- 文件夹快速入口 -->
    <section class="section fade-in" style="animation-delay:0.3s">
      <div class="section-header">
        <h2 class="section-title">📂 {{ $t('home.folders') }}</h2>
        <router-link to="/gallery" class="view-all">{{ $t('home.viewAll') }}</router-link>
      </div>
      <div v-if="rootFolders.length" class="glass-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
        <div v-for="folder in rootFolders" :key="folder.id" class="glass-card folder-card" @click="openFolder(folder.id)">
          <div class="folder-icon">
            <el-icon :size="48"><FolderOpened /></el-icon>
          </div>
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-count">{{ folder.file_count || 0 }} {{ $t('gallery.files') }}</div>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:20px">
        <p>{{ $t('home.noFolders') }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { formatFileName } from '../utils/format'
import api from '../api'

const router = useRouter()
const appStore = useAppStore()

const stats = ref({ totalFiles: 0, totalFolders: 0, totalSize: 0, todayUploads: 0 })
const recentFiles = ref([])
const rootFolders = ref([])

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function onImgError(e) {
  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23333" width="200" height="200"/><text x="50%" y="50%" fill="%23666" font-size="40" text-anchor="middle" dy=".3em">📄</text></svg>'
}

function openFile(id) { router.push(`/file/${id}`) }
function openFolder(id) { router.push(`/gallery/${id}`) }

onMounted(async () => {
  try {
    const [filesRes, foldersRes] = await Promise.all([
      api.get('/files', { params: { page: 1, page_size: 12, sort: 'created_at', order: 'desc' } }),
      api.get('/folders', { params: { parent_id: null } })
    ])
    recentFiles.value = filesRes.files || []
    rootFolders.value = foldersRes || []
  } catch (e) { console.error(e) }

  // 简单统计
  try {
    const adminToken = localStorage.getItem('token')
    if (adminToken) {
      const dash = await api.get('/admin/dashboard')
      stats.value = dash
    } else {
      // 未登录时的统计通过计算
      stats.value.totalFiles = recentFiles.value.length
      stats.value.totalFolders = rootFolders.value.length
    }
  } catch(e) {}
})
</script>

<style scoped>
.hero-section {
  text-align: center;
  padding: 60px 20px 40px;
}

.hero-title {
  font-size: 2.8rem;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #818cf8, #c084fc, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  color: var(--text-secondary);
  font-size: 1.15rem;
  margin-bottom: 32px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-btn {
  padding: 14px 32px;
  font-size: 1rem;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  text-align: center;
  padding: 24px 16px;
}

.stat-icon { margin-bottom: 12px; opacity: 0.8; }
.stat-value { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
.stat-label { color: var(--text-tertiary); font-size: 0.9rem; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.view-all {
  color: var(--text-accent);
  text-decoration: none;
  font-size: 0.9rem;
  transition: opacity var(--transition-fast);
}
.view-all:hover { opacity: 0.8; }

.section {
  margin-bottom: 40px;
}

.file-card {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
}

.file-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.file-card:hover .file-thumb {
  transform: scale(1.08);
}

.file-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
}

.file-name {
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.folder-card {
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
}

.folder-icon { margin-bottom: 12px; color: var(--text-accent); }
.folder-name { font-weight: 600; margin-bottom: 4px; }
.folder-count { color: var(--text-tertiary); font-size: 0.85rem; }

@media (max-width: 768px) {
  .hero-title { font-size: 2rem; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
