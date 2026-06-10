<template>
  <div class="dashboard-page fade-in">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><Picture /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.totalFiles }}</div>
          <div class="stat-label">文件总数</div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><Folder /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.totalFolders }}</div>
          <div class="stat-label">文件夹数</div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><User /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">用户数</div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><DataBoard /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ formatSize(stats.totalSize) }}</div>
          <div class="stat-label">总存储</div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><UploadFilled /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ stats.todayUploads }}</div>
          <div class="stat-label">今日上传</div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-icon"><el-icon :size="28"><DataAnalysis /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ formatSize(stats.todaySize) }}</div>
          <div class="stat-label">今日流量</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-grid">
      <div class="glass-card chart-card">
        <h3 class="chart-title">📊 最近7天上传统计</h3>
        <div v-if="stats.weeklyUploads?.length" class="chart-bars">
          <div v-for="item in stats.weeklyUploads" :key="item.date" class="chart-bar-wrap">
            <div class="chart-bar" :style="{ height: barHeight(item.count) + '%' }">
              <span class="chart-bar-value">{{ item.count }}</span>
            </div>
            <div class="chart-bar-label">{{ formatDate(item.date) }}</div>
          </div>
        </div>
        <div v-else class="chart-empty">暂无数据</div>
      </div>
      <div class="glass-card chart-card">
        <h3 class="chart-title">📦 文件类型分布</h3>
        <div v-if="stats.typeDistribution?.length" class="type-list">
          <div v-for="item in stats.typeDistribution" :key="item.type" class="type-item">
            <div class="type-label">
              <span>{{ item.type }}</span>
              <span>{{ item.count }} 个</span>
            </div>
            <el-progress
              :percentage="typePercentage(item.count)"
              :stroke-width="12"
              :color="typeColor(item.type)"
              striped
            />
          </div>
        </div>
        <div v-else class="chart-empty">暂无数据</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../api'

const stats = ref({
  totalFiles: 0, totalSize: 0, totalUsers: 0, totalFolders: 0,
  todayUploads: 0, todaySize: 0,
  weeklyUploads: [], typeDistribution: []
})

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function formatDate(d) {
  if (!d) return ''
  const parts = d.split('-')
  return `${parts[1]}/${parts[2]}`
}

function barHeight(count) {
  const max = Math.max(...(stats.value.weeklyUploads?.map(i => i.count) || [1]), 1)
  return (count / max) * 100
}

function typePercentage(count) {
  const total = stats.value.typeDistribution?.reduce((s, i) => s + i.count, 0) || 1
  return (count / total) * 100
}

function typeColor(type) {
  const colors = {
    '图片': '#4f46e5',
    '视频': '#7c3aed',
    '音频': '#ec4899',
    '文本': '#06b6d4',
    'PDF': '#f59e0b',
    '其他': '#6b7280'
  }
  return colors[type] || '#6b7280'
}

onMounted(async () => {
  try {
    stats.value = await api.get('/admin/dashboard')
  } catch (e) { console.error(e) }
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.stat-icon { color: var(--primary-light); }

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.chart-card {
  padding: 24px;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr !important;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10px !important;
  }
  .stat-card {
    padding: 14px !important;
    gap: 10px !important;
  }
}

.chart-title {
  font-size: 1rem;
  margin-bottom: 20px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 200px;
  padding-top: 20px;
}

.chart-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.chart-bar {
  width: 100%;
  max-width: 40px;
  background: var(--gradient-primary);
  border-radius: 6px 6px 0 0;
  min-height: 4px;
  position: relative;
  transition: height 0.6s ease;
  cursor: pointer;
}

.chart-bar:hover {
  opacity: 0.8;
}

.chart-bar-value {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.chart-bar-label {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.chart-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.type-item {}

.type-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
