// 移动端调试面板功能
let debugLogs = [];
const MAX_LOGS = 100;

// 添加日志
function addDebugLog(type, message, ...args) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const logEntry = {
        time: timestamp,
        type: type,
        message: message,
        args: args
    };
    
    debugLogs.push(logEntry);
    if (debugLogs.length > MAX_LOGS) {
        debugLogs.shift();
    }
    
    updateDebugDisplay();
}

// 更新调试面板显示
function updateDebugDisplay() {
    const content = document.getElementById('debug-log-content');
    if (!content) return;
    
    if (debugLogs.length === 0) {
        content.innerHTML = '<div style="color: #888;">等待日志输出...</div>';
        return;
    }
    
    const html = debugLogs.map(log => {
        let color = '#0f0';
        let icon = 'ℹ️';
        
        if (log.type === 'error') {
            color = '#f00';
            icon = '❌';
        } else if (log.type === 'warn') {
            color = '#ff0';
            icon = '⚠️';
        } else if (log.type === 'success') {
            color = '#0f0';
            icon = '✅';
        }
        
        const argsStr = log.args.length > 0 ? ' ' + log.args.map(a => {
            if (typeof a === 'object') {
                try {
                    return JSON.stringify(a, null, 2);
                } catch (e) {
                    return String(a);
                }
            }
            return String(a);
        }).join(' ') : '';
        
        return `<div style="color: ${color}; margin-bottom: 5px; padding: 3px 0; border-bottom: 1px solid #333;">
            <span style="color: #888;">[${log.time}]</span> ${icon} ${log.message}${argsStr}
        </div>`;
    }).join('');
    
    content.innerHTML = html;
    content.scrollTop = content.scrollHeight;
}

// 切换调试面板显示
function toggleDebugPanel() {
    const panel = document.getElementById('mobile-debug-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        addDebugLog('info', '调试面板已打开');
    } else {
        panel.style.display = 'none';
    }
}

// 清空日志
function clearDebugLog() {
    debugLogs = [];
    updateDebugDisplay();
    addDebugLog('info', '日志已清空');
}

// 拦截console方法
(function() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = function(...args) {
        originalLog.apply(console, args);
        addDebugLog('info', args[0], ...args.slice(1));
    };
    
    console.error = function(...args) {
        originalError.apply(console, args);
        addDebugLog('error', args[0], ...args.slice(1));
    };
    
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        addDebugLog('warn', args[0], ...args.slice(1));
    };
})();

// 拦截全局错误
window.addEventListener('error', function(event) {
    addDebugLog('error', '全局错误:', event.message, 'at', event.filename + ':' + event.lineno);
});

// 拦截Promise错误
window.addEventListener('unhandledrejection', function(event) {
    addDebugLog('error', 'Promise错误:', event.reason);
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    addDebugLog('success', '调试面板已初始化');
    addDebugLog('info', '点击右下角🐛按钮查看日志');
});
