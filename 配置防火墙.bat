@echo off
chcp 65001 >nul
echo ========================================
echo Windows防火墙配置脚本
echo ========================================
echo.
echo 此脚本将配置防火墙，允许8080和5001端口访问
echo 需要管理员权限
echo.
pause

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 错误：需要管理员权限！
    echo 请右键点击此文件，选择"以管理员身份运行"
    pause
    exit /b 1
)

echo.
echo 正在配置防火墙规则...
echo.

REM 添加8080端口规则
netsh advfirewall firewall delete rule name="H5前端服务器-8080" >nul 2>&1
netsh advfirewall firewall add rule name="H5前端服务器-8080" dir=in action=allow protocol=TCP localport=8080
if %errorLevel% equ 0 (
    echo [✓] 8080端口规则已添加
) else (
    echo [×] 8080端口规则添加失败
)

REM 添加5001端口规则
netsh advfirewall firewall delete rule name="后端API服务器-5001" >nul 2>&1
netsh advfirewall firewall add rule name="后端API服务器-5001" dir=in action=allow protocol=TCP localport=5001
if %errorLevel% equ 0 (
    echo [✓] 5001端口规则已添加
) else (
    echo [×] 5001端口规则添加失败
)

echo.
echo ========================================
echo 配置完成！
echo ========================================
echo.
echo 现在可以在手机上访问：
echo http://192.168.1.35:8080
echo.
pause

