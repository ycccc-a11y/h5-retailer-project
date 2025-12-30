@echo off
chcp 65001 >nul
echo ========================================
echo 连接测试脚本
echo ========================================
echo.

REM 获取IP地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%a
    goto :found
)
:found
set LOCAL_IP=%LOCAL_IP: =%

echo 本机IP地址: %LOCAL_IP%
echo.

echo 测试端口状态...
echo.

REM 测试8080端口
netstat -ano | findstr :8080 >nul
if %errorLevel% equ 0 (
    echo [✓] 前端服务器 (8080) - 正在运行
) else (
    echo [×] 前端服务器 (8080) - 未运行
    echo     请运行: python -m http.server 8080
)

REM 测试5001端口
netstat -ano | findstr :5001 >nul
if %errorLevel% equ 0 (
    echo [✓] 后端API (5001) - 正在运行
) else (
    echo [×] 后端API (5001) - 未运行
    echo     请运行: start_api.bat
)

echo.
echo ========================================
echo 访问地址
echo ========================================
echo 电脑访问: http://localhost:8080
echo 手机访问: http://%LOCAL_IP%:8080
echo.
echo 测试后端API: http://%LOCAL_IP%:5001/api/search/license?page=1^&page_size=1
echo.
echo ========================================
echo 如果手机无法访问，请：
echo 1. 确认手机和电脑在同一WiFi
echo 2. 运行"配置防火墙.bat"（需要管理员权限）
echo 3. 查看"手机无法访问-故障排查.md"
echo ========================================
echo.
pause

