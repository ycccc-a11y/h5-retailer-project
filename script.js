// 全局错误处理：忽略浏览器网络定位服务被阻止的错误
(function() {
    // 捕获所有错误（包括网络请求错误）
    window.addEventListener('error', function(event) {
        const errorMsg = event.message || '';
        const filename = event.filename || '';
        
        // 忽略网络定位提供者被阻止的错误
        if (errorMsg.includes('ERR_BLOCKED_BY_CLIENT') ||
            errorMsg.includes('9oo9leapis') ||
            errorMsg.includes('googleapis') ||
            errorMsg.includes('Network location provider') ||
            filename.includes('9oo9leapis') ||
            filename.includes('googleapis')) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            // 静默处理，不输出到控制台
            return true;
        }
    }, true);
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason || '';
        const reasonStr = String(reason);
        if (reasonStr.includes('ERR_BLOCKED_BY_CLIENT') ||
            reasonStr.includes('9oo9leapis') ||
            reasonStr.includes('Network location provider')) {
            event.preventDefault();
        }
    });
})();

// 动态规划全局状态
let dynamicPlanningState = {
    enabled: true,
    interval: 120,
    strategy: '1'
};
let dynamicPlanningTimer = null;
let dynamicReplanTimeout = null;
let latestPlanContext = null;
let latestRouteData = null;
let latestRoutePoints = null;
let latestRouteSegments = [];
let isAutoReplanning = false;
const START_POINT_MARKER_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2NjdlZWEiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOCIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
let startPointPreviewMarker = null;

const ANT_COLONY_CONFIG = {
    enabled: true,
    minPoints: 4,
    iterations: 80,
    antMultiplier: 2,
    alpha: 1.1,
    beta: 4.5,
    rho: 0.45,
    q: 0.9
};

// 任务池类别切换功能
function toggleCategory(categoryId) {
    const items = document.getElementById(`${categoryId}-items`);
    const header = items.previousElementSibling;
    const arrow = header.querySelector('.arrow');
    
    // 切换展开状态
    items.classList.toggle('expanded');
    header.classList.toggle('active');
    arrow.classList.toggle('rotated');
    
    // 如果是第一次展开，则加载数据
    if (items.classList.contains('expanded') && items.querySelector('.loading-message')) {
        loadCategoryData(categoryId);
    }
}

// 许可证号码搜索功能
async function searchByLicenseNumber() {
    const licenseNumberInput = document.getElementById('license-number-input');
    const licenseNumber = licenseNumberInput.value.trim();
    const searchResult = document.getElementById('search-result');
    
    if (!licenseNumber) {
        alert('请输入许可证号码');
        return;
    }
    
    // 显示加载状态
    searchResult.style.display = 'block';
    searchResult.innerHTML = '<div class="loading">正在搜索...</div>';
    
    try {
        // 调用后端API搜索许可证号码
        const result = await searchLicenseInDatabase(licenseNumber);
        
        if (result && !result.error) {
            // 显示搜索结果
            displaySearchResult(result);
        } else {
            searchResult.innerHTML = '<div class="no-result">未找到相关许可证信息</div>';
        }
    } catch (error) {
        console.error('搜索失败:', error);
        searchResult.innerHTML = '<div class="error">搜索失败，请重试</div>';
    }
}

// 显示搜索结果
function displaySearchResult(result) {
    const searchResult = document.getElementById('search-result');
    
    // 字段映射：后端API返回的是英文字段名
    const licenseNumber = result.license_number;
    const customerName = result.customer_name;
    const address = result.address;
    const longitude = result.longitude;
    const latitude = result.latitude;
    
    searchResult.innerHTML = `
        <div class="result-item">
            <h3>搜索结果</h3>
            <div class="result-details">
                <p><strong>许可证号码:</strong> ${licenseNumber}</p>
                <p><strong>商户名称:</strong> ${customerName}</p>
                <p><strong>经营地址:</strong> ${address}</p>
                <p><strong>经度:</strong> ${longitude}</p>
                <p><strong>纬度:</strong> ${latitude}</p>
            </div>
            <button class="add-to-route" onclick="addToRoute('${licenseNumber}', '${customerName}', ${longitude}, ${latitude}, '${address}')">添加到路线</button>
        </div>
    `;
}

// 将搜索结果添加到路线中
function addToRoute(licenseNumber, name, longitude, latitude, address) {
    // 创建一个隐藏的复选框并选中它
    const hiddenCheckbox = document.createElement('input');
    hiddenCheckbox.type = 'checkbox';
    hiddenCheckbox.id = `searched-task-${licenseNumber}`;
    hiddenCheckbox.name = `searched-task-${licenseNumber}`;
    hiddenCheckbox.setAttribute('data-longitude', longitude);
    hiddenCheckbox.setAttribute('data-latitude', latitude);
    hiddenCheckbox.setAttribute('data-address', address);
    hiddenCheckbox.setAttribute('data-name', name);
    hiddenCheckbox.checked = true;
    hiddenCheckbox.style.display = 'none';
    
    // 添加到页面中
    document.body.appendChild(hiddenCheckbox);
    
    // 显示提示信息
    alert(`已将"${name}"添加到路线中，可以点击"一键智能规划路线"生成路线。`);

    // 同步刷新“已选检查对象”
    refreshSelectedSummary();
}

// 加载分类数据
async function loadCategoryData(categoryId) {
    const container = document.getElementById(`${categoryId}-items`);
    const loadingMessage = container.querySelector('.loading-message');
    
    if (!loadingMessage) return; // 数据已加载
    
    try {
        let data;
        switch (categoryId) {
            case 'priority':
                // 获取重点检查数据
                data = await getPriorityInspectionData();
                break;
            case 'random':
                // 获取随机抽查数据
                data = await getRandomInspectionData();
                break;
            case 'permit':
                // 获取许可核查数据
                data = await getPermitInspectionData();
                break;
            case 'routine':
                // 获取日常检查数据
                data = await getRoutineInspectionData();
                break;
            default:
                data = [];
        }
        
        // 渲染数据
        renderCategoryItems(container, data, categoryId);
    } catch (error) {
        console.error('加载数据失败:', error);
        loadingMessage.textContent = '加载失败，请重试';
    }
}

// 渲染分类项
function renderCategoryItems(container, data, categoryId) {
    // 清空容器
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // 添加任务项
    const labelMap = { priority: '重点检查', random: '随机抽查', permit: '许可核查', routine: '日常检查' };
    data.forEach(item => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <input type="checkbox" id="${categoryId}-task-${item.id}" name="${categoryId}-task-${item.id}" 
                   data-longitude="${item.longitude}" data-latitude="${item.latitude}" 
                   data-address="${item.address}" data-name="${item.name}">
            <label for="${categoryId}-task-${item.id}">${item.name}</label>
            <span class="address-info">${item.address}</span>
            <span class="category-badge">${labelMap[categoryId] || ''}</span>
        `;
        container.appendChild(taskItem);
    });
}

function getRouteDisplayElements() {
    const routeWindow = document.getElementById('route-window');
    if (!routeWindow) {
        console.warn('未找到路线窗口容器');
        return null;
    }
    return {
        routeWindow,
        routePlaceholder: routeWindow.querySelector('.route-placeholder'),
        routeContent: routeWindow.querySelector('.route-content'),
        routeMap: document.getElementById('route-map')
    };
}

function prepareRouteDisplay({ resetContent = true } = {}) {
    const elements = getRouteDisplayElements();
    if (!elements) return null;

    if (elements.routeMap) {
        elements.routeMap.style.display = 'block';
    }
    if (resetContent) {
        if (elements.routePlaceholder) {
            elements.routePlaceholder.style.display = 'none';
        }
        if (elements.routeContent) {
            elements.routeContent.style.display = 'none';
        }
    }
    return elements;
}

function gatherSelectedPoints({ skipAlert = false } = {}) {
    const checkedTasks = document.querySelectorAll('input[type="checkbox"]:checked');
    if (checkedTasks.length === 0) {
        if (!skipAlert) {
        alert('请至少选择一个任务！');
        }
        return null;
    }

    const taskList = Array.from(checkedTasks);
    const selectedSummaryTasks = taskList.map(task => ({
        name: task.getAttribute('data-name'),
        address: task.getAttribute('data-address'),
        category: getCategoryForTask(task)
    }));

    const allPoints = taskList.map(task => ({
            name: task.getAttribute('data-name'),
            longitude: parseFloat(task.getAttribute('data-longitude')),
            latitude: parseFloat(task.getAttribute('data-latitude')),
        address: task.getAttribute('data-address'),
        id: task.id || task.getAttribute('id')
    }));

    const validPoints = allPoints.filter(p =>
        Number.isFinite(p.longitude) &&
        Number.isFinite(p.latitude) &&
        p.longitude !== 0 &&
        p.latitude !== 0
    );

    const uniquePoints = [];
    const seenCoords = new Set();
    validPoints.forEach(p => {
        const coordKey = `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`;
        if (!seenCoords.has(coordKey)) {
            seenCoords.add(coordKey);
            uniquePoints.push(p);
        } else {
            console.warn(`发现重复坐标点: ${p.name} (${p.longitude}, ${p.latitude})`);
        }
    });

    let pointsForMap = uniquePoints;
    if (startPoint) {
        selectedSummaryTasks.unshift({
            name: startPoint.name,
            address: startPoint.address,
            category: '起点'
        });
        pointsForMap = [{
            name: startPoint.name,
            longitude: startPoint.longitude,
            latitude: startPoint.latitude,
            address: startPoint.address,
            isStartPoint: true
        }, ...uniquePoints];
        console.log('已添加起点:', startPoint.name);
    }

    if (pointsForMap.length === 0) {
        if (!skipAlert) {
            alert('所有选中的任务都没有有效的坐标信息！');
        }
        return null;
    }

    const requestPoints = pointsForMap.map(p => ({
        name: p.name,
        longitude: p.longitude,
        latitude: p.latitude,
        address: p.address
    }));

    return {
        pointsForMap,
        requestPoints,
        selectedSummaryTasks,
        stats: {
            checkedCount: checkedTasks.length,
            validCount: validPoints.length,
            uniqueTaskCount: uniquePoints.length,
            duplicateFiltered: validPoints.length - uniquePoints.length,
            includesStart: !!startPoint
        }
    };
}

function maybeOptimizeRouteOrderWithAntColony(context) {
    if (!ANT_COLONY_CONFIG.enabled) return null;
    if (!context) return null;
    const points = Array.isArray(context.pointsForMap) ? context.pointsForMap : null;
    const requestPoints = Array.isArray(context.requestPoints) ? context.requestPoints : null;
    if (!points || !requestPoints || points.length !== requestPoints.length) return null;
    if (points.length < ANT_COLONY_CONFIG.minPoints) {
        console.log(`蚁群算法：点位数量 ${points.length} 小于阈值 ${ANT_COLONY_CONFIG.minPoints}，跳过优化`);
        return null;
    }
    const startLocked = Boolean(points[0]?.isStartPoint);
    const optimization = runAntColonyOrdering(points, {
        iterations: ANT_COLONY_CONFIG.iterations,
        antMultiplier: ANT_COLONY_CONFIG.antMultiplier,
        alpha: ANT_COLONY_CONFIG.alpha,
        beta: ANT_COLONY_CONFIG.beta,
        rho: ANT_COLONY_CONFIG.rho,
        q: ANT_COLONY_CONFIG.q,
        startLocked
    });
    if (!optimization || !Array.isArray(optimization.order)) {
        console.warn('蚁群算法未能生成有效路径，保持原有顺序');
        return null;
    }

    const orderedPointsForMap = optimization.order.map(index => points[index]);
    const orderedRequestPoints = optimization.order.map(index => requestPoints[index]);
    let orderedSummary = context.selectedSummaryTasks;
    if (Array.isArray(orderedSummary) && orderedSummary.length === optimization.order.length) {
        orderedSummary = optimization.order.map(index => orderedSummary[index]);
    }

    return {
        pointsForMap: orderedPointsForMap,
        requestPoints: orderedRequestPoints,
        selectedSummaryTasks: orderedSummary,
        order: optimization.order,
        distanceKm: optimization.bestLengthKm
    };
}

function runAntColonyOrdering(points, options = {}) {
    const n = points.length;
    if (n < 2) return null;

    const distanceMatrix = buildDistanceMatrix(points);
    const pheromone = Array.from({ length: n }, () => Array(n).fill(1));
    const heuristic = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => i === j ? 0 : 1 / (distanceMatrix[i][j] + 1e-6))
    );

    const iterations = Math.max(1, Math.floor(options.iterations) || 60);
    const antsPerIteration = Math.max(n, Math.floor((options.antMultiplier || 2) * n));
    const alpha = Number.isFinite(options.alpha) ? options.alpha : 1;
    const beta = Number.isFinite(options.beta) ? options.beta : 4;
    const rho = Math.min(Math.max(options.rho ?? 0.5, 0.01), 0.99);
    const q = options.q && options.q > 0 ? options.q : 1;
    const startLocked = !!options.startLocked;

    let globalBestOrder = null;
    let globalBestLength = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
        const antResults = [];

        for (let antIndex = 0; antIndex < antsPerIteration; antIndex++) {
            const path = [];
            const visited = new Set();

            let currentNode;
            if (startLocked) {
                currentNode = 0;
            } else {
                currentNode = antIndex % n;
            }
            path.push(currentNode);
            visited.add(currentNode);

            while (path.length < n) {
                const candidates = [];
                let totalWeight = 0;
                for (let nextNode = 0; nextNode < n; nextNode++) {
                    if (visited.has(nextNode)) continue;
                    const tau = Math.pow(pheromone[currentNode][nextNode], alpha);
                    const eta = Math.pow(heuristic[currentNode][nextNode], beta);
                    const weight = tau * eta;
                    totalWeight += weight;
                    candidates.push({ node: nextNode, weight });
                }

                if (candidates.length === 0) {
                    break;
                }

                let chosenNode;
                if (totalWeight <= 0) {
                    chosenNode = candidates[Math.floor(Math.random() * candidates.length)].node;
                } else {
                    let threshold = Math.random() * totalWeight;
                    for (const candidate of candidates) {
                        threshold -= candidate.weight;
                        if (threshold <= 0) {
                            chosenNode = candidate.node;
                            break;
                        }
                    }
                    if (chosenNode === undefined) {
                        chosenNode = candidates[candidates.length - 1].node;
                    }
                }

                path.push(chosenNode);
                visited.add(chosenNode);
                currentNode = chosenNode;
            }

            if (path.length === n) {
                const length = evaluateRouteLength(path, distanceMatrix);
                antResults.push({ path, length });
                if (length < globalBestLength) {
                    globalBestLength = length;
                    globalBestOrder = path.slice();
                }
            }
        }

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                pheromone[i][j] = Math.max(1e-6, pheromone[i][j] * (1 - rho));
            }
        }

        antResults.forEach(({ path, length }) => {
            if (!length || length <= 0) return;
            const deposit = q / length;
            for (let index = 0; index < path.length - 1; index++) {
                const from = path[index];
                const to = path[index + 1];
                pheromone[from][to] += deposit;
                pheromone[to][from] += deposit;
            }
        });
    }

    if (!globalBestOrder) {
        return null;
    }

    return {
        order: globalBestOrder,
        bestLengthKm: globalBestLength
    };
}

function evaluateRouteLength(order, distanceMatrix) {
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) {
        const from = order[i];
        const to = order[i + 1];
        total += distanceMatrix[from][to];
    }
    return total;
}

function buildDistanceMatrix(points) {
    const n = points.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const distance = haversineDistanceKm(points[i], points[j]);
            matrix[i][j] = distance;
            matrix[j][i] = distance;
        }
    }
    return matrix;
}

function haversineDistanceKm(pointA, pointB) {
    const lat1 = Number(pointA?.latitude);
    const lon1 = Number(pointA?.longitude);
    const lat2 = Number(pointB?.latitude);
    const lon2 = Number(pointB?.longitude);
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
        return 0;
    }
    const radLat1 = toRadians(lat1);
    const radLat2 = toRadians(lat2);
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const EARTH_RADIUS_KM = 6371.0088;
    return EARTH_RADIUS_KM * c;
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function getDynamicConfigFromUI() {
    const intervalSelect = document.getElementById('dynamic-planning-interval');
    const strategySelect = document.getElementById('route-strategy');
    return {
        enabled: true,
        interval: intervalSelect ? parseInt(intervalSelect.value, 10) || 120 : 120,
        strategy: strategySelect ? strategySelect.value : '1'
    };
}

function updateDynamicUIAfterPlan() {
    const hint = document.getElementById('dynamic-hint');
    const refreshBtn = document.getElementById('refresh-route-btn');
    const active = dynamicPlanningState.enabled && !!latestPlanContext;
    if (active) {
        if (hint) hint.style.display = 'block';
        if (refreshBtn) hint && (refreshBtn.style.display = 'inline-flex');
    } else {
        if (hint) hint.style.display = 'none';
        if (refreshBtn) refreshBtn.style.display = 'none';
    }
}

function clearDynamicPlanningTimer() {
    if (dynamicPlanningTimer) {
        clearInterval(dynamicPlanningTimer);
        dynamicPlanningTimer = null;
    }
}

function configureDynamicTimer() {
    clearDynamicPlanningTimer();
    if (!dynamicPlanningState.enabled || !latestPlanContext) {
        updateDynamicUIAfterPlan();
        return;
    }
    const intervalSeconds = Math.max(30, Number(dynamicPlanningState.interval) || 120);
    dynamicPlanningTimer = setInterval(() => {
        executeDynamicReplan({ reason: 'auto-timer' });
    }, intervalSeconds * 1000);
    updateDynamicUIAfterPlan();
    console.log(`动态规划已开启，刷新间隔：${intervalSeconds} 秒`);
}

function scheduleDynamicReplan(delay = 1200, reason = 'selection-change') {
    if (!dynamicPlanningState.enabled || !latestPlanContext) return;
    if (dynamicReplanTimeout) {
        clearTimeout(dynamicReplanTimeout);
    }
    dynamicReplanTimeout = setTimeout(() => {
        executeDynamicReplan({ reason });
    }, Math.max(300, delay));
}

async function executeDynamicReplan({ reason = 'auto' } = {}) {
    if (!dynamicPlanningState.enabled) return;
    if (isAutoReplanning) {
        console.log('动态规划正在执行中，跳过本次触发');
        return;
    }
    isAutoReplanning = true;
    try {
        console.log(`触发动态规划刷新，原因: ${reason}`);
        await planRouteInternal({ silent: true, reason, resetContent: false });
        if (latestPlanContext) {
            latestPlanContext.lastRefreshReason = reason;
        }
    } catch (error) {
        console.error('动态规划刷新失败:', error);
    } finally {
        isAutoReplanning = false;
    }
}

function manualRefreshRoute() {
    if (!latestPlanContext) {
        console.warn('尚未生成过路线，无法刷新');
        alert('请先点击“一键智能规划路线”生成初始路线');
        return;
    }
    executeDynamicReplan({ reason: 'manual-refresh' });
}

async function planRouteInternal({ silent = false, reason = 'manual', resetContent = !silent } = {}) {
    updateNavigationButton(false);
    const dynamicConfig = getDynamicConfigFromUI();
    const context = gatherSelectedPoints({ skipAlert: silent });
    if (!context) {
        latestRouteData = null;
        latestRoutePoints = null;
        updateDynamicUIAfterPlan();
        return null;
    }

    console.log(`选中任务总数: ${context.stats.checkedCount}, 有效坐标点数: ${context.stats.validCount}, 去重后: ${context.pointsForMap.length} 个点${context.stats.includesStart ? ' (包含起点)' : ''}`);
    if (context.stats.duplicateFiltered > 0) {
        console.warn(`有 ${context.stats.duplicateFiltered} 个重复的点被过滤`);
    }

    const elements = prepareRouteDisplay({ resetContent });
    if (!elements) return null;

    const map = getRouteMap();
    if (!map) {
        if (elements.routePlaceholder) {
            elements.routePlaceholder.textContent = '地图加载失败，请检查高德地图API';
            elements.routePlaceholder.style.display = 'flex';
        }
        return null;
    }

    const optimization = maybeOptimizeRouteOrderWithAntColony(context);
    if (optimization) {
        context.pointsForMap = optimization.pointsForMap;
        context.requestPoints = optimization.requestPoints;
        if (optimization.selectedSummaryTasks) {
            context.selectedSummaryTasks = optimization.selectedSummaryTasks;
        }
        context.optimizationMeta = {
            algorithm: 'ant-colony',
            order: optimization.order,
            distanceKm: optimization.distanceKm
        };
        console.info('蚁群算法已优化巡检顺序', context.optimizationMeta);
    }

    showSelectedSummary(context.selectedSummaryTasks);

    const payload = {
        points: context.requestPoints,
        strategy: dynamicConfig.strategy,
        dynamic: {
            enabled: dynamicConfig.enabled,
            interval: dynamicConfig.interval,
            reason
        }
    };
    if (context.optimizationMeta) {
        payload.optimization = context.optimizationMeta;
    }

    try {
        const routeData = await planRouteWithAMap(payload);
        renderRouteOnMap(context.pointsForMap, routeData);
        generateRouteContent(routeData);
        
        if (elements.routePlaceholder) {
            elements.routePlaceholder.style.display = 'none';
        }
        if (elements.routeContent) {
            elements.routeContent.style.display = 'block';
        }

        latestRouteData = routeData;
        latestRoutePoints = context.pointsForMap;
        updateNavigationButton(true);

        latestPlanContext = {
            timestamp: Date.now(),
            lastPayload: payload,
            optimization: context.optimizationMeta || null
        };

        return {
            routeData,
            dynamicConfig,
            context
        };
    } catch (error) {
        if (!silent && elements.routePlaceholder) {
            elements.routePlaceholder.textContent = '路线规划失败，请重试';
            elements.routePlaceholder.style.display = 'flex';
        }
        latestRouteData = null;
        latestRoutePoints = null;
        updateNavigationButton(false);
        throw error;
    }
}

// 智能路线规划功能
window.planRoute = async function() {
    console.log('=== planRoute 函数被调用 ===');
    // 显示加载提示
    const routePlaceholder = document.getElementById('route-placeholder');
    if (routePlaceholder) {
        routePlaceholder.textContent = '正在规划路线，请稍候...';
        routePlaceholder.style.display = 'flex';
    }
    try {
        const result = await planRouteInternal({ silent: false, reason: 'manual', resetContent: true });
        if (!result) return;

        dynamicPlanningState = {
            ...dynamicPlanningState,
            ...{
                enabled: result.dynamicConfig.enabled,
                interval: result.dynamicConfig.interval,
                strategy: result.dynamicConfig.strategy
            }
        };
        configureDynamicTimer();
    } catch (error) {
        console.error('路线规划失败:', error);
    }
}

function updateNavigationButton(available) {
    const btn = document.getElementById('open-amap-btn');
    if (!btn) return;
    if (available) {
        btn.style.display = 'inline-block';
        btn.classList.remove('disabled');
    } else {
        btn.style.display = 'none';
        btn.classList.add('disabled');
    }
}

function extractNavigationPoint(point, fallbackName = '') {
    if (!point) return null;
    const rawLng = point.longitude ?? point.lng ?? point.lon;
    const rawLat = point.latitude ?? point.lat ?? point.latit;
    const longitude = Number(rawLng);
    const latitude = Number(rawLat);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null;
    }
    return {
        longitude,
        latitude,
        name: point.name || fallbackName || ''
    };
}

function openAmapNavigation(origin, destination, waypoints = []) {
    if (!origin || !destination) {
        alert('缺少有效的起点或终点坐标，无法唤起高德导航');
        return;
    }

    const selectableWaypoints = Array.isArray(waypoints)
        ? waypoints.filter(p => Number.isFinite(p?.longitude) && Number.isFinite(p?.latitude))
        : [];

    const urls = buildAmapNavigationUrls(origin, destination, selectableWaypoints);
    console.log('AMap navigation payload', {
        origin,
        destination,
        waypoints: selectableWaypoints,
        urls
    });

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
        window.location.href = urls.ios;
        setTimeout(() => {
            window.location.href = urls.web;
        }, 1500);
    } else if (isAndroid) {
        window.location.href = urls.android;
        setTimeout(() => {
            window.location.href = urls.web;
        }, 1500);
    } else {
        window.open(urls.web, '_blank');
    }
}

function navigateWithAmap() {
    if (!latestRouteData || !Array.isArray(latestRouteData.path) || latestRouteData.path.length < 2) {
        alert('请先完成路线规划');
        return;
    }

    const path = latestRouteData.path;
    const origin = extractNavigationPoint(path[0], '起点');
    const destination = extractNavigationPoint(path[path.length - 1], '终点');
    if (!origin || !destination) {
        alert('路线缺少有效的起点或终点坐标，无法唤起高德导航');
        return;
    }

    const waypointSource = Array.isArray(latestRoutePoints) ? latestRoutePoints : path;
    const waypointList = waypointSource
        .slice(1, waypointSource.length - 1)
        .map((p, idx) => extractNavigationPoint(p, `途经点${idx + 1}`))
        .filter(Boolean);

    openAmapNavigation(origin, destination, waypointList);
}

function navigateSegmentWithAmap(segmentIndex) {
    if (!latestRouteData || !Array.isArray(latestRouteData.path) || latestRouteData.path.length < 2) {
        alert('请先完成路线规划');
        return;
    }

    const path = latestRouteData.path;
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= path.length - 1) {
        alert('请选择有效的分段导航');
        return;
    }

    const startPoint = extractNavigationPoint(path[segmentIndex], segmentIndex === 0 ? '起点' : `第 ${segmentIndex} 站`);
    const endPoint = extractNavigationPoint(path[segmentIndex + 1], segmentIndex + 1 === path.length - 1 ? '终点' : `第 ${segmentIndex + 1} 站`);

    if (!startPoint || !endPoint) {
        alert('该分段缺少有效的坐标信息，无法唤起高德导航');
        return;
    }

    openAmapNavigation(startPoint, endPoint, []);
}

function buildAmapNavigationUrls(origin, destination, waypoints = []) {
    const encodeName = (value) => encodeURIComponent(value || '');
    const formatCoordScheme = (p) => `${p.latitude},${p.longitude}`;
    const formatCoordWeb = (p) => `${p.longitude},${p.latitude}`;
    const source = encodeURIComponent('智能巡检');

    const routedStrategy = normalizeAmapStrategy(dynamicPlanningState.strategy);
    const waypointCoords = waypoints
        .slice(0, Math.min(9, waypoints.length))
        .filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude))
        .map(formatCoordScheme);
    const waypointChain = waypointCoords.join(';').replace(/\s+/g, '');
    const waypointParamScheme = waypointChain ? `&waypoints=${waypointChain}` : '';

    const android = `androidamap://route/plan/?sourceApplication=${source}` +
        `&slat=${origin.latitude}&slon=${origin.longitude}&sname=${encodeName(origin.name)}` +
        `&dlat=${destination.latitude}&dlon=${destination.longitude}&dname=${encodeName(destination.name)}` +
        `&dev=0&t=${routedStrategy}${waypointParamScheme}`;

    const ios = `iosamap://path?sourceApplication=${source}` +
        `&slat=${origin.latitude}&slon=${origin.longitude}&sname=${encodeName(origin.name)}` +
        `&dlat=${destination.latitude}&dlon=${destination.longitude}&dname=${encodeName(destination.name)}` +
        `&dev=0&t=${routedStrategy}${waypointParamScheme}`;

    const webWaypoints = waypoints.length
        ? `&via=${encodeURIComponent(waypoints.map(formatCoordWeb).join(';'))}`
        : '';
    const web = `https://uri.amap.com/navigation?from=${formatCoordWeb(origin)},${encodeName(origin.name)}` +
        `&to=${formatCoordWeb(destination)},${encodeName(destination.name)}` +
        `&mode=car${webWaypoints}&policy=${routedStrategy}`;

    return { android, ios, web };
}

function normalizeAmapStrategy(strategy) {
    switch (String(strategy)) {
        case '0':
            return '0'; // 时间最短
        case '1':
            return '1'; // 避开拥堵
        case '2':
            return '2'; // 距离最短
        case '3':
            return '3'; // 不走快速路
        case '4':
            return '4'; // 避开收费
        case '10':
        case '11':
        case '12':
            return '0'; // JS 策略对应关系不完全一致，统一映射成时间优先
        default:
            return '0';
    }
}

// 地图渲染：标记与折线
let _routeMap = null;
function getRouteMap() {
    if (typeof AMap === 'undefined') {
        console.error('高德地图API未加载');
        return null;
    }
    if (_routeMap) return _routeMap;
    
    const mapContainer = document.getElementById('route-map');
    if (!mapContainer) {
        console.error('地图容器不存在');
        return null;
    }
    
    try {
        _routeMap = new AMap.Map('route-map', {
            zoom: 12,
            center: [120.8943, 32.0123],
            viewMode: '2D'
        });
        console.log('地图初始化成功');
        return _routeMap;
    } catch (err) {
        console.error('地图初始化失败:', err);
        return null;
    }
}

let _drivingInstance = null;

function renderRouteOnMap(points, routeData) {
    const mapContainer = document.getElementById('route-map');
    if (mapContainer) {
        mapContainer.style.display = 'block';
    }
    
    const map = getRouteMap();
    if (!map) {
        console.error('无法获取地图实例');
        return;
    }
    
    // 延迟执行，确保地图DOM已渲染
    setTimeout(() => {
        renderMarkersAndRoute(map, points, routeData);
    }, 300);
}

function renderMarkersAndRoute(map, points, routeData) {
    map.clearMap();
    startPointPreviewMarker = null;

    const valid = points.filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude));
    if (valid.length === 0) {
        console.warn('没有有效的坐标点可以显示');
        return;
    }

    console.log(`准备在地图上显示 ${valid.length} 个标记点`);
    
    // 添加标记 - 确保所有点都被标记
    const markers = [];
    valid.forEach((p, idx) => {
        // 判断是否是起点
        const isStartPoint = p.isStartPoint;
        
        const marker = new AMap.Marker({
            position: [p.longitude, p.latitude],
            map,
            icon: isStartPoint ? new AMap.Icon({
                size: new AMap.Size(32, 32),
                image: START_POINT_MARKER_ICON,
                imageSize: new AMap.Size(32, 32),
                imageOffset: new AMap.Pixel(0, 0)
            }) : undefined,
            label: { 
                content: `${idx + 1}. ${p.name}`, 
                direction: 'right',
                offset: new AMap.Pixel(10, -10),
                style: {
                    backgroundColor: isStartPoint ? '#667eea' : '#fff',
                    color: isStartPoint ? '#fff' : '#333',
                    border: isStartPoint ? '1px solid #667eea' : '1px solid #ccc',
                    padding: '2px 6px',
                    borderRadius: '4px'
                }
            }
        });
        markers.push(marker);
        console.log(`添加标记 ${idx + 1}: ${p.name} (${p.longitude}, ${p.latitude})${isStartPoint ? ' [起点]' : ''}`);
    });

    let polyline = null;
    if (routeData && Array.isArray(routeData.line) && routeData.line.length >= 2) {
        console.log(`绘制路径，坐标点数: ${routeData.line.length}`);

        const linePath = routeData.line
            .map(coord => {
                if (Array.isArray(coord) && coord.length >= 2) {
                    const lng = Number(coord[0]);
                    const lat = Number(coord[1]);
                    if (Number.isFinite(lng) && Number.isFinite(lat)) {
                        return new AMap.LngLat(lng, lat);
                    }
                }
                return null;
            })
            .filter(Boolean);

        if (linePath.length >= 2) {
            polyline = new AMap.Polyline({
                path: linePath,
                strokeColor: '#3366FF',
                strokeWeight: 5,
                strokeOpacity: 0.9,
                map
            });
            map.add(polyline);
        } else {
            console.warn('路径坐标格式异常，使用兜底直线连接');
            const fallbackPath = valid.map(p => new AMap.LngLat(p.longitude, p.latitude));
            polyline = new AMap.Polyline({
                path: fallbackPath,
                strokeColor: '#FF6B6B',
                strokeWeight: 3,
                strokeOpacity: 0.6,
                strokeStyle: 'dashed',
                map
            });
            map.add(polyline);
        }
    } else {
        console.warn('使用直线连接（未获取到实际驾车路线）');
        const linePath = valid.map(p => new AMap.LngLat(p.longitude, p.latitude));
        polyline = new AMap.Polyline({
            path: linePath,
            strokeColor: '#FF6B6B',
            strokeWeight: 3,
            strokeOpacity: 0.6,
            strokeStyle: 'dashed',
            map
        });
        map.add(polyline);
    }
    
    // 调整视野以包含所有标记点和路线
    const fitViewObjects = [...markers];
    if (polyline) {
        fitViewObjects.push(polyline);
    }
    map.setFitView(fitViewObjects, false, [50, 50, 50, 50]);
}
// 显示已选择对象的汇总列表
function showSelectedSummary(tasks) {
    const selectedSummary = document.getElementById('selected-summary');
    if (!selectedSummary) return;
    if (!tasks || tasks.length === 0) {
        selectedSummary.style.display = 'none';
        selectedSummary.innerHTML = '';
        return;
    }
    const list = document.createElement('ul');
    list.className = 'selected-list';
    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'selected-item';
        li.innerHTML = `
            <span class="name">${t.name}</span>
            <span class="addr">${t.address}</span>
            <span class="badge">${t.category}</span>
        `;
        list.appendChild(li);
    });
    selectedSummary.style.display = 'block';
    selectedSummary.innerHTML = '<h4>已选检查对象</h4>';
    selectedSummary.appendChild(list);
}

// 从当前已勾选的任务刷新"已选检查对象"
function refreshSelectedSummary() {
    const checkedTasks = document.querySelectorAll('input[type="checkbox"]:checked');
    const tasks = Array.from(checkedTasks).map(task => ({
        name: task.getAttribute('data-name'),
        address: task.getAttribute('data-address'),
        category: getCategoryForTask(task)
    }));
    
    // 如果有起点，添加到列表最前面
    if (startPoint) {
        tasks.unshift({
            name: startPoint.name,
            address: startPoint.address,
            category: '起点'
        });
    }
    
    showSelectedSummary(tasks);
}

// 生成路线内容
function generateRouteContent(routeData) {
    const routeContent = document.getElementById('route-content');
    if (!routeContent) {
        console.warn('route-content 容器不存在，无法渲染路线信息');
        return;
    }
    
    // 清空之前的内容
    routeContent.innerHTML = '';

    if (!routeData || !Array.isArray(routeData.path) || routeData.path.length === 0) {
        routeContent.innerHTML = '<div class="route-placeholder">暂无路线数据，请重新规划</div>';
        return;
    }

    if (routeData.path.length < 2) {
        routeContent.innerHTML = '<div class="route-placeholder">路线点不足，无法展示分段信息</div>';
        return;
    }

    const segmentList = document.createElement('div');
    segmentList.className = 'segment-list';

    for (let i = 0; i < routeData.path.length - 1; i++) {
        const current = routeData.path[i] || {};
        const next = routeData.path[i + 1] || {};
        const startLabel = i === 0 ? '起点' : `第 ${i} 站`;
        const endLabel = i + 1 === routeData.path.length - 1 ? '终点' : `第 ${i + 1} 站`;

        const distanceRaw = current.distanceToNext ?? current.segmentDistance ?? next.distanceFromPrev ?? '';
        let distanceText = '距离信息更新中';
        if (typeof distanceRaw === 'number' && Number.isFinite(distanceRaw) && distanceRaw > 0) {
            const formatted = distanceRaw % 1 === 0 ? distanceRaw.toFixed(0) : distanceRaw.toFixed(1);
            distanceText = `${formatted.replace(/\.0$/, '')} 公里`;
        } else if (typeof distanceRaw === 'string') {
            const parsed = parseFloat(distanceRaw);
            if (Number.isFinite(parsed) && parsed > 0) {
                const formatted = parsed % 1 === 0 ? parsed.toFixed(0) : parsed.toFixed(1);
                distanceText = `${formatted.replace(/\.0$/, '')} 公里`;
            } else if (distanceRaw.trim()) {
                distanceText = distanceRaw.trim();
            }
        } else if (distanceRaw) {
            distanceText = String(distanceRaw);
        }

        const durationRaw = current.durationToNext ?? current.segmentDuration ?? next.durationFromPrev ?? '';
        const durationText = (() => {
            if (typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0) {
                return `预计耗时：${Math.round(durationRaw)} 分钟`;
            }
            if (typeof durationRaw === 'string' && durationRaw.trim()) {
                const parsed = parseFloat(durationRaw);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return `预计耗时：${Math.round(parsed)} 分钟`;
                }
                return `预计耗时：${durationRaw.trim()}`;
            }
            return '';
        })();

        const segmentCard = document.createElement('div');
        segmentCard.className = 'segment-card';
        segmentCard.innerHTML = `
            <div class="segment-header">
                <span class="segment-order">第 ${i + 1} 段</span>
                <span class="segment-path">${startLabel} → ${endLabel}</span>
            </div>
            <div class="segment-body">
                <div class="segment-point">
                    <div class="point-label">${startLabel}</div>
                    <div class="point-name">${current.name || startLabel}</div>
                    <div class="point-address">${current.address || '地址信息暂无'}</div>
                </div>
                <div class="segment-arrow">→</div>
                <div class="segment-point">
                    <div class="point-label">${endLabel}</div>
                    <div class="point-name">${next.name || endLabel}</div>
                    <div class="point-address">${next.address || '地址信息暂无'}</div>
                </div>
            </div>
            <div class="segment-meta">
                <span class="segment-distance">预计距离：${distanceText}</span>
                ${durationText ? `<span class="segment-duration">${durationText}</span>` : ''}
            </div>
        `;

        const segmentButton = document.createElement('button');
        segmentButton.type = 'button';
        segmentButton.className = 'segment-nav-btn';
        segmentButton.textContent = '打开高德导航此段';
        segmentButton.addEventListener('click', () => navigateSegmentWithAmap(i));

        segmentCard.appendChild(segmentButton);
        segmentList.appendChild(segmentCard);
    }

    routeContent.appendChild(segmentList);

    // 添加路线统计信息
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'route-summary';
    summaryDiv.innerHTML = `
        <h3>路线规划完成</h3>
        <div class="route-stats">
            <div class="stat-item">
                <div class="stat-value">${routeData.path.length}</div>
                <div class="stat-label">总任务数</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${routeData.duration}</div>
                <div class="stat-label">预计时间(分钟)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${routeData.distance}</div>
                <div class="stat-label">总距离(公里)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${routeData.optimizationRate}%</div>
                <div class="stat-label">路径优化率</div>
            </div>
        </div>
    `;
    
    routeContent.appendChild(summaryDiv);
}


// 起点相关变量
let startPoint = null;

function updateStartPointPreviewMarker(lng, lat) {
    const map = getRouteMap();
    if (!map) return;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    try {
        if (startPointPreviewMarker) {
            startPointPreviewMarker.setMap(null);
            startPointPreviewMarker = null;
        }
        startPointPreviewMarker = new AMap.Marker({
            position: [lng, lat],
            map,
            icon: new AMap.Icon({
                size: new AMap.Size(32, 32),
                image: START_POINT_MARKER_ICON,
                imageSize: new AMap.Size(32, 32),
                imageOffset: new AMap.Pixel(0, 0)
            }),
            offset: new AMap.Pixel(-16, -32),
            title: '起点'
        });
        map.setZoom(Math.max(map.getZoom() || 12, 13));
        map.setCenter([lng, lat]);
    } catch (error) {
        console.warn('更新起点预览标记失败:', error);
    }
}

function removeStartPointPreviewMarker() {
    if (startPointPreviewMarker) {
        startPointPreviewMarker.setMap(null);
        startPointPreviewMarker = null;
    }
}

function locateCurrentStartPoint() {
    if (!navigator.geolocation) {
        alert('当前浏览器不支持定位功能，请使用支持定位的浏览器或在HTTPS环境下访问。');
        return;
    }

    const locateBtn = document.getElementById('locate-start-btn');
    const resultDiv = document.getElementById('start-point-result');
    const resultName = document.getElementById('start-point-name');
    const clearBtn = document.getElementById('clear-start-btn');

    const setLocateBtnLoading = (loading) => {
        if (!locateBtn) return;
        if (!locateBtn.dataset.originalText) {
            locateBtn.dataset.originalText = locateBtn.textContent.trim() || '使用当前位置';
        }
        if (loading) {
            locateBtn.disabled = true;
            locateBtn.textContent = '定位中...';
        } else {
            locateBtn.disabled = false;
            locateBtn.textContent = locateBtn.dataset.originalText || '使用当前位置';
        }
    };

    if (resultDiv) {
        resultDiv.style.display = 'flex';
    }
    if (resultName) {
        resultName.textContent = '正在获取当前位置，请稍候...';
    }
    setLocateBtnLoading(true);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            setLocateBtnLoading(false);
            const latitude = Number(position.coords.latitude);
            const longitude = Number(position.coords.longitude);
            const accuracy = Number(position.coords.accuracy);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                if (resultName) {
                    resultName.textContent = '无法读取有效的定位坐标，请稍后重试。';
                }
                alert('无法读取有效的定位坐标，请稍后重试。');
                return;
            }

            startPoint = {
                name: '当前位置',
                longitude,
                latitude,
                address: '当前位置',
                accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
                isStartPoint: true,
                source: 'geolocation'
            };

            const accuracyText = Number.isFinite(accuracy) ? `，精度±${Math.round(accuracy)}米` : '';
            if (resultName) {
                resultName.textContent = `当前位置 (经度: ${longitude.toFixed(6)}, 纬度: ${latitude.toFixed(6)}${accuracyText})`;
            }
            if (clearBtn) {
                clearBtn.style.display = 'flex';
            }
            updateStartPointPreviewMarker(longitude, latitude);
            refreshSelectedSummary();
            scheduleDynamicReplan(600, 'start-point-geolocation');
            console.log('起点已更新为当前位置:', startPoint);
        },
        (error) => {
            setLocateBtnLoading(false);
            let message = '定位失败，请检查定位权限或网络状态。';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = '定位被拒绝，请在浏览器设置中允许定位权限后重试。';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '定位信息不可用，请确认设备的定位服务已开启。';
                    break;
                case error.TIMEOUT:
                    message = '定位请求超时，请稍后重试。';
                    break;
                default:
                    message = `定位失败：${error.message || '未知错误'}`;
                    break;
            }
            console.warn('定位失败:', error);
            if (resultName) {
                resultName.textContent = message;
            } else {
                alert(message);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

// 搜索起点
async function searchStartPoint() {
    const input = document.getElementById('start-point-input');
    const keyword = input.value.trim();
    
    if (!keyword) {
        alert('请输入搜索关键词');
        return;
    }
    
    const resultDiv = document.getElementById('start-point-result');
    const resultName = document.getElementById('start-point-name');
    const clearBtn = document.getElementById('clear-start-btn');
    
    try {
        resultName.textContent = '正在搜索...';
        resultDiv.style.display = 'flex';
        
        const result = await searchPlaceByKeyword(keyword);
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
            // 使用第一个搜索结果
            const place = result.data[0];
            const lng = Number(place.longitude);
            const lat = Number(place.latitude);
            startPoint = {
                name: place.name,
                longitude: Number.isFinite(lng) ? lng : place.longitude,
                latitude: Number.isFinite(lat) ? lat : place.latitude,
                address: place.address || `${place.province || ''}${place.city || ''}${place.district || ''}`
            };
            
            resultName.textContent = `${startPoint.name} (${startPoint.address})`;
            clearBtn.style.display = 'flex';
            input.value = '';
            
            console.log('起点设置成功:', startPoint);
            
            // 刷新已选检查对象列表，显示起点
            refreshSelectedSummary();
            scheduleDynamicReplan(600, 'start-point-set');
        } else {
            const errorMsg = result.error || '未找到相关地点';
            resultName.textContent = `搜索失败: ${errorMsg}`;
            alert(`搜索失败: ${errorMsg}\n\n请尝试:\n1. 使用更具体的关键词\n2. 检查网络连接`);
        }
    } catch (error) {
        console.error('起点搜索失败:', error);
        resultName.textContent = `搜索失败: ${error.message}`;
        alert(`搜索失败: ${error.message}`);
    }
}

// 清除起点
function clearStartPoint() {
    startPoint = null;
    const resultDiv = document.getElementById('start-point-result');
    const clearBtn = document.getElementById('clear-start-btn');
    const input = document.getElementById('start-point-input');
    
    resultDiv.style.display = 'none';
    clearBtn.style.display = 'none';
    input.value = '';
    
    // 刷新已选检查对象列表
    refreshSelectedSummary();
    
    console.log('起点已清除');
    scheduleDynamicReplan(600, 'start-point-cleared');
    removeStartPointPreviewMarker();
}

// 根据任务所属的分类容器获取任务类别
function getCategoryForTask(task) {
    // 获取任务所在的分类容器
    const categoryContainer = task.closest('.category');
    
    if (categoryContainer) {
        const categoryHeader = categoryContainer.querySelector('.category-header');
        if (categoryHeader) {
            // 返回分类标题文本，去除箭头符号
            return categoryHeader.textContent.replace('▼', '').trim();
        }
    }
    
    // 默认返回日常检查
    return '日常检查';
}

// 页面加载完成后初始化

document.addEventListener('DOMContentLoaded', function() {
    // 默认展开第一个类别
    const firstCategoryItems = document.getElementById('priority-items');
    const firstCategoryHeader = firstCategoryItems.previousElementSibling;
    const firstArrow = firstCategoryHeader.querySelector('.arrow');
    
    firstCategoryItems.classList.add('expanded');
    firstCategoryHeader.classList.add('active');
    firstArrow.classList.add('rotated');
    
    // 加载默认展开类别的数据
    loadCategoryData('priority');

    // 勾选/取消勾选时，实时刷新“已选检查对象”列表
    document.addEventListener('change', function(e) {
        if (e.target && e.target.matches('input[type="checkbox"]')) {
            refreshSelectedSummary();
            scheduleDynamicReplan(800, 'selection-change');
        }
    });

    const intervalSelect = document.getElementById('dynamic-planning-interval');
    const strategySelect = document.getElementById('route-strategy');

    if (intervalSelect) {
        dynamicPlanningState.interval = parseInt(intervalSelect.value, 10) || 120;
        intervalSelect.addEventListener('change', () => {
            dynamicPlanningState.interval = parseInt(intervalSelect.value, 10) || 120;
            configureDynamicTimer();
        });
    }

    if (strategySelect) {
        dynamicPlanningState.strategy = strategySelect.value || '1';
        strategySelect.addEventListener('change', () => {
            dynamicPlanningState.strategy = strategySelect.value || '1';
            if (latestPlanContext && dynamicPlanningState.enabled) {
                scheduleDynamicReplan(500, 'strategy-change');
            }
        });
    }

    const routeMapEl = document.getElementById('route-map');
    if (routeMapEl) {
        routeMapEl.style.display = 'block';
        setTimeout(() => {
            try {
                getRouteMap();
            } catch (err) {
                console.warn('预加载地图失败:', err);
            }
        }, 200);
    }

    updateDynamicUIAfterPlan();
});

// 从“重点检查”旁的＋入口打开许可证搜索
function openLicenseSearch(categoryId = 'priority') {
    // 展开“重点检查”分组
    const items = document.getElementById(`${categoryId}-items`);
    const header = items.previousElementSibling;
    const arrow = header.querySelector('.arrow');
    if (!items.classList.contains('expanded')) {
        items.classList.add('expanded');
        header.classList.add('active');
        arrow.classList.add('rotated');
        if (items.querySelector('.loading-message')) {
            loadCategoryData(categoryId);
        }
    }

    // 如果快速搜索面板不存在，则创建
    let panel = document.getElementById(`${categoryId}-quick-search`);
    if (!panel) {
        panel = document.createElement('div');
        panel.id = `${categoryId}-quick-search`;
        panel.className = 'quick-search';
        panel.innerHTML = `
            <input type="text" id="${categoryId}-quick-license-input" placeholder="请输入许可证号码" />
            <button class="search-button" id="${categoryId}-quick-search-btn">搜索</button>
            <div class="quick-msg" id="${categoryId}-quick-search-msg"></div>
        `;
        items.prepend(panel);
        // 绑定事件
        document.getElementById(`${categoryId}-quick-search-btn`).addEventListener('click', function(){ performQuickLicenseSearch(categoryId); });
        document.getElementById(`${categoryId}-quick-license-input`).addEventListener('keydown', function(e){
            if (e.key === 'Enter') performQuickLicenseSearch(categoryId);
        });
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = document.getElementById(`${categoryId}-quick-license-input`);
    input.focus();
}

// 执行快速许可证搜索并把结果插入到对应分组中
async function performQuickLicenseSearch(categoryId = 'priority') {
    const input = document.getElementById(`${categoryId}-quick-license-input`);
    const msg = document.getElementById(`${categoryId}-quick-search-msg`);
    const licenseNumber = (input.value || '').trim();
    if (!licenseNumber) {
        msg.textContent = '请输入许可证号码';
        msg.className = 'quick-msg error';
        return;
    }

    msg.textContent = '正在搜索...';
    msg.className = 'quick-msg loading';
    try {
        const result = await searchLicenseInDatabase(licenseNumber);
        if (result && !result.error) {
            addCategoryItemFromResult(categoryId, result);
            // 成功后不显示提示文案
            msg.textContent = '';
            msg.className = 'quick-msg';
        } else {
            msg.textContent = '未找到相关许可证信息';
            msg.className = 'quick-msg error';
        }
    } catch (e) {
        console.error(e);
        msg.textContent = '搜索失败，请重试';
        msg.className = 'quick-msg error';
    }
}

// 将搜索结果渲染为对应分组的任务项（可删除）
function addCategoryItemFromResult(categoryId, result) {
    const container = document.getElementById(`${categoryId}-items`);
    
    // 字段映射：后端API返回的是英文字段名
    const licenseNumber = result.license_number;
    const customerName = result.customer_name;
    const address = result.address;
    const longitude = result.longitude;
    const latitude = result.latitude;
    
    const id = `${categoryId}-task-${licenseNumber}`;
    if (document.getElementById(id)) {
        alert('该许可证已在列表中');
        return;
    }

    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <input type="checkbox" id="${id}" name="${id}"
               data-longitude="${longitude}" data-latitude="${latitude || ''}"
               data-address="${address}" data-name="${customerName}">
        <label for="${id}">${customerName}</label>
        <span class="address-info">${address}</span>
        <span class="category-badge">${{ priority: '重点检查', random: '随机抽查', permit: '许可核查', routine: '日常检查' }[categoryId] || ''}</span>
        <button type="button" class="delete-btn" onclick="deleteTaskItem(this)">×</button>
    `;
    // 插入到列表顶部（优先放到快速搜索面板之后）
    const panel = document.getElementById(`${categoryId}-quick-search`);
    if (panel && panel.nextSibling) {
        container.insertBefore(taskItem, panel.nextSibling);
    } else {
        container.prepend(taskItem);
    }
}

// 删除任务项
function deleteTaskItem(btn) {
    const item = btn.closest('.task-item');
    if (item) item.remove();
    refreshSelectedSummary();
    scheduleDynamicReplan(800, 'delete-task');
}
