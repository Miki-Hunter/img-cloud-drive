<template>
  <div class="page-container detail-page fade-in">
    <div v-if="loading" class="empty-state" style="padding:80px 0">
      <el-icon><Loading /></el-icon>
      <p>{{ $t('detail.loading') }}</p>
    </div>

    <template v-else-if="file">
      <div class="breadcrumb-bar">
        <router-link to="/" class="breadcrumb-item">{{ $t('nav.home') }}</router-link>
        <span class="breadcrumb-sep">›</span>
        <router-link to="/gallery" class="breadcrumb-item">{{ $t('nav.browse') }}</router-link>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-item current">{{ file.original_name }}</span>
      </div>

      <div class="detail-layout">
        <div class="detail-preview">
          <div class="glass-card image-frame">
            <img :src="file.raw_url" :alt="file.original_name" class="detail-image" />
          </div>
        </div>

        <div class="detail-sidebar">
          <div class="glass-card detail-info">
            <h2 class="detail-title" :title="file.original_name">{{ formatFileName(file.original_name, 40) }}</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">{{ $t('detail.fileSize') }}</span>
                <span class="info-value">{{ formatSize(file.size) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('detail.fileType') }}</span>
                <span class="info-value">{{ file.mime_type }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('detail.uploadTime') }}</span>
                <span class="info-value">{{ formatBeijingTime(file.created_at) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('detail.uploader') }}</span>
                <span class="info-value">{{ file.uploader_username || file.uploader_name || $t('detail.anonymous') }}</span>
              </div>
            </div>

            <div class="link-section">
              <h3 style="margin-bottom:12px;font-size:1rem">🔗 {{ $t('detail.links') }}</h3>
              <div class="link-item" v-for="(val, key) in linkTypes" :key="key">
                <label>{{ key }}</label>
                <div class="link-row">
                  <code>{{ val }}</code>
                  <el-button size="small" @click="copyText(val)">{{ $t('gallery.copyLink') }}</el-button>
                </div>
              </div>
            </div>

            <div class="detail-actions">
              <el-button class="glass-btn" style="width:100%;justify-content:center" @click="downloadFile">
                <el-icon><Download /></el-icon> {{ $t('detail.download') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <el-icon><WarningFilled /></el-icon>
      <p>{{ $t('detail.notFound') }}</p>
      <router-link to="/" class="glass-btn" style="display:inline-block;margin-top:12px;text-decoration:none">
        {{ $t('nav.backHome') }}
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { formatFileName, formatBeijingTime } from '../utils/format'
import api from '../api'

const route = useRoute()
const file = ref(null)
const loading = ref(true)

const linkTypes = computed(() => {
  if (!file.value) return {}
  return {
    '原始链接': file.value.raw_url,
    '下载链接': file.value.url,
    'Markdown': file.value.markdown,
    'HTML': file.value.html,
    'BBCode': file.value.bbcode
  }
})

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function formatTime(t) {
  if (!t) return ''
  return t.replace('T', ' ').substring(0, 19)
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制')).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta)
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    ElMessage.success('已复制')
  })
}

function downloadFile() {
  if (file.value?.url) window.open(file.value.url, '_blank')
}

onMounted(async () => {
  try {
    file.value = await api.get(`/files/${route.params.id}`)
  } catch (e) {
    file.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  margin-top: 16px;
}

.detail-preview { min-width: 0; }

.image-frame {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
}

.detail-sidebar { position: sticky; top: 80px; }

.detail-info { padding: 24px; }

.detail-title {
  font-size: 1.2rem;
  margin-bottom: 20px;
  word-break: break-all;
}

.info-grid { margin-bottom: 20px; }

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-label { color: var(--text-tertiary); font-size: 0.85rem; }
.info-value { font-size: 0.85rem; }

.link-section {
  margin-bottom: 20px;
}

.link-item { margin-bottom: 10px; }

.link-item label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.link-row {
  display: flex;
  gap: 8px;
}

.link-row code {
  flex: 1;
  padding: 6px 10px;
  background: rgba(0,0,0,0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--text-secondary);
}

.breadcrumb-sep { color: var(--text-tertiary); margin: 0 4px; }

@media (max-width: 768px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
  .detail-sidebar { position: static; }
}
</style>
