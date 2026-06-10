<template>
  <div class="admin-logs fade-in">
    <!-- 筛选 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="filters.ip" placeholder="IP 地址" clearable class="glass-input filter-input" @clear="loadLogs">
          <template #prefix><el-icon><Monitor /></el-icon></template>
        </el-input>
        <el-input v-model="filters.username" placeholder="用户名" clearable class="glass-input filter-input" @clear="loadLogs">
          <template #prefix><el-icon><User /></el-icon></template>
        </el-input>
        <el-button class="glass-btn" @click="loadLogs">
          <el-icon><Search /></el-icon> 筛选
        </el-button>
      </div>
    </div>

    <!-- 上传日志 -->
    <div class="glass-card table-wrap">
      <el-table :data="logs" stripe v-loading="loading" :max-height="600">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatBeijingTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="文件名" min-width="200">
          <template #default="{ row }">{{ row.file_name }}</template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.file_size) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">{{ row.mime_type?.split('/')[1] }}</template>
        </el-table-column>
        <el-table-column label="用户名" width="120">
          <template #default="{ row }">{{ row.username || '匿名' }}</template>
        </el-table-column>
        <el-table-column label="IP 地址" width="140">
          <template #default="{ row }">{{ row.uploader_ip }}</template>
        </el-table-column>
        <el-table-column label="User Agent" min-width="200">
          <template #default="{ row }">
            <div class="ua-text">{{ row.user_agent || '-' }}</div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadLogs"
        background
        small
      />
    </div>
  </div>
</template>

<script setup>
import { formatBeijingTime } from '../../utils/format'
import { ref, onMounted } from 'vue'
import api from '../../api'

const logs = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 30
const pagination = ref({ total: 0 })

const filters = ref({ ip: '', username: '' })

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

async function loadLogs() {
  loading.value = true
  try {
    const res = await api.get('/admin/logs', {
      params: {
        page: currentPage.value,
        page_size: pageSize,
        ip: filters.value.ip || undefined,
        username: filters.value.username || undefined
      }
    })
    logs.value = res.logs || []
    pagination.value = res.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(loadLogs)
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filter-input { width: 180px; }

.table-wrap { overflow: hidden; }

.ua-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .toolbar-left {
    flex-direction: column !important;
  }
  .filter-input {
    width: 100% !important;
  }
}
</style>
