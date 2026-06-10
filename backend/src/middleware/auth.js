const jwt = require('jsonwebtoken');
const config = require('../../config');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录', needLogin: true });
  }
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期', needLogin: true });
  }
}

function adminMiddleware(req, res, next) {
  if (!['super_admin', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // ignore invalid token
    }
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth };
