import axios from 'axios'

/**
 * API 客户端
 * - 开发模式（Vite 代理）→ localhost:3000
 * - 生产模式（Pages Functions）→ 同域 /api/*
 *
 * 如果需要指向外部 API，设置 window.__API_BASE__
 */
const API_BASE = window.__API_BASE__ || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false, // 使用 token 不需要 cookie
  // 文件和表单数据不自动序列化
  transformRequest: [(data, headers) => {
    if (data instanceof FormData) return data
    return JSON.stringify(data)
  }]
})

// 请求拦截器 - 添加 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    const data = error.response?.data
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.hash.startsWith('#/admin')) {
        window.location.hash = '#/login'
      }
    }
    return Promise.reject(data || { error: '网络错误' })
  }
)

export default api
