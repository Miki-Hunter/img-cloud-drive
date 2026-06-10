import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userData = ref(loadUser())

  function loadUser() {
    try { return JSON.parse(localStorage.getItem('user') || '{}') }
    catch { return {} }
  }

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => ['super_admin', 'admin'].includes(userData.value?.role))
  const isSuperAdmin = computed(() => userData.value?.role === 'super_admin')
  const nickname = computed(() => userData.value?.nickname || userData.value?.username || '')

  function setAuth(t, u) {
    token.value = t
    userData.value = u
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
  }

  function logout() {
    token.value = ''
    userData.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { token, userData, isLoggedIn, isAdmin, isSuperAdmin, nickname, setAuth, logout }
})
