<template>
  <div class="admin-layout">
    <!-- 遮罩层（手机端侧边栏打开时） -->
    <div v-if="sidebarOpen && isMobile" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- 侧边栏 -->
    <aside class="admin-sidebar" :class="{ open: sidebarOpen }">
      <div class="admin-logo">
        <router-link to="/admin" class="admin-logo-link" @click="sidebarOpen = false">
          <span class="logo-icon">📷</span>
          <span class="logo-text">{{ $t('admin.title') }}</span>
        </router-link>
      </div>

      <div class="admin-user-info">
        <el-icon><Avatar /></el-icon>
        <div class="admin-user-detail">
          <span class="admin-user-name">{{ user?.nickname || user?.username }}</span>
          <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
        </div>
      </div>

      <el-menu :default-active="activeMenu" class="admin-menu" @select="handleMenuSelect">
        <el-menu-item index="dashboard"><el-icon><DataBoard /></el-icon><span>{{ $t('admin.dashboard') }}</span></el-menu-item>
        <el-menu-item index="files"><el-icon><Picture /></el-icon><span>{{ $t('admin.files') }}</span></el-menu-item>
        <el-menu-item index="folders"><el-icon><FolderOpened /></el-icon><span>{{ $t('admin.folders') }}</span></el-menu-item>
        <el-menu-item index="users"><el-icon><User /></el-icon><span>{{ $t('admin.users') }}</span></el-menu-item>
        <el-menu-item index="logs"><el-icon><Tickets /></el-icon><span>{{ $t('admin.logs') }}</span></el-menu-item>
        <el-menu-item index="settings"><el-icon><Setting /></el-icon><span>{{ $t('admin.settings') }}</span></el-menu-item>
      </el-menu>

      <div class="admin-sidebar-footer">
        <div class="theme-switch" style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <button class="theme-toggle-btn" @click="themeStore.toggle()" style="width:32px;height:32px;font-size:0.9rem">
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
          <span style="color:var(--text-tertiary);font-size:0.8rem">{{ themeStore.isDark ? '夜间' : '日间' }}</span>
        </div>
        <div class="lang-switch">
          <el-dropdown trigger="click" @command="switchLang">
            <span class="lang-btn"><el-icon><Language /></el-icon><span>{{ currentLang === 'zh-CN' ? '中文' : 'English' }}</span></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN">🇨🇳 中文</el-dropdown-item>
                <el-dropdown-item command="en">🇺🇸 English</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <router-link to="/" class="back-site" @click="sidebarOpen = false">
          <el-icon><ArrowLeft /></el-icon> <span>{{ $t('nav.backHome') }}</span>
        </router-link>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="admin-main">
      <div class="admin-topbar">
        <div class="topbar-left">
          <!-- 手机端汉堡菜单 -->
          <button class="mobile-sidebar-toggle" @click="sidebarOpen = !sidebarOpen" v-if="isMobile">
            <el-icon :size="20"><Operation /></el-icon>
          </button>
          <span class="topbar-title">{{ pageTitle }}</span>
        </div>
        <div class="topbar-right">
          <span class="topbar-user desktop-only">
            <el-icon><Avatar /></el-icon>
            {{ user?.nickname || user?.username }}
            <el-tag :type="roleTagType" size="small" style="margin-left:6px">{{ roleLabel }}</el-tag>
          </span>
          <el-button size="small" text @click="handleLogout" style="color:var(--text-secondary);flex-shrink:0">
            {{ $t('admin.logout') }}
          </el-button>
        </div>
      </div>
      <div class="admin-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { useTheme } from '../../stores/theme'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const route = useRoute()
const { locale, t } = useI18n()
const themeStore = useTheme()
const auth = useAuthStore()

const sidebarOpen = ref(false)
const isMobile = ref(window.innerWidth <= 768)

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) sidebarOpen.value = false
}

onMounted(() => {
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

const user = computed(() => auth.userData)
const isSuperAdmin = computed(() => auth.isSuperAdmin)
const roleLabel = computed(() => {
  const map = { super_admin: t('admin.roleSuperAdmin'), admin: t('admin.roleAdmin'), user: t('admin.roleUser') }
  return map[user.value?.role] || user.value?.role
})
const roleTagType = computed(() => user.value?.role === 'super_admin' ? 'danger' : 'warning')
const activeMenu = computed(() => route.name?.replace('Admin', '').toLowerCase() || 'dashboard')
const pageTitle = computed(() => {
  const map = {
    dashboard: t('admin.dashboard'), files: t('admin.files'), folders: t('admin.folders'),
    users: t('admin.users'), logs: t('admin.logs'), settings: t('admin.settings')
  }
  return map[activeMenu.value] || t('admin.title')
})
const currentLang = computed(() => locale.value)

function switchLang(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}

function handleMenuSelect(index) {
  router.push(`/admin/${index}`)
  if (isMobile.value) sidebarOpen.value = false
}

function handleLogout() {
  ElMessageBox.confirm(t('common.confirm'), t('common.tip'), {
    confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'info'
  }).then(() => {
    auth.logout()
    router.push('/login')
  }).catch(() => {})
}
</script>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; position: relative; }

/* ─── 侧边栏 ─── */
.admin-sidebar {
  width: 240px;
  background: color-mix(in srgb, var(--bg-primary) 95%, transparent);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  z-index: 200;
  transition: transform var(--transition-normal);
}

.admin-logo {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.admin-logo-link {
  display: flex; align-items: center; gap: 8px;
  text-decoration: none; color: var(--text-primary);
}

.admin-logo-link .logo-icon { font-size: 1.5rem; }
.admin-logo-link .logo-text {
  font-size: 1.1rem; font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.admin-user-info {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.admin-user-detail { display: flex; flex-direction: column; gap: 4px; }
.admin-user-name { font-size: 0.9rem; color: var(--text-primary); }
.admin-menu { flex: 1; padding: 8px 0; overflow-y: auto; }

.admin-sidebar-footer {
  padding: 12px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lang-btn {
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem; transition: color var(--transition-fast);
}
.lang-btn:hover { color: var(--primary-light); }

.back-site {
  color: var(--text-tertiary); text-decoration: none;
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem; transition: color var(--transition-fast);
}
.back-site:hover { color: var(--primary-light); }

/* ─── 主内容 ─── */
.admin-main {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.admin-topbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 12px;
}

.topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.topbar-title { font-size: 1.1rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.topbar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.topbar-user { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.9rem; }
.admin-content { padding: 24px; flex: 1; min-width: 0; }

/* ─── 手机端 ─── */
@media (max-width: 768px) {
  .admin-sidebar {
    transform: translateX(-100%);
    width: 260px;
  }

  .admin-sidebar.open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 199;
  }

  .admin-main {
    margin-left: 0;
  }

  .admin-topbar {
    padding: 0 12px;
    height: 52px;
  }

  .admin-content {
    padding: 12px;
  }

  .desktop-only { display: none !important; }

  .mobile-sidebar-toggle {
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-glass);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .mobile-sidebar-toggle:hover {
    background: var(--bg-hover);
    color: var(--primary-light);
  }
}

@media (min-width: 769px) {
  .mobile-sidebar-toggle { display: none !important; }
}

/* 表格在手机端水平滚动（由 global.css 统一处理） */
</style>
