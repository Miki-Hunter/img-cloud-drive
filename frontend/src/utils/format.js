/**
 * 文件名字智能截断：
 * - 始终保留后缀（.jpg, .png 等）
 * - 超出 maxLen 时，名称部分用 ... 代替
 * - 后缀不足4字符时整体保留（如 .js, .py）
 * - 后缀超过4字符也保留（如 .jpeg, .webp）
 */

// UTC → 北京时间 (UTC+8)，格式: YYYY-MM-DD HH:mm
export function formatBeijingTime(utcStr) {
  if (!utcStr) return ''
  // D1 返回的格式为 "2026-06-07T12:34:56" 或 "2026-06-07 12:34:56" (UTC)
  const normalized = utcStr.replace('T', ' ')
  const date = new Date(normalized + '+00:00') // 明确当作 UTC 解析
  if (isNaN(date.getTime())) return normalized.substring(0, 16)
  const bj = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = bj.getUTCFullYear()
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const min = String(bj.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export function formatFileName(name, maxLen = 20) {
  if (!name || name.length <= maxLen) return name

  const dotIndex = name.lastIndexOf('.')
  if (dotIndex === -1) {
    // 没有后缀，直接截断
    return name.substring(0, maxLen - 3) + '...'
  }

  const ext = name.substring(dotIndex) // 包含 .
  const base = name.substring(0, dotIndex)

  // 如果后缀本身就很长，允许后缀完整显示
  if (ext.length >= 8) {
    // 后缀太长也截断
    return name.substring(0, maxLen - 3) + '...'
  }

  // 保留后缀，截断名称部分
  const maxBase = Math.max(maxLen - ext.length - 3, 4) // 至少保留4个字符+...
  if (base.length <= maxBase) return name // 名称本身不长

  return base.substring(0, maxBase) + '...' + ext
}
