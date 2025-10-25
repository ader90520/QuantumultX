/*
🏆 Bing积分完整版 v5.2 (修复卡住问题)
修复脚本执行完成后卡住的问题，优化异步操作处理
*/

const $ = new Env("Bing积分完整版");

// 配置参数 - 统一键名
const bingPointCookieKey = 'bingPointCookieKey'
const bingSearchCookiePCKey = 'bingSearchCookiePCKey'
const bingSearchCookieMobileKey = 'bingSearchCookieMobileKey'
const bingCachePointKey = "bing_cache_point"
const bingResetHoursKey = "bing_reset_hours"
const bingCnKey = "bing_cn"
const bingLastUpdateKey = "bing_last_update"
const bingPcTimesKey = "bing_pc_times"
const bingMobileTimesKey = "bing_mobile_times"
const bingIntervalKey = "bing_interval"

// 配置读取
let bingPointCookie = $.getdata(bingPointCookieKey)
let pc_cookie = $.getdata(bingSearchCookiePCKey)
let mobile_cookie = $.getdata(bingSearchCookieMobileKey)
let cache_point = parseInt($.getdata(bingCachePointKey)) || 0
let reset_hours = parseInt($.getdata(bingResetHoursKey)) || 8
let useCnDomain = $.getdata(bingCnKey) === "true"
let lastUpdateTime = parseInt($.getdata(bingLastUpdateKey)) || 0

// 修复：增强配置读取逻辑
function getConfigValue(key, defaultValue) {
    const value = $.getdata(key);
    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }
    if (key.includes("_times") || key.includes("_interval") || key.includes("_hours") || key.includes("_point")) {
        const numValue = parseInt(value);
        return isNaN(numValue) ? defaultValue : numValue;
    }
    return value;
}

// 搜索配置
let pc_times = getConfigValue(bingPcTimesKey, 30)
let mobile_times = getConfigValue(bingMobileTimesKey, 20)
let interval = getConfigValue(bingIntervalKey, 5)
let host = useCnDomain ? "cn.bing.com" : "www.bing.com"

// 全局变量
let currentPoints = cache_point;
let isScriptDone = false; // 添加脚本完成标志

// 调试信息
$.log(`🔍 Bing积分完整版开始执行`);
$.log(`搜索域名: ${host}`);
$.log(`PC端搜索: ${pc_times}次`);
$.log(`移动端搜索: ${mobile_times}次`);
$.log(`搜索间隔: ${interval}秒`);
$.log(`重置时间: ${reset_hours}点`);
$.log(`PC Cookie长度: ${pc_cookie ? pc_cookie.length : 0}`);
$.log(`移动Cookie长度: ${mobile_cookie ? mobile_cookie.length : 0}`);
$.log(`积分Cookie长度: ${bingPointCookie ? bingPointCookie.length : 0}`);

// 判断是否为请求上下文
if (typeof $request !== 'undefined') {
    getCookie()
} else {
    // 添加超时保护，防止脚本卡住
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            if (!isScriptDone) {
                reject(new Error("脚本执行超时，强制结束"));
            }
        }, 300000); // 5分钟超时
    });

    Promise.race([all(), timeoutPromise])
        .catch(error => {
            $.log(`❌ 脚本执行异常: ${error.message}`);
            $.notify("Bing积分完整版", "执行超时", "脚本已强制结束");
        })
        .finally(() => {
            isScriptDone = true;
            $.done();
        });
}

function getCookie() {
    if (/rewards\.bing\.com/.test($request.url)) {
        $.log(`开始获取积分面板cookie`)
        try {
            let cookieValue = '';
            
            if ($request.headers && $request.headers.Cookie) {
                cookieValue = $request.headers.Cookie;
            } else if ($request.headers && $request.headers.cookie) {
                cookieValue = $request.headers.cookie;
            }
            
            if (cookieValue) {
                const cleanedCookie = cleanBingCookie(cookieValue);
                $.setdata(cleanedCookie, bingPointCookieKey)
                $.notify("Bing积分面板", "成功获取cookie", "可以关闭相应脚本")
                $.log('🎉成功获取积分面板cookie')
                bingPointCookie = cleanedCookie;
            } else {
                $.log(`❌未找到Cookie头信息`)
            }
        } catch (e) {
            $.log(`❌获取bing积分面板cookie失败: ${e}`)
        }
    }
    $.done()
}

// 清理Bing Cookie
function cleanBingCookie(cookie) {
    const importantKeys = [
        '_EDGE_S', '_EDGE_V', 'MUID', 'MUIDB', '_RwBf', '_HPN',
        '_SS', 'KievRPSAuth', 'RPSAuth', 'RPSCC', 'SUID', 'USRLOC'
    ];
    
    return cookie.split(';')
        .map(part => part.trim())
        .filter(part => {
            const key = part.split('=')[0];
            return importantKeys.some(important => key.startsWith(important));
        })
        .join('; ');
}

async function all() {
    let totalPoints = 0;
    let taskPoints = 0;
    let pcPoints = 0;
    let mobilePoints = 0;
    let startPoints = 0;
    
    try {
        // 第一步：获取初始面板积分信息
        $.log("\n📊 第一步：获取初始积分信息...");
        
        const now = Date.now();
        const isResetTime = new Date().getHours() == reset_hours;
        
        // 使用修复后的方法获取积分信息
        const initialDashboardInfo = await getDashboardInfoFixed();
        if (initialDashboardInfo && initialDashboardInfo.availablePoints !== undefined) {
            startPoints = initialDashboardInfo.availablePoints;
            currentPoints = startPoints;
            $.log(`✅ 初始积分: ${startPoints}分`);
            // 更新缓存
            $.setdata(currentPoints.toString(), bingCachePointKey)
            $.setdata(now.toString(), bingLastUpdateKey)
            cache_point = currentPoints;
        } else if (cache_point > 0) {
            startPoints = cache_point;
            currentPoints = cache_point;
            $.log(`⏸️ 使用缓存积分作为初始积分: ${startPoints}分`);
        } else {
            $.log(`⚠️ 无法获取初始积分，从0开始计算`);
            startPoints = 0;
            currentPoints = 0;
        }
        
        // 第二步：执行积分任务
        $.log("\n🎯 第二步：执行积分任务...");
        if (bingPointCookie && bingPointCookie.length > 100) {
            const isValid = await validateCookieFixed();
            if (isValid) {
                try {
                    taskPoints = await executePointTasks();
                    totalPoints += taskPoints;
                    $.log(`🎯 积分任务获得: ${taskPoints}分`);
                } catch (e) {
                    $.log("❌积分任务执行异常:", e);
                }
            } else {
                $.log("❌积分Cookie已过期，跳过积分任务");
            }
        } else {
            $.log("❌积分Cookie为空或过短，跳过积分任务");
        }
        
        // 第三步：执行PC端搜索
        $.log("\n💻 第三步：执行PC端搜索...");
        if (pc_cookie && pc_cookie.length > 100 && pc_times > 0) {
            pcPoints = await executeSearchWithMonitoring('pc', pc_times, "PC端");
            totalPoints += pcPoints;
            $.log(`💻 PC端搜索获得: ${pcPoints}分`);
        } else if (pc_times <= 0) {
            $.log("⏭️PC端搜索次数设置为0，跳过PC端搜索");
        } else {
            $.log("❌PC端Cookie为空或过短，跳过PC端搜索");
        }
        
        // 第四步：执行移动端搜索
        $.log("\n📱 第四步：执行移动端搜索...");
        if (mobile_cookie && mobile_cookie.length > 100 && mobile_times > 0) {
            mobilePoints = await executeSearchWithMonitoring('mobile', mobile_times, "移动端");
            totalPoints += mobilePoints;
            $.log(`📱 移动端搜索获得: ${mobilePoints}分`);
        } else if (mobile_times <= 0) {
            $.log("⏭️移动端搜索次数设置为0，跳过移动端搜索");
        } else {
            $.log("❌移动端Cookie为空或过短，跳过移动端搜索");
        }
        
        // 最终积分检查
        $.log("\n📈 最终积分检查...");
        const finalDashboardInfo = await getDashboardInfoFixed();
        let finalPoints = currentPoints;
        let actualTotalPoints = 0;
        
        if (finalDashboardInfo && finalDashboardInfo.availablePoints !== undefined) {
            finalPoints = finalDashboardInfo.availablePoints;
            actualTotalPoints = finalPoints - startPoints;
            $.log(`✅ 最终积分: ${finalPoints}分`);
            $.log(`📊 实际总获得: ${actualTotalPoints}分`);
            
            // 更新最终缓存
            $.setdata(finalPoints.toString(), bingCachePointKey)
        } else {
            $.log(`⚠️ 无法获取最终积分，使用计算值: ${currentPoints}分`);
            actualTotalPoints = totalPoints;
        }
        
        // 最终统计和通知
        $.log(`\n🎉 任务完成总结:`);
        $.log(`📊 初始积分: ${startPoints}分`);
        $.log(`📊 最终积分: ${finalPoints}分`);
        $.log(`🎯 任务获得积分: ${taskPoints} 分`);
        $.log(`💻 PC端获得积分: ${pcPoints} 分`);
        $.log(`📱 移动端获得积分: ${mobilePoints} 分`);
        $.log(`💰 计算获得积分: ${totalPoints} 分`);
        $.log(`📈 实际获得积分: ${actualTotalPoints} 分`);
        
        // 发送完成通知
        let notifyMsg = `初始: ${startPoints}分 → 最终: ${finalPoints}分`;
        notifyMsg += `\n实际获得: ${actualTotalPoints}分`;
        notifyMsg += `\n任务: ${taskPoints}分 | PC: ${pcPoints}分 | 移动: ${mobilePoints}分`;
        
        if (finalDashboardInfo && finalDashboardInfo.dailyProgress) {
            notifyMsg += `\n日常进度: ${finalDashboardInfo.dailyProgress}`;
        }
        
        if (actualTotalPoints !== totalPoints) {
            notifyMsg += `\n📊 计算差异: ${actualTotalPoints - totalPoints}分`;
        }
        
        $.notify(
            "Bing积分完整版", 
            `✅ 完成 - 实际获得 ${actualTotalPoints} 积分`,
            notifyMsg
        );
        
    } catch (error) {
        $.log(`❌ 主流程执行出错: ${error.message}`);
        $.notify("Bing积分完整版", "❌ 执行出错", error.message);
        throw error; // 重新抛出错误以便外层捕获
    } finally {
        $.log(`🏁 脚本执行完成`);
    }
}

// ==================== 修复的面板获取相关函数 ====================

// 修复的获取面板信息函数
async function getDashboardInfoFixed() {
    if (!bingPointCookie) {
        $.log("❌ 积分Cookie为空，无法获取面板信息");
        return null;
    }
    
    try {
        // 优先使用API方式
        let dashboard = await getDashboardAPIFixed();
        if (dashboard) {
            return await processDashboardDataFixed(dashboard);
        }
        
        $.log(`❌ API方式失败，尝试网页方式...`)
        // 如果API方式失败，尝试网页方式
        dashboard = await getDashBoardWebFixed();
        if (dashboard) {
            return await processDashboardDataFixed(dashboard);
        }
        
    } catch (e) {
        $.log(`❌ 获取面板信息过程中出错: ${e.message}`)
    }
    return null;
}

// 修复的API方式获取面板信息 - 添加超时保护
async function getDashboardAPIFixed() {
    return new Promise((resolve, reject) => {
        const url = "https://rewards.bing.com/api/getuserinfo?type=1"
        
        const headers = {
            "accept": "application/json",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cookie": bingPointCookie,
            "referer": "https://rewards.bing.com/",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1"
        }
        
        // 添加请求超时
        const timeoutId = setTimeout(() => {
            reject(new Error("API请求超时"));
        }, 10000);
        
        $.get({
            url: url, 
            headers: headers, 
            timeout: 10000
        }, (error, response, data) => {
            clearTimeout(timeoutId); // 清除超时计时器
            
            if (error) {
                $.log(`❌ API请求失败: ${error}`)
                resolve(null)
                return
            }
            
            $.log(`📊 API响应状态码: ${response.statusCode}`)
            
            if (response.statusCode === 200) {
                try {
                    const result = JSON.parse(data)
                    $.log("✅ API方式成功获取数据")
                    resolve(result)
                } catch (e) {
                    $.log(`❌ API响应解析失败: ${e}`)
                    resolve(null)
                }
            } else {
                $.log(`❌ API返回错误状态码: ${response.statusCode}`)
                resolve(null)
            }
        })
    })
}

// 修复的网页方式获取面板信息 - 添加超时保护
async function getDashBoardWebFixed() {
    return new Promise((resolve, reject) => {
        const url = `https://rewards.bing.com/`
        
        const headers = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cookie": bingPointCookie,
            "referer": "https://www.bing.com/",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin"
        }
        
        // 添加请求超时
        const timeoutId = setTimeout(() => {
            reject(new Error("网页请求超时"));
        }, 12000);
        
        $.get({
            url: url, 
            headers: headers, 
            timeout: 12000
        }, (error, response, data) => {
            clearTimeout(timeoutId); // 清除超时计时器
            
            if (error) {
                $.log(`❌ 网页请求失败: ${error}`)
                resolve(null)
                return
            }
            
            $.log(`📊 网页响应状态码: ${response.statusCode}`)
            
            if (response.statusCode === 200) {
                // 检查是否被重定向到登录页面
                if (data.includes('signin') || data.includes('login') || data.includes('Microsoft')) {
                    $.log(`❌ 检测到登录页面，Cookie可能已过期`)
                    resolve(null)
                    return
                }
                
                // 尝试提取dashboard数据
                try {
                    const dashboardMatch = data.match(/var dashboard\s*=\s*({[^;]*});/)
                    if (dashboardMatch) {
                        const dashboard = JSON.parse(dashboardMatch[1])
                        $.log("✅ 网页方式成功解析dashboard数据")
                        resolve({ dashboard })
                    } else {
                        $.log("❌ 未找到dashboard数据")
                        resolve(null)
                    }
                } catch (e) {
                    $.log(`❌ 解析dashboard数据失败: ${e}`)
                    resolve(null)
                }
            } else {
                $.log(`❌ 网页返回错误状态码: ${response.statusCode}`)
                resolve(null)
            }
        })
    })
}

// 修复的面板数据处理函数
async function processDashboardDataFixed(dashboard) {
    try {
        let userStatus, availablePoints, levelInfo, counters, dailyPoint;
        
        // 处理不同来源的数据结构
        if (dashboard.dashboard && dashboard.dashboard.userStatus) {
            // 网页方式的数据结构
            userStatus = dashboard.dashboard.userStatus;
        } else if (dashboard.userStatus) {
            // API方式的数据结构
            userStatus = dashboard.userStatus;
        } else {
            $.log("❌ 无法识别的面板数据结构");
            return null;
        }

        availablePoints = userStatus.availablePoints || 0;
        levelInfo = userStatus.levelInfo || {};
        counters = userStatus.counters || {};
        dailyPoint = counters.dailyPoint ? counters.dailyPoint[0] : {};
        
        let dailyProgressStr = "";
        if (dailyPoint.pointProgress !== undefined && dailyPoint.pointProgressMax !== undefined) {
            dailyProgressStr = `${dailyPoint.pointProgress}/${dailyPoint.pointProgressMax}`;
        }
        
        $.log(`📊 面板数据: 积分${availablePoints} 等级:${levelInfo.activeLevelName || '未知'} 进度:${dailyProgressStr}`)
        
        return {
            availablePoints,
            level: levelInfo.activeLevelName,
            dailyProgress: dailyProgressStr
        };
    } catch (e) {
        $.log(`❌ 处理面板数据出错: ${e.message}`);
        return null;
    }
}

// 修复的Cookie验证函数
async function validateCookieFixed() {
    return new Promise((resolve, reject) => {
        const testUrl = "https://rewards.bing.com/api/getuserinfo?type=1"
        
        const headers = {
            "accept": "application/json",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cookie": bingPointCookie,
            "referer": "https://rewards.bing.com/",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1"
        }
        
        // 添加请求超时
        const timeoutId = setTimeout(() => {
            reject(new Error("Cookie验证超时"));
        }, 8000);
        
        $.get({
            url: testUrl, 
            headers: headers, 
            timeout: 8000
        }, (error, response, data) => {
            clearTimeout(timeoutId); // 清除超时计时器
            
            if (error) {
                $.log(`❌ Cookie验证请求失败: ${error}`)
                resolve(false)
                return
            }
            
            $.log(`📊 验证响应状态码: ${response.statusCode}`)
            
            if (response.statusCode === 200) {
                try {
                    const result = JSON.parse(data)
                    if (result && (result.userStatus || result.dashboard)) {
                        $.log("✅ Cookie验证成功")
                        resolve(true)
                    } else {
                        $.log("❌ Cookie验证失败: 返回数据格式不正确")
                        resolve(false)
                    }
                } catch (e) {
                    $.log(`❌ Cookie验证失败: JSON解析错误 - ${e}`)
                    resolve(false)
                }
            } else if (response.statusCode === 401 || response.statusCode === 403) {
                $.log(`❌ Cookie验证失败: 认证失败 (${response.statusCode})`)
                resolve(false)
            } else {
                $.log(`❌ Cookie验证失败: 状态码 ${response.statusCode}`)
                resolve(false)
            }
        })
    })
}

// ==================== 搜索相关函数 ====================

// 带实时积分监控的搜索执行
async function executeSearchWithMonitoring(deviceType, times, deviceName) {
    const cookie = deviceType === 'pc' ? pc_cookie : mobile_cookie;
    
    if (!cookie) {
        $.log(`❌${deviceName} Cookie为空,无法进行搜索!`);
        return 0;
    }

    $.log(`开始执行${times}次${deviceName}搜索任务...`);
    
    let successfulSearches = 0;
    let totalPoints = 0;
    const pointsPerSearch = 3;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    for (let i = 1; i <= times; i++) {
        try {
            const result = await executeSingleSearch(deviceType, i, cookie);
            if (result === 'success') {
                successfulSearches++;
                totalPoints += pointsPerSearch;
                consecutiveFailures = 0;
                
                if (successfulSearches % 5 === 0 || successfulSearches === 1) {
                    $.log(`🎊 ${deviceName}已完成${successfulSearches}次搜索，获得 ${totalPoints} 分`);
                }
            } else {
                $.log(`⚠️ 第${i}次搜索失败`);
                consecutiveFailures++;
                
                // 如果连续失败次数过多，提前结束
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    $.log(`❌ ${deviceName}连续失败${consecutiveFailures}次，提前结束搜索`);
                    break;
                }
            }
            
            // 添加随机间隔
            if (i < times) {
                const waitTime = Math.min(interval + Math.floor(Math.random() * 3), 10);
                await $.wait(waitTime * 1000);
            }
            
        } catch (error) {
            $.log(`❌ 第${i}次搜索执行异常: ${error.message}`);
            consecutiveFailures++;
            
            if (consecutiveFailures >= maxConsecutiveFailures) {
                $.log(`❌ ${deviceName}连续异常${consecutiveFailures}次，提前结束搜索`);
                break;
            }
        }
    }
    
    $.log(`🎉${deviceName}搜索完成: 成功${successfulSearches}次, 获得${totalPoints}分`);
    return totalPoints;
}

// 单次搜索执行 - 添加超时保护
async function executeSingleSearch(deviceType, round, cookie) {
    const randomWord = generateRandomKeyword();
    const searchUrl = `https://${host}/search?q=${encodeURIComponent(randomWord)}&form=QBLH&sp=-1&lq=0&pq=${encodeURIComponent(randomWord.substring(0, 3))}&sc=10-3&qs=n&sk=&cvid=${generateRandomId()}`;

    const options = {
        url: searchUrl,
        headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "user-agent": deviceType === 'pc' 
                ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
                : "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
            "referer": `https://${host}/`,
            "Cookie": cookie
        },
        timeout: 10000
    };

    try {
        const resp = await $.http.get(options);
        
        if (resp.statusCode === 200) {
            $.log(`🎉${deviceType === 'pc' ? '💻' : '📱'}第${round}次${deviceType === 'pc' ? 'PC' : '移动'}搜索成功 - "${randomWord}"`);
            return 'success';
        } else {
            $.log(`⚠️第${round}次${deviceType === 'pc' ? 'PC' : '移动'}搜索失败: 状态码 ${resp.statusCode}`);
            return 'failed';
        }
    } catch (reason) {
        $.log(`❌第${round}次${deviceType === 'pc' ? 'PC' : '移动'}搜索出错:`, reason.error || reason.message);
        return 'failed';
    }
}

// 积分任务执行 - 简化版本，避免复杂操作
async function executePointTasks() {
    if (!bingPointCookie) {
        $.log("❌ 积分Cookie为空，跳过积分任务");
        return 0;
    }
    
    let earnedPoints = 0;
    
    try {
        $.log("🔄 正在获取积分面板数据...");
        const dashboard = await getDashboardAPIFixed();
        
        if (!dashboard) {
            return 0;
        }
        
        // 简化任务执行，只尝试执行URL奖励任务
        const promotions = await extractPromotionsFromDashboard(dashboard);
        
        $.log(`📋发现 ${promotions.length} 个积分任务`);
        
        // 限制任务执行数量，避免长时间运行
        const maxTasks = 5;
        let executedTasks = 0;
        
        for (const task of promotions) {
            if (executedTasks >= maxTasks) break;
            
            if (task.complete === false && task.pointProgressMax > 0) {
                const title = task.title || task.attributes?.title || "未知任务";
                const points = task.pointProgressMax;
                const type = task.promotionType || task.attributes?.type;
                
                $.log(`🔄开始任务: ${title} (${points}分)`);
                
                if (type === "urlreward") {
                    try {
                        const result = await completeUrlRewardTask(task);
                        if (result) {
                            earnedPoints += points;
                            $.log(`🎉完成任务: ${title} +${points}分`);
                        }
                    } catch (e) {
                        $.log(`❌任务执行异常: ${title}`, e);
                    }
                    executedTasks++;
                    
                    // 任务间等待
                    await $.wait(2000);
                }
            }
        }
        
    } catch (e) {
        $.log("❌积分任务执行出错:", e);
    }
    
    return earnedPoints;
}

// 从dashboard数据中提取任务信息
async function extractPromotionsFromDashboard(dashboard) {
    const promotions = [];
    
    try {
        // 从morePromotions提取
        if (dashboard.morePromotions && Array.isArray(dashboard.morePromotions)) {
            promotions.push(...dashboard.morePromotions);
        }
        
        // 从morePromotionsWithoutPromotionalItems提取
        if (dashboard.morePromotionsWithoutPromotionalItems && Array.isArray(dashboard.morePromotionsWithoutPromotionalItems)) {
            promotions.push(...dashboard.morePromotionsWithoutPromotionalItems);
        }
        
        // 添加promotionalItem
        if (dashboard.promotionalItem) {
            promotions.push(dashboard.promotionalItem);
        }
        
    } catch (e) {
        $.log(`❌ 提取任务信息失败: ${e.message}`);
    }
    
    return promotions;
}

// 完成URL奖励任务 - 添加超时保护
async function completeUrlRewardTask(task) {
    const url = task.destinationUrl || task.attributes?.destination;
    if (!url) {
        $.log("❌ 任务缺少目标URL");
        return false;
    }
    
    const headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cookie": bingPointCookie,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "referer": "https://rewards.bing.com/"
    };
    
    try {
        const response = await $.http.get({
            url: url,
            headers: headers,
            timeout: 10000
        });
        
        if (response.statusCode === 200) {
            $.log(`✅ 成功访问任务URL`);
            return true;
        } else {
            $.log(`❌ 访问任务URL失败，状态码: ${response.statusCode}`);
            return false;
        }
    } catch (e) {
        $.log(`❌ 访问任务URL异常: ${e.message}`);
        return false;
    }
}

// 随机关键词生成
function generateRandomKeyword() {
    const prefixes = ['什么是', '如何', '为什么', '最好的', '最新的', '学习', '了解', '探索', '发现', '研究'];
    const topics = ['人工智能', '机器学习', '深度学习', '神经网络', '计算机视觉', '自然语言处理', '大数据', '云计算', 
                   '物联网', '区块链', '加密货币', '网络安全', '数据科学', '编程语言', '软件开发'];
    const suffixes = ['的原理', '的应用', '的发展', '的未来', '的技巧', '的方法'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const suffix = Math.random() > 0.3 ? suffixes[Math.floor(Math.random() * suffixes.length)] : '';
    const randomNum = Math.floor(Math.random() * 999);
    
    return `${prefix}${topic}${suffix} ${randomNum}`;
}

// 生成随机ID
function generateRandomId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Env类实现 (Quantumult X兼容)
function Env(name) {
    this.name = name
    this.log = (msg) => console.log(`[${this.name}] ${msg}`)
    this.getdata = (key) => $prefs.valueForKey(key)
    this.setdata = (val, key) => $prefs.setValueForKey(val, key)
    this.get = (opts, callback) => {
        if (typeof opts === 'string') opts = {url: opts}
        opts.headers = opts.headers || {}
        opts.timeout = opts.timeout || 15000
        
        $task.fetch(opts).then(
            resp => {
                callback(null, {statusCode: resp.statusCode, headers: resp.headers}, resp.body)
            },
            err => {
                callback(err, null, null)
            }
        )
    }
    this.post = (opts, callback) => {
        if (typeof opts === 'string') opts = {url: opts}
        opts.method = 'POST'
        opts.headers = opts.headers || {}
        opts.timeout = opts.timeout || 15000
        
        $task.fetch(opts).then(
            resp => {
                callback(null, {statusCode: resp.statusCode, headers: resp.headers}, resp.body)
            },
            err => {
                callback(err, null, null)
            }
        )
    }
    this.notify = (title, subtitle, body) => {
        $notify(title, subtitle, body)
    }
    this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    this.done = () => {}
    this.http = {
        get: (options) => {
            return new Promise((resolve, reject) => {
                this.get(options, (error, response, body) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                })
            })
        },
        post: (options) => {
            return new Promise((resolve, reject) => {
                this.post(options, (error, response, body) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                })
            })
        }
    }
}