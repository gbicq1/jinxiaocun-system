@echo off
echo 清理并重新编译系统
taskkill /F /IM electron.exe
cd /d %~dp0..
if exist dist rmdir /s /q dist
del /q electron*.js
call npm run electron:dev
