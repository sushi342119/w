@echo off
chcp 65001 >nul
title 搬砖记 - 本地服务器
echo.
echo ======================================
echo   搬砖记 App - 本地服务器启动中...
echo ======================================
echo.

cd /d "%~dp0"

REM 尝试 Python 3
python --version >nul 2>&1
if %errorlevel%==0 (
    echo 使用 Python 启动服务器...
    echo.
    echo 浏览器请访问: http://localhost:8888
    echo 手机同一WiFi请访问: http://[本机IP]:8888
    echo.
    echo 按 Ctrl+C 退出
    echo ======================================
    start http://localhost:8888
    python -m http.server 8888
    goto :end
)

REM 尝试 Node
node --version >nul 2>&1
if %errorlevel%==0 (
    where npx >nul 2>&1
    if %errorlevel%==0 (
        echo 使用 Node 启动服务器...
        echo.
        echo 浏览器访问: http://localhost:8888
        echo.
        start http://localhost:8888
        npx --yes http-server -p 8888 -c-1
        goto :end
    )
)

echo [错误] 未检测到 Python 或 Node.js
echo 请先安装 Python (https://www.python.org) 或 Node.js (https://nodejs.org)
echo.
echo 或者直接双击 index.html 在浏览器中打开（PWA功能将受限）
pause

:end
