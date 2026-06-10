#!/bin/bash
# Cloud Drive - 一键启动脚本 (Linux/Mac)

set -e

echo ""
echo "============================================"
echo "   📷 Cloud Drive 图片网盘 - 正在启动"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 https://nodejs.org"
    exit 1
fi
echo "[OK] Node.js $(node -v)"

DIR="$(cd "$(dirname "$0")" && pwd)"

# Install backend deps
echo ""
echo "[1/4] 安装后端依赖..."
cd "$DIR/backend"
[ -d "node_modules" ] && echo "   已就绪" || npm install

# Install frontend deps
echo ""
echo "[2/4] 安装前端依赖..."
cd "$DIR/frontend"
[ -d "node_modules" ] && echo "   已就绪" || npm install

# Build frontend
echo ""
echo "[3/4] 构建前端..."
cd "$DIR/frontend"
npm run build
echo "[OK] 前端构建完成"

# Start backend
echo ""
echo "[4/4] 启动服务..."
cd "$DIR/backend"

# Kill existing
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start
node src/index.js &
sleep 4

# Get IP
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "============================================"
echo "   ✅ 服务已启动！"
echo "============================================"
echo ""
echo "  本地访问:   http://localhost:3000"
echo "  手机访问:   http://$IP:3000"
echo "  管理后台:   http://localhost:3000/#/admin"
echo ""
echo "  管理员:     admin / (see console output for password)"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "============================================"
echo ""

wait
