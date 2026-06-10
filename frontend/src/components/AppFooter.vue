<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="footer-left">
        <span class="live-clock" :title="'UTC: ' + utcTime">
          <el-icon style="margin-right:4px;vertical-align:-1px"><Clock /></el-icon>
          <span class="clock-time">{{ clockTime }}</span>
          <span class="clock-label">{{ $t('footer.beijingTime') }}</span>
        </span>
      </div>
      <div class="footer-center">
        <span>{{ appStore.settings.footer_text || 'Cloud Drive © 2026' }}</span>
      </div>
      <div class="footer-right">
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="footer-link">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right:4px">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>GitHub</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app'

const { t } = useI18n()
const appStore = useAppStore()

const GITHUB_URL = 'https://github.com/Miki-Hunter'
const githubUrl = appStore.settings.github_url || GITHUB_URL

// 实时时钟
const clockTime = ref('')
const utcTime = ref('')
let timer = null

function updateClock() {
  const now = new Date()
  utcTime.value = now.toISOString().substring(0, 19).replace('T', ' ')
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const m = String(bj.getUTCMinutes()).padStart(2, '0')
  const s = String(bj.getUTCSeconds()).padStart(2, '0')
  clockTime.value = `${h}:${m}:${s}`
}

onMounted(() => { updateClock(); timer = setInterval(updateClock, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.app-footer {
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
  backdrop-filter: blur(10px);
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 0.8rem;
  gap: 16px;
}

.live-clock {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.clock-time {
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.clock-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  opacity: 0.7;
}

.footer-center { text-align: center; }

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.footer-link:hover { color: var(--primary-light); }

@media (max-width: 768px) {
  .footer-inner { flex-direction: column; gap: 6px; text-align: center; padding: 10px 16px; }
}
</style>
