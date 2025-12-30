// 后端API接口定义
// Vercel部署的后端API地址
const API_BASE_URL = 'https://h5-retailer-backend.vercel.app';

// IP定位API
async function getLocationByIP(ip) {
    try {
        const url = ip ? `${API_BASE_URL}/api/location/ip?ip=${encodeURIComponent(ip)}` : `${API_BASE_URL}/api/location/ip`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('IP定位API调用失败:', error);
        throw new Error('网络错误或服务器不可用');
    }
}

// 关键字搜索API
async function searchPlaceByKeyword(keyword, city) {
    try {
        let url = `${API_BASE_URL}/api/place/search?keyword=${encodeURIComponent(keyword)}`;
        if (city) {
            url += `&city=${encodeURIComponent(city)}`;
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('关键字搜索API调用失败:', error);
        throw new Error('网络错误或服务器不可用');
    }
}

// 许可证号码搜索API
async function searchLicenseInDatabase(licenseNumber) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/search/${licenseNumber}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else if (response.status === 404) {
            return null; // 未找到数据
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('许可证搜索API调用失败:', error);
        throw new Error('网络错误或服务器不可用');
    }
}

// 获取重点检查对象数据（mock 数据）
async function getPriorityInspectionData() {
    return [];
}

// 获取随机抽查对象数据（mock 数据，按要求移除示例项）
async function getRandomInspectionData() {
    return [];
}

// 获取许可核查对象数据（mock 数据，按要求移除示例项）
async function getPermitInspectionData() {
    return [];
}

// 获取日常检查对象数据（mock 数据，按要求移除示例项）
async function getRoutineInspectionData() {
    return [];
}

// 路径规划接口 - 更新为使用/api/index端点
async function planRouteWithAMap(payload) {
    const requestPayload = Array.isArray(payload) ? { points: payload } : (payload || {});
    const points = Array.isArray(requestPayload.points) ? requestPayload.points : [];
    if (!requestPayload.strategy) {
        requestPayload.strategy = '1';
    }
    console.log(`发送路径规划请求，包含 ${points.length} 个点，策略 ${requestPayload.strategy}`, requestPayload);
    // 通过后端API调用路径规划
    try {
        const response = await fetch(`${API_BASE_URL}/api/index`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });
        
        if (response.ok) {
            const data = await response.json();
            // 转换后端返回的segments格式为前端期望的path格式
            if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
                const path = [];
                data.segments.forEach((seg, index) => {
                    // 添加起点（仅第一段）
                    if (index === 0 && seg.from) {
                        path.push({
                            step: 1,
                            name: seg.from.name || `点${index + 1}`,
                            longitude: seg.from.longitude,
                            latitude: seg.from.latitude,
                            address: seg.from.address || '',
                            distanceToNext: seg.distance || 0,
                            durationToNext: seg.duration || 0
                        });
                    }
                    // 添加终点
                    if (seg.to) {
                        const nextSeg = data.segments[index + 1];
                        path.push({
                            step: index + 2,
                            name: seg.to.name || `点${index + 2}`,
                            longitude: seg.to.longitude,
                            latitude: seg.to.latitude,
                            address: seg.to.address || '',
                            distanceToNext: nextSeg ? nextSeg.distance : 0,
                            durationToNext: nextSeg ? nextSeg.duration : 0
                        });
                    }
                });
                data.path = path;
                console.log(`转换后的path包含 ${path.length} 个点`);
            }
            return data;
        } else {
            const error = await response.json();
            throw new Error(error.error || '路径规划失败');
        }
    } catch (error) {
        console.error('路径规划API调用失败:', error);
        // 兜底方案
        const fallbackPoints = points.filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude));
        return buildFallbackRoute(fallbackPoints);
    }
}

// 工具函数：计算优化率
function calculateOptimizationRate() {
    // 实际实现中可以根据原始路径和优化后路径的比较来计算
    return Math.floor(Math.random() * 30) + 50; // 50-80之间的随机数（模拟）
}

// 计算两点间球面距离（公里）
function haversineKm(a, b) {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
}

// 构造基于直线距离的兜底路线（防止高德服务不可用时完全失败）
function buildFallbackRoute(points) {
    let total = 0;
    const path = points.map((p, i) => {
        const dist = i < points.length - 1 ? haversineKm(points[i], points[i + 1]) : 0;
        total += dist;
        return {
            step: i + 1,
            name: p.name,
            longitude: p.longitude,
            latitude: p.latitude,
            address: p.address,
            distanceToNext: i < points.length - 1 ? dist.toFixed(2) : 0
        };
    });
    // 以平均速度40km/h估算
    const durationMin = Math.ceil((total / 40) * 60);
    const line = points.map(p => [p.longitude, p.latitude]);
    return { distance: total.toFixed(2), duration: durationMin, path, line, optimizationRate: calculateOptimizationRate() };
}
