@echo off
chcp 65001 >nul
echo ========================================
echo 手机测试配置脚本
echo ========================================
echo.

REM 获取本机IP地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%a
    goto :found
)
:found
set LOCAL_IP=%LOCAL_IP: =%
echo 检测到本机IP地址: %LOCAL_IP%
echo.

REM 替换api.js中的localhost
echo 正在更新api.js配置文件...
powershell -Command "(Get-Content api.js) -replace 'localhost:5001', '%LOCAL_IP%:5001' | Set-Content api.js"
echo 配置完成！
echo.
echo ========================================
echo 配置信息
echo ========================================
echo 前端访问地址: http://%LOCAL_IP%:8080
echo 后端API地址: http://%LOCAL_IP%:5001
echo.
echo 请确保：
echo 1. 后端API已启动（运行 start_api.bat）
echo 2. 前端服务器已启动（运行 python -m http.server 8080）
echo 3. 手机和电脑在同一WiFi网络
echo.
pause

