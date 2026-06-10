@echo off
title Cloud Drive
cd /d "%~dp0"

:: Check Node
node -v >nul 2>&1 || (echo Node.js not found & pause & exit /b)

:: Fast path: skip if already built
if not exist "frontend\node_modules" (
    echo [1/2] Installing dependencies...
    cd backend && call npm install --no-fund --no-audit && cd ..
    cd frontend && call npm install --no-fund --no-audit && cd ..
)
if not exist "frontend\dist\index.html" (
    echo [2/2] Building frontend...
    cd frontend && call npm run build && cd ..
)

:: Kill old server
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1

:: Start
start /B node backend\src\index.js
timeout /t 2 /nobreak >nul

:: Get IP - just grab the first 192.168 address from ipconfig
set IP=127.0.0.1
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "192.168"') do (
    set "IP=%%a"
    goto :found
)
:found
set IP=%IP: =%

cls
echo ============================================
echo    Cloud Drive is running!
echo ============================================
echo.
echo    Local:    http://localhost:3000
echo    Mobile:   http://%IP%:3000
echo    Admin:    http://localhost:3000/#/admin
echo.
echo    Login:    admin / (see console output for password)
echo.
echo    Close this window to stop.
echo ============================================
echo.
pause
