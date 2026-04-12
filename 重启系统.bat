@echo off
echo ========================================
echo 正在重启进销存系统...
echo ========================================

echo 1. 结束所有相关进程...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM chrome.exe /T >nul 2>&1

timeout /t 3 /nobreak >nul

cd /d "D:\ai\Microsoft VS Code\jiaoben\进销存系统"

echo 2. 清理缓存...
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist .vite rmdir /s /q .vite

echo 3. 启动系统...
start "进销存系统" cmd /k "npm run electron:serve"

echo ========================================
echo 系统正在启动中...
echo 请等待 Electron 窗口自动打开
echo ========================================

pause