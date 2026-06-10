import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTheme = defineStore('theme', () => {
  const mode = ref('dark') // 'dark' | 'light'

  const isDark = computed(() => mode.value === 'dark')

  function init() {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') {
      mode.value = saved
    } else {
      // 默认跟随系统
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      mode.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', mode.value)
    applyTheme()
  }

  function setTheme(val) {
    mode.value = val
    localStorage.setItem('theme', val)
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', mode.value)
  }

  return { mode, isDark, init, toggle, setTheme }
})
