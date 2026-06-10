<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- 左侧 Logo（手机端只显示图标） -->
      <div class="header-left">
        <router-link to="/" class="logo">
          <span class="logo-icon">📷</span>
          <span class="logo-text">{{ appStore.settings.site_name || 'Cloud Drive' }}</span>
        </router-link>
      </div>

      <!-- 中间导航（手机端只显示图标） -->
      <nav class="header-nav">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <el-icon><HomeFilled /></el-icon>
          <span class="nav-label">{{ $t('nav.home') }}</span>
        </router-link>
        <router-link to="/gallery" class="nav-item" :class="{ active: $route.path.startsWith('/gallery') }">
          <el-icon><FolderOpened /></el-icon>
          <span class="nav-label">{{ $t('nav.browse') }}</span>
        </router-link>
        <router-link to="/search" class="nav-item" :class="{ active: $route.path === '/search' }">
          <el-icon><Search /></el-icon>
          <span class="nav-label">{{ $t('nav.search') }}</span>
        </router-link>
        <router-link to="/upload" class="nav-item upload-btn" :class="{ active: $route.path === '/upload' }">
          <el-icon><Upload /></el-icon>
          <span class="nav-label">{{ $t('nav.upload') }}</span>
        </router-link>
      </nav>

      <!-- 右侧：电脑端全部显示，手机端折叠到汉堡菜单 -->
      <div class="header-right">
        <!-- 电脑端显示：主题 + 语言 -->
        <div class="desktop-only">
          <button class="theme-toggle-btn" @click="themeStore.toggle()" :title="themeStore.isDark ? '☀️' : '🌙'">
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
          <el-dropdown trigger="click" @command="switchLang">
            <span class="nav-item">
              <el-icon><Language /></el-icon>
              <span>{{ currentLang }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN">🇨🇳 中文</el-dropdown-item>
                <el-dropdown-item command="en">🇺🇸 English</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 电脑端：登录/用户 -->
        <div class="desktop-only">
          <template v-if="auth.isLoggedIn">
            <el-dropdown trigger="click" @command="handleCommand">
              <span class="nav-item user-dropdown">
                <el-icon><Avatar /></el-icon>
                <span>{{ auth.nickname }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="admin" v-if="auth.isAdmin">
                    <el-icon><Setting /></el-icon> {{ $t('nav.admin') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="logout">
                    <el-icon><SwitchButton /></el-icon> {{ $t('nav.logout') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <router-link v-else to="/login" class="nav-item">
            <el-icon><User /></el-icon>
            <span>{{ $t('nav.login') }}</span>
          </router-link>
        </div>

        <!-- 手机端：汉堡菜单 -->
        <div class="mobile-only">
          <el-dropdown trigger="click" placement="bottom-end">
            <button class="mobile-menu-btn">
              <el-icon :size="22"><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <!-- 主题 -->
                <el-dropdown-item @click="themeStore.toggle()">
                  {{ themeStore.isDark ? '☀️' : '🌙' }} {{ themeStore.isDark ? '日间模式' : '夜间模式' }}
                </el-dropdown-item>
                <!-- 语言 -->
                <el-dropdown-item command="zh-CN" @click="switchLang('zh-CN')">🇨🇳 中文</el-dropdown-item>
                <el-dropdown-item command="en" @click="switchLang('en')">🇺🇸 English</el-dropdown-item>
                <el-dropdown-item divided v-if="auth.isLoggedIn && auth.isAdmin" command="admin" @click="handleCommand('admin')">
                  <el-icon><Setting /></el-icon> {{ $t('nav.admin') }}
                </el-dropdown-item>
                <el-dropdown-item v-if="auth.isLoggedIn" command="logout" @click="handleCommand('logout')">
                  <el-icon><SwitchButton /></el-icon> {{ $t('nav.logout') }}
                </el-dropdown-item>
                <el-dropdown-item v-else command="login" @click="handleCommand('login')">
                  <el-icon><User /></el-icon> {{ $t('nav.login') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app'
import { useTheme } from '../stores/theme'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const { locale } = useI18n()
const appStore = useAppStore()
const themeStore = useTheme()
const auth = useAuthStore()

const currentLang = computed(() => locale.value === 'zh-CN' ? '中文' : 'EN')

function switchLang(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}

function handleCommand(cmd) {
  if (cmd === 'admin') router.push('/admin')
  else if (cmd === 'login') router.push('/login')
  else if (cmd === 'logout') {
    auth.logout()
    router.push('/')
  }
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left { display: flex; align-items: center; flex-shrink: 0; }

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-primary);
}

.logo-icon { font-size: 1.6rem; }

.logo-text {
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  justify-content: center;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all var(--transition-fast);
  cursor: pointer;
  white-space: nowrap;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-item.active {
  color: var(--text-primary);
  background: rgba(79, 70, 229, 0.2);
}

.upload-btn {
  background: var(--gradient-primary);
  color: white !important;
  padding: 8px 18px;
}

.upload-btn:hover {
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── 手机端隐藏/显示控制 ─── */
.desktop-only { display: flex; align-items: center; gap: 4px; }
.mobile-only { display: none; }

.mobile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-glass);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mobile-menu-btn:hover {
  background: var(--bg-hover);
  color: var(--primary-light);
}

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only { display: flex; }

  .header-inner {
    padding: 0 10px;
    height: 52px;
    gap: 6px;
  }

  .logo-icon { font-size: 1.3rem; }
  .logo-text { display: none; }

  .header-nav .nav-item {
    padding: 6px 8px;
    gap: 0;
  }

  .header-nav .nav-label {
    display: none;
  }

  .upload-btn {
    padding: 6px 10px;
  }
}

@media (max-width: 400px) {
  .header-nav .nav-item {
    padding: 6px 6px;
  }
}
</style>
