// 配置文件
module.exports = {
  // 服务端口
  PORT: process.env.PORT || 3000,

  // JWT 密钥：生产环境必须通过环境变量注入
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production!')
    }
    return 'dev-only-do-not-use-in-prod'
  })(),

  // 数据库路径
  DB_PATH: process.env.DB_PATH || './database/cloud-drive.db',

  // 上传目录
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',

  // 默认管理员账号
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  // 首次启动随机生成密码并打印到控制台
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_PASSWORD must be set in production!')
    }
    return 'admin123'  // 仅 dev 默认
  })(),

  // 文件大小限制 (50MB)
  MAX_FILE_SIZE: 50 * 1024 * 1024,

  // 允许的文件类型
  ALLOWED_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/tiff',
    'application/pdf', 'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/wav'
  ],

  // 分页默认值
  PAGE_SIZE: 24,

  // HTTPS (使用自签名证书，用于手机端测试)
  // 设为 true 后通过 https://localhost:3001 访问
  HTTPS: process.env.HTTPS === 'true',
  HTTPS_PORT: process.env.HTTPS_PORT || 3001,
};
