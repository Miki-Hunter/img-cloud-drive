<template>
  <div class="page-container upload-page">
    <div class="upload-hero fade-in">
      <h1 class="section-title" style="text-align:center;font-size:2rem;margin-bottom:8px">
        📤 {{ $t('upload.title') }}
      </h1>
      <p style="text-align:center;color:var(--text-secondary);margin-bottom:32px">
        {{ $t('upload.desc', { size: maxFileSize }) }}
      </p>

      <div class="upload-layout">
        <!-- 上传区域 -->
        <div class="upload-main">
          <el-upload
            ref="uploadRef"
            class="upload-zone"
            drag
            multiple
            :http-request="customUpload"
            :show-file-list="false"
            :accept="allowedTypes"
            :limit="100"
          >
            <el-icon class="upload-icon" :size="48"><UploadFilled /></el-icon>
            <div class="upload-text">
              <p style="font-size:1.1rem;font-weight:500;margin-bottom:8px">
                {{ $t('upload.dragText') }}<em>{{ $t('upload.clickText') }}</em>
              </p>
              <p style="color:var(--text-tertiary);font-size:0.85rem">
                {{ $t('upload.supportedTypes') }}
              </p>
            </div>
          </el-upload>

          <!-- 文件列表 -->
          <div v-if="fileList.length" class="file-list">
            <div v-for="(item, idx) in fileList" :key="item.id" class="glass-card file-list-item">
              <div class="file-list-preview">
                <img v-if="item.file.type.startsWith('image/')" :src="item.preview" />
                <el-icon v-else :size="32"><Document /></el-icon>
              </div>
              <div class="file-list-info">
                <div class="file-list-name">{{ item.file.name }}</div>
                <div class="file-list-size">{{ formatSize(item.file.size) }}</div>
              </div>
              <div class="file-list-status">
                <el-icon v-if="item.status === 'done'" color="#67c23a"><CircleCheck /></el-icon>
                <el-icon v-else-if="item.status === 'error'" color="#f56c6c"><CircleClose /></el-icon>
                <el-progress v-else type="circle" :percentage="item.progress" :width="32" :stroke-width="3" />
              </div>
              <el-button v-if="item.status === 'uploading'" size="small" text type="danger" @click="cancelUpload(idx)">
                <el-icon><Close /></el-icon>
              </el-button>
              <el-button v-else size="small" text @click="removeFile(idx)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 上传结果 -->
          <div v-if="uploadedFiles.length" class="upload-result">
            <div class="result-header">✅ {{ $t('upload.uploadSuccess') }}！</div>
            <div v-for="f in uploadedFiles" :key="f.id" class="result-file-group">
              <div class="result-file-name" :title="f.original_name">{{ formatFileName(f.original_name, 30) }}</div>
              <div class="result-links">
                <div class="result-link-row" :class="{ copied: copiedRow === 'url' }" @click="copyText(f.url, 'url')">
                  <span class="link-icon">🔗</span>
                  <span class="link-label">URL</span>
                  <span class="link-copy-icon">{{ copiedRow === 'url' ? '✅' : '📋' }}</span>
                  <span class="link-copied-tip" v-if="copiedRow === 'url'">{{ $t('gallery.copied') }}</span>
                </div>
                <div class="result-link-row" :class="{ copied: copiedRow === 'md' }" @click="copyText(f.markdown, 'md')">
                  <span class="link-icon">📝</span>
                  <span class="link-label">Markdown</span>
                  <span class="link-copy-icon">{{ copiedRow === 'md' ? '✅' : '📋' }}</span>
                  <span class="link-copied-tip" v-if="copiedRow === 'md'">{{ $t('gallery.copied') }}</span>
                </div>
                <div class="result-link-row" :class="{ copied: copiedRow === 'bb' }" @click="copyText(f.bbcode, 'bb')">
                  <span class="link-icon">🔲</span>
                  <span class="link-label">BBCode</span>
                  <span class="link-copy-icon">{{ copiedRow === 'bb' ? '✅' : '📋' }}</span>
                  <span class="link-copied-tip" v-if="copiedRow === 'bb'">{{ $t('gallery.copied') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 侧边栏选项 -->
        <div class="upload-side">
          <div class="glass-card upload-options">
            <h3 style="margin-bottom:16px">⚙️ {{ $t('upload.options') }}</h3>
            <div class="option-item">
              <label>{{ $t('upload.targetFolder') }}</label>
              <div class="folder-select-row">
                <el-tree-select
                  v-model="selectedFolder"
                  :data="folderTree"
                  :props="{ label: 'name', value: 'id', children: 'children' }"
                  :placeholder="$t('upload.rootDir')"
                  clearable filterable
                  class="glass-input folder-select"
                />
                <button class="folder-add-btn" @click="showNewFolderDialog" :title="$t('admin.newFolder')" type="button">
                  <el-icon :size="16"><FolderAdd /></el-icon>
                </button>
              </div>
            </div>
            <div class="option-item">
              <el-button type="primary" class="glass-btn" style="width:100%;justify-content:center" @click="triggerUpload">
              {{ uploading ? $t('upload.uploading') : $t('upload.startUpload') }}
            </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 新建文件夹弹窗 -->
    <AppDialog v-model="newFolderDialog.visible" :title="$t('admin.newFolder')" :width="400" :close-on-click-overlay="false">
      <el-form @submit.prevent="createNewFolder">
        <el-form-item :label="$t('admin.folderName')">
          <el-input v-model="newFolderDialog.name" :placeholder="$t('admin.folderName')" class="glass-input"
            @keyup.enter="createNewFolder" ref="folderNameInput" />
        </el-form-item>
        <el-form-item :label="$t('admin.parentFolder')" v-if="selectedFolder">
          <el-tag type="info">{{ parentFolderName }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newFolderDialog.visible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" class="glass-btn" @click="createNewFolder">{{ $t('admin.create') }}</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AppDialog from '../components/AppDialog.vue'
import { formatFileName } from '../utils/format'
import api from '../api'

const { t } = useI18n()

const uploadRef = ref(null)
const fileList = ref([])
const uploadedFiles = ref([])
const selectedFolder = ref(null)
const isPrivate = ref(false)
const uploading = ref(false)
const uploadQueue = ref([]) // 上传队列（防止并发丢失）
let isProcessingQueue = false

async function processQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true
  while (uploadQueue.value.length > 0) {
    const item = uploadQueue.value.shift()
    await doUpload(item.file, item.id)
  }
  isProcessingQueue = false
  uploading.value = false
}
const folderTree = ref([])
const maxFileSize = ref(50)
const allowedTypes = ref('')
const abortControllers = ref({})
const newFolderDialog = ref({ visible: false, name: '' })
const copiedRow = ref('')
const folderNameInput = ref(null)

const parentFolderName = computed(() => {
  if (!selectedFolder.value || !folderTree.value.length) return ''
  function findName(list, id) {
    for (const item of list) {
      if (item.id === id) return item.name
      if (item.children) { const n = findName(item.children, id); if (n) return n }
    }
    return ''
  }
  return findName(folderTree.value, selectedFolder.value) || '-'
})

let fileIdCounter = 0

// 显示新建文件夹弹窗
function showNewFolderDialog() {
  newFolderDialog.value.name = ''
  newFolderDialog.value.visible = true
  nextTick(() => folderNameInput.value?.focus?.())
}

// 创建文件夹并选中
async function createNewFolder() {
  const name = newFolderDialog.value.name?.trim()
  if (!name) { ElMessage.warning(t('admin.folderName')); return }
  try {
    const folder = await api.post('/folders', { name, parent_id: selectedFolder.value || null })
    ElMessage.success(t('admin.createSuccess'))
    newFolderDialog.value.visible = false
    // 刷新文件夹树并选中新建的文件夹
    const folders = await api.get('/all-folders')
    folderTree.value = buildTree(folders || [])
    selectedFolder.value = folder.id
  } catch (e) { ElMessage.error(e?.error || t('admin.createFailed')) }
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function buildTree(folders) {
  const map = {}
  const tree = []
  folders.forEach(f => { map[f.id] = { ...f, children: [] } })
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id])
    else if (f.name !== 'root') tree.push(map[f.id])
  })
  return tree
}

onMounted(async () => {
  try {
    const [settings, folders] = await Promise.all([
      api.get('/settings'),
      api.get('/all-folders')
    ])
    maxFileSize.value = settings.max_file_size || 50
    folderTree.value = buildTree(folders || [])
  } catch (e) { console.error(e) }
})

function triggerUpload() {
  uploadRef.value?.$el?.querySelector('input')?.click()
}

async function customUpload(options) {
  const file = options.file
  const id = ++fileIdCounter
  const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''

  fileList.value.push({
    id, file, preview, progress: 0, status: 'queued'
  })

  // 加入队列，按顺序上传
  uploadQueue.value.push({ file, id })
  if (!uploading.value) {
    uploading.value = true
    processQueue()
  }
}

async function doUpload(file, id) {
  const controller = new AbortController()
  abortControllers.value[id] = controller

  try {
    const item = fileList.value.find(f => f.id === id)
    if (item) item.status = 'uploading'

    const formData = new FormData()
    formData.append('files', file)
    if (selectedFolder.value) formData.append('folder_id', selectedFolder.value)
    if (isPrivate.value) formData.append('is_private', '1')

    const res = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: controller.signal,
      onUploadProgress: (e) => {
        const item = fileList.value.find(f => f.id === id)
        if (item) item.progress = Math.round((e.loaded / e.total) * 100)
      }
    })

    const doneItem = fileList.value.find(f => f.id === id)
    if (doneItem) doneItem.status = 'done'

    if (res.files) {
      uploadedFiles.value.push(...res.files)
    }

    ElMessage.success(`${file.name} ${t('upload.uploadSuccess')}`)
  } catch (e) {
    if (e?.code === 'ERR_CANCELED' || e?.message?.includes('cancel')) return
    const errItem = fileList.value.find(f => f.id === id)
    if (errItem) errItem.status = 'error'
    ElMessage.error(e?.error || `${file.name} ${t('upload.uploadFailed')}`)
  }
}

function removeFile(idx) {
  const item = fileList.value[idx]
  if (item.preview) URL.revokeObjectURL(item.preview)
  fileList.value.splice(idx, 1)
}

function cancelUpload(idx) {
  const item = fileList.value[idx]
  if (item && abortControllers.value[item.id]) {
    abortControllers.value[item.id].abort()
    fileList.value.splice(idx, 1)
    ElMessage.warning(`${item.file.name} ${t('common.cancel')}`)
  }
}

function copyText(text, key) {
  copiedRow.value = key || ''
  setTimeout(() => { copiedRow.value = '' }, 1500)
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(t('upload.copied'))
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta)
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    ElMessage.success(t('upload.copied'))
  })
}
</script>

<style scoped>
.upload-hero { padding: 20px 0; }

.upload-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;
}

.upload-main { min-width: 0; }

.upload-zone {
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
}

.upload-icon { margin-bottom: 16px; color: var(--primary-light); }

.upload-text em {
  color: var(--primary-light);
  font-style: normal;
}

.upload-side { position: sticky; top: 80px; }

.upload-options {
  padding: 24px;
}

.option-item {
  margin-bottom: 16px;
}

.option-item label {
  display: block;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.folder-select-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  position: relative;
}

.folder-select {
  flex: 1;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-right: none !important;
}

.folder-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  border: 1px solid var(--border-glass);
  border-left: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.folder-add-btn:hover {
  background: var(--bg-hover);
  color: var(--primary-light);
  border-color: var(--primary-light);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.file-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.file-list-preview {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-list-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-list-info { flex: 1; min-width: 0; }
.file-list-name { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-list-size { font-size: 0.75rem; color: var(--text-tertiary); }

.result-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}

/* ─── 上传结果全新卡片样式 ─── */
.upload-result {
  padding: 20px;
}

.result-header {
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.result-file-group {
  margin-bottom: 12px;
}

.result-file-name {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-link-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.result-link-row:hover,
.result-link-row:active {
  background: var(--bg-hover);
  border-color: var(--primary-light);
}

.link-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.link-label {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

.link-copy-icon {
  font-size: 1rem;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity var(--transition-fast);
}

.result-link-row:hover .link-copy-icon,
.result-link-row:active .link-copy-icon {
  opacity: 1;
}

.result-link-row.copied {
  border-color: var(--primary-light);
  background: rgba(79, 70, 229, 0.1);
}

.link-copied-tip {
  font-size: 0.7rem;
  color: var(--primary-light);
  flex-shrink: 0;
  white-space: nowrap;
  animation: fadeIn 0.2s ease;
}

@media (max-width: 768px) {
  .upload-layout {
    grid-template-columns: 1fr;
  }
  .upload-side {
    position: static;
  }
  /* 上传结果区手机端美化 */
  .result-actions {
    flex-direction: column;
    gap: 6px;
  }
  .result-actions .el-button {
    width: 100%;
    justify-content: center;
  }
  .upload-result {
    padding: 14px !important;
  }
  .result-item {
    padding: 10px 0 !important;
  }
  .result-name {
    font-size: 0.8rem !important;
    margin-bottom: 8px !important;
    word-break: break-all;
  }
}
</style>
