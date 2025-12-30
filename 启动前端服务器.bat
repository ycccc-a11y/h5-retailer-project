@echo off
chcp 65001 >nul
echo ========================================
echo 启动前端HTTP服务器
echo ========================================
echo.
echo 服务器将在端口 8080 启动
echo 请在浏览器访问显示的地址
echo.
echo 按 Ctrl+C 停止服务器
echo.
python -m http.server 8080

