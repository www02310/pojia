@echo off
chcp 65001 >nul 2>&1
title DSH Splash - Uninstall
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
