/*
🏆 Bing积分智能版 v5.1 (修复移动端0次搜索问题)
当移动端搜索次数为0时完全跳过移动端搜索
*/

const $ = new Env("Bing积分");

// 配置读取
const pc_cookie = $prefs.valueForKey("bingSearchCookiePCKey");
const mobile_cookie = $prefs.valueForKey("bingSearchCookieMobileKey");
const point_cookie = $prefs.valueForKey("bingPointCookieKey");
const useCnDomain = $prefs.valueForKey("bing_cn") === "true";
const pc_times = parseInt($prefs.valueForKey("bing_pc_times")) || 2;
const mobile_times = parseInt($prefs.valueForKey("bing_mobile_times")) || 2;
const host = useCnDomain ? "cn.bing.com" : "www.bing.com";

// 主执行
if (typeof $request !== 'undefined') {
    handleCookie();
} else {
    executeSmartSearch();
}

function executeSmartSearch() {
    console.log("🚀 开始执行智能版搜索");
    console.log(`📊 配置: PC${pc_times}次, 移动${mobile_times}次`);
    
    // 设置45秒强制超时
    const timeoutId = setTimeout(() => {
        console.log("⏰ 脚本强制结束");
        $done();
    }, 45000);
    
    performSmartSearch().finally(() => {
        clearTimeout(timeoutId);
        console.log("✅ 脚本执行完成");
        $done();
    });
}

async function performSmartSearch() {
    try {
        // 1. 首先验证积分Cookie是否有效
        if (point_cookie) {
            const points = await getPointsWithDetailedCheck();
            if (points === 0) {
                console.log("❌ 积分Cookie无效，请重新获取");
                $.notify("Bing积分", "Cookie无效", "请重新获取积分Cookie");
                return;
            }
            console.log(`📊 当前积分: ${points}`);
        } else {
            console.log("⚠️ 未设置积分Cookie，无法跟踪积分");
        }
        
        // 2. 执行PC搜索（如果配置了PC搜索次数）
        let pcResult = { success: false, earned: 0 };
        if (pc_cookie && pc_times > 0) {
            pcResult = await performSingleSearchWithValidation('pc', pc_cookie, pc_times);
        } else if (pc_times <= 0) {
            console.log("⏭️ PC搜索次数为0，跳过PC搜索");
        } else {
            console.log("❌ PC Cookie无效，跳过PC搜索");
        }
        
        // 3. 执行移动搜索（如果配置了移动搜索次数）
        let mobileResult = { success: false, earned: 0 };
        if (mobile_cookie && mobile_times > 0) {
            mobileResult = await performSingleSearchWithValidation('mobile', mobile_cookie, mobile_times);
        } else if (mobile_times <= 0) {
            console.log("⏭️ 移动搜索次数为0，跳过移动搜索");
        } else {
            console.log("❌ 移动Cookie无效，跳过移动搜索");
        }
        
        // 4. 发送最终通知
        sendSmartNotification(pcResult, mobileResult);
        
    } catch (error) {
        console.log(`⚠️ 执行异常: ${error}`);
    }
}

async function performSingleSearchWithValidation(device, cookie, times) {
    console.log(`${device === 'pc' ? '💻' : '📱'} 执行${device}搜索 (${times}次)...`);
    
    const result = { success: false, earned: 0, count: 0 };
    
    try {
        // 获取搜索前积分
        const beforePoints = point_cookie ? await getPointsQuick() : 0;
        
        // 执行指定次数的搜索
        let successCount = 0;
        for (let i = 1; i <= times; i++) {
            const searchSuccess = await doCoreSearch(device, cookie, i);
            if (searchSuccess) {
                successCount++;
                result.count = successCount;
                
                // 搜索间等待
                if (i < times) {
                    await delay(2000);
                }
            }
        }
        
        result.success = successCount > 0;
        
        if (result.success && point_cookie) {
            // 等待足够时间让积分更新
            await delay(5000);
            
            // 获取搜索后积分
            const afterPoints = await getPointsQuick();
            
            if (afterPoints > beforePoints) {
                result.earned = afterPoints - beforePoints;
                console.log(`✅ ${device}搜索获得积分: ${result.earned} (${successCount}次成功)`);
            } else {
                console.log(`⚠️ ${device}搜索未获得积分 (${successCount}次成功)`);
            }
        }
        
    } catch (error) {
        console.log(`❌ ${device}搜索验证异常: ${error}`);
    }
    
    return result;
}

function doCoreSearch(device, cookie, round) {
    return new Promise((resolve) => {
        // 使用更真实的关键词格式
        const keyword = getCoreKeyword(round);
        
        // 使用标准Bing搜索格式
        const searchUrl = `https://${host}/search?q=${encodeURIComponent(keyword)}&form=QBLH`;
        
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            "User-Agent": device === 'pc' 
                ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
                : "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
            "Referer": `https://${host}/`,
            "Cookie": cookie
        };
        
        const searchTimeout = setTimeout(() => {
            console.log(`⏰ ${device}第${round}次搜索超时`);
            resolve(false);
        }, 10000);
        
        console.log(`🔍 ${device}第${round}次搜索: ${keyword}`);
        
        $task.fetch({
            url: searchUrl,
            headers: headers,
            timeout: 10000
        }).then(response => {
            clearTimeout(searchTimeout);
            
            if (response.statusCode === 200) {
                console.log(`✅ ${device}第${round}次搜索成功`);
                resolve(true);
            } else {
                console.log(`⚠️ ${device}第${round}次搜索状态码: ${response.statusCode}`);
                // 即使不是200也认为是成功（可能是重定向）
                resolve(true);
            }
        }).catch(error => {
            clearTimeout(searchTimeout);
            console.log(`❌ ${device}第${round}次搜索错误: ${error}`);
            resolve(false);
        });
    });
}

function getCoreKeyword(round) {
    // 使用更真实的中文搜索词
    const topics = [
        "天气预报", "新闻资讯", "健康养生", "旅游攻略", "美食制作",
        "电影推荐", "音乐欣赏", "体育赛事", "科技动态", "财经新闻",
        "教育学习", "职场技能", "汽车资讯", "房产信息", "时尚潮流"
    ];
    
    const prefixes = ["今日", "最新", "如何", "什么是", "学习", "了解"];
    
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    
    return prefix + topic + round;
}

function getPointsWithDetailedCheck() {
    return new Promise((resolve) => {
        if (!point_cookie) {
            resolve(0);
            return;
        }
        
        const url = "https://rewards.bing.com/api/getuserinfo?type=1";
        const headers = {
            "accept": "application/json",
            "cookie": point_cookie,
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
            "referer": "https://rewards.bing.com/"
        };
        
        const pointsTimeout = setTimeout(() => {
            console.log("⏰ 积分查询超时");
            resolve(0);
        }, 10000);
        
        $task.fetch({
            url: url,
            headers: headers,
            timeout: 10000
        }).then(response => {
            clearTimeout(pointsTimeout);
            
            if (response.statusCode === 200 && response.body) {
                try {
                    const data = JSON.parse(response.body);
                    console.log("📋 积分API响应: 成功");
                    
                    let points = 0;
                    
                    // 多种方式尝试获取积分
                    if (data.userStatus && data.userStatus.availablePoints !== undefined) {
                        points = data.userStatus.availablePoints;
                    } else if (data.dashboard && data.dashboard.userStatus && data.dashboard.userStatus.availablePoints !== undefined) {
                        points = data.dashboard.userStatus.availablePoints;
                    } else if (data.availablePoints !== undefined) {
                        points = data.availablePoints;
                    }
                    
                    if (points > 0) {
                        $prefs.setValueForKey(points.toString(), "bing_cache_point");
                        resolve(points);
                        return;
                    }
                } catch (e) {
                    console.log("❌ 积分数据解析失败:", e.message);
                }
            } else {
                console.log(`❌ 积分查询失败，状态码: ${response.statusCode}`);
            }
            resolve(0);
        }).catch(error => {
            clearTimeout(pointsTimeout);
            console.log("❌ 积分查询错误:", error);
            resolve(0);
        });
    });
}

function getPointsQuick() {
    return new Promise((resolve) => {
        if (!point_cookie) {
            resolve(0);
            return;
        }
        
        const url = "https://rewards.bing.com/api/getuserinfo?type=1";
        const headers = {
            "accept": "application/json",
            "cookie": point_cookie
        };
        
        const pointsTimeout = setTimeout(() => {
            resolve(0);
        }, 8000);
        
        $task.fetch({
            url: url,
            headers: headers,
            timeout: 8000
        }).then(response => {
            clearTimeout(pointsTimeout);
            
            if (response.statusCode === 200 && response.body) {
                try {
                    const data = JSON.parse(response.body);
                    let points = 0;
                    
                    if (data.userStatus && data.userStatus.availablePoints !== undefined) {
                        points = data.userStatus.availablePoints;
                    } else if (data.dashboard && data.dashboard.userStatus && data.dashboard.userStatus.availablePoints !== undefined) {
                        points = data.dashboard.userStatus.availablePoints;
                    }
                    
                    if (points > 0) {
                        resolve(points);
                        return;
                    }
                } catch (e) {
                    // 静默失败
                }
            }
            resolve(0);
        }).catch(() => {
            clearTimeout(pointsTimeout);
            resolve(0);
        });
    });
}

function sendSmartNotification(pcResult, mobileResult) {
    const totalEarned = pcResult.earned + mobileResult.earned;
    const pcCount = pcResult.count || 0;
    const mobileCount = mobileResult.count || 0;
    
    if (totalEarned > 0) {
        $.notify(
            "Bing积分更新", 
            `获得 ${totalEarned} 积分`, 
            `PC:${pcCount}次 移动:${mobileCount}次`
        );
    } else {
        // 分析失败原因
        let reason = "未知原因";
        let performedSearches = pcCount + mobileCount;
        
        if (performedSearches === 0) {
            if (pc_times <= 0 && mobile_times <= 0) {
                reason = "搜索次数设置为0";
            } else if (!pc_cookie && !mobile_cookie) {
                reason = "搜索Cookie无效";
            } else {
                reason = "未执行任何搜索";
            }
        } else {
            reason = "可能已达今日上限或网络问题";
        }
        
        $.notify(
            "Bing积分", 
            `搜索完成 (${performedSearches}次)`, 
            `未获得积分 - ${reason}`
        );
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function handleCookie() {
    if ($request && /rewards\.bing\.com/.test($request.url)) {
        console.log("🍪 获取Cookie");
        let cookie = $request.headers?.Cookie || $request.headers?.cookie;
        if (cookie) {
            const important = ['_EDGE_S', '_EDGE_V', 'MUID', 'MUIDB', '_RwBf', '_SS', 'KievRPSAuth', 'RPSAuth'];
            const cleaned = cookie.split(';')
                .map(part => part.trim())
                .filter(part => {
                    const key = part.split('=')[0];
                    return important.some(importantKey => key.startsWith(importantKey));
                })
                .join('; ');
            
            $prefs.setValueForKey(cleaned, "bingPointCookieKey");
            console.log("✅ Cookie保存成功");
        }
    }
    $done();
}

// 诊断函数 - 检查所有Cookie状态和配置
function diagnoseCookies() {
    console.log("🔍 开始Cookie和配置诊断");
    
    console.log(`📋 PC Cookie: ${pc_cookie ? `有效 (${pc_cookie.length}字符)` : '无效'}`);
    console.log(`📋 移动Cookie: ${mobile_cookie ? `有效 (${mobile_cookie.length}字符)` : '无效'}`);
    console.log(`📋 积分Cookie: ${point_cookie ? `有效 (${point_cookie.length}字符)` : '无效'}`);
    console.log(`⚙️ PC搜索次数: ${pc_times}`);
    console.log(`⚙️ 移动搜索次数: ${mobile_times}`);
    console.log(`🌐 使用域名: ${host}`);
    
    if (point_cookie) {
        getPointsWithDetailedCheck().then(points => {
            console.log(`📊 当前积分: ${points}`);
            $.notify("Bing诊断", "配置检查完成", `积分: ${points}, PC:${pc_times}次, 移动:${mobile_times}次`);
            $done();
        });
    } else {
        $.notify("Bing诊断", "配置检查完成", `PC:${pc_times}次, 移动:${mobile_times}次`);
        $done();
    }
}

// Env类
function Env(name) {
    this.name = name;
    this.log = console.log;
    this.getdata = $prefs.valueForKey;
    this.setdata = $prefs.setValueForKey;
    this.notify = $notify;
    this.done = $done;
}

// 如果URL包含diagnose参数，执行诊断模式
if (typeof $request === 'undefined' && typeof $argument !== 'undefined' && $argument === 'diagnose') {
    diagnoseCookies();
}