import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN.js'
import en from './en.js'

// 检测语言：优先 localStorage，其次浏览器语言
function getLocale() {
  const saved = localStorage.getItem('locale')
  if (saved) return saved
  const browserLang = navigator.language || navigator.userLanguage
  if (browserLang.startsWith('zh')) return 'zh-CN'
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en': en
  }
})

export default i18n
