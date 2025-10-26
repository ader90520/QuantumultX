/*
🏆 Bing积分智能版 v5.2 (修复BoxJS配置同步问题)
完全支持BoxJS参数配置，智能跳过0次搜索
*/

const $ = new Env("Bing积分");

// 配置读取 - 修复键名和默认值问题
const getConfig = () => {
    // 读取BoxJS配置，正确处理默认值
    const pc_cookie = $prefs.valueForKey("bingSearchCookiePCKey");
    const mobile_cookie = $prefs.valueForKey("bingSearchCookieMobileKey");
    const point_cookie = $prefs.valueForKey("bingPointCookieKey");
    
    // 修复配置读取：正确处理布尔值和数字
    const useCnDomain = $prefs.valueForKey("bing_cn") === "true";
    const pc_times = parseInt($prefs.valueForKey("bing_pc_times")) || 0; // 默认改为0
    const mobile_times = parseInt($prefs.valueForKey("bing_mobile_times")) || 0; // 默认改为0
    const search_interval = parseInt($prefs.valueForKey("bing_interval")) || 5;
    const reset_hours = parseInt($prefs.valueForKey("bing_reset_hours")) || 8;
    
    const host = useCnDomain ? "cn.bing.com" : "www.bing.com";
    
    return {
        pc_cookie,
        mobile_cookie,
        point_cookie,
        pc_times,
        mobile_times,
        search_interval,
        reset_hours,
        host,
        useCnDomain
    };
};

// 主执行
if (typeof $request !== 'undefined') {
    handleCookie();
} else {
    executeSmartSearch();
}

function executeSmartSearch() {
    const config = getConfig();
    
    console.log("🚀 开始执行智能版搜索 v5.2");
    console.log(`📊 BoxJS配置: PC${config.pc_times}次, 移动${config.mobile_times}次`);
    console.log(`⚙️ 搜索间隔: ${config.search_interval}秒, 重置时间: ${config.reset_hours}点`);
    
    // 配置验证日志
    if (config.pc_times === 0) console.log("⏭️ PC搜索次数为0，将跳过PC搜索");
    if (config.mobile_times === 0) console.log("⏭️ 移动搜索次数为0，将跳过移动搜索");
    if (!config.pc_cookie && config.pc_times > 0) console.log("❌ PC Cookie未设置，但PC搜索次数>0");
    if (!config.mobile_cookie && config.mobile_times > 0) console.log("❌ 移动Cookie未设置，但移动搜索次数>0");
    
    // 设置45秒强制超时
    const timeoutId = setTimeout(() => {
        console.log("⏰ 脚本强制结束");
        $done();
    }, 45000);
    
    performSmartSearch(config).finally(() => {
        clearTimeout(timeoutId);
        console.log("✅ 脚本执行完成");
        $done();
    });
}

async function performSmartSearch(config) {
    try {
        // 1. 首先验证积分Cookie是否有效
        if (config.point_cookie) {
            const points = await getPointsWithDetailedCheck(config.point_cookie);
            if (points === 0) {
                console.log("❌ 积分Cookie无效，请重新获取");
                $.notify("Bing积分", "Cookie无效", "请重新获取积分Cookie");
                return;
            }
            console.log(`📊 当前积分: ${points}`);
            // 更新缓存积分
            $prefs.setValueForKey(points.toString(), "bing_cache_point");
        } else {
            console.log("⚠️ 未设置积分Cookie，无法跟踪积分");
        }
        
        // 2. 执行PC搜索（严格根据BoxJS配置）
        let pcResult = { success: false, earned: 0, count: 0 };
        if (config.pc_cookie && config.pc_times > 0) {
            pcResult = await performSingleSearchWithValidation('pc', config.pc_cookie, config.pc_times, config);
            console.log(`💻 PC搜索完成: ${pcResult.count}/${config.pc_times}次成功`);
        } else if (config.pc_times <= 0) {
            console.log("⏭️ PC搜索次数为0，已跳过PC搜索");
        } else {
            console.log("❌ PC Cookie无效，跳过PC搜索");
        }
        
        // 3. 执行移动搜索（严格根据BoxJS配置）
        let mobileResult = { success: false, earned: 0, count: 0 };
        if (config.mobile_cookie && config.mobile_times > 0) {
            mobileResult = await performSingleSearchWithValidation('mobile', config.mobile_cookie, config.mobile_times, config);
            console.log(`📱 移动搜索完成: ${mobileResult.count}/${config.mobile_times}次成功`);
        } else if (config.mobile_times <= 0) {
            console.log("⏭️ 移动搜索次数为0，已跳过移动搜索");
        } else {
            console.log("❌ 移动Cookie无效，跳过移动搜索");
        }
        
        // 4. 发送最终通知
        sendSmartNotification(pcResult, mobileResult, config);
        
    } catch (error) {
        console.log(`⚠️ 执行异常: ${error}`);
        $.notify("Bing积分错误", "执行异常", error.message);
    }
}

async function performSingleSearchWithValidation(device, cookie, times, config) {
    console.log(`${device === 'pc' ? '💻' : '📱'} 开始执行${device}搜索 (目标:${times}次)...`);
    
    const result = { success: false, earned: 0, count: 0 };
    
    try {
        // 获取搜索前积分
        const beforePoints = config.point_cookie ? await getPointsQuick(config.point_cookie) : 0;
        
        // 执行指定次数的搜索
        let successCount = 0;
        for (let i = 1; i <= times; i++) {
            const searchSuccess = await doCoreSearch(device, cookie, i, config.host);
            if (searchSuccess) {
                successCount++;
                result.count = successCount;
                
                // 使用BoxJS配置的搜索间隔
                if (i < times) {
                    const interval = config.search_interval * 1000; // 转换为毫秒
                    console.log(`⏳ 等待${config.search_interval}秒后进行下一次搜索...`);
                    await delay(interval);
                }
            }
        }
        
        result.success = successCount > 0;
        
        if (result.success && config.point_cookie) {
            // 等待足够时间让积分更新
            await delay(5000);
            
            // 获取搜索后积分
            const afterPoints = await getPointsQuick(config.point_cookie);
            
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

function doCoreSearch(device, cookie, round, host) {
    return new Promise((resolve) => {
        const keyword = getCoreKeyword(round);
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
                resolve(true); // 即使不是200也继续
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

function getPointsWithDetailedCheck(cookie) {
    return new Promise((resolve) => {
        if (!cookie) {
            resolve(0);
            return;
        }
        
        const url = "https://rewards.bing.com/api/getuserinfo?type=1";
        const headers = {
            "accept": "application/json",
            "cookie": cookie,
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

function getPointsQuick(cookie) {
    return new Promise((resolve) => {
        if (!cookie) {
            resolve(0);
            return;
        }
        
        const url = "https://rewards.bing.com/api/getuserinfo?type=1";
        const headers = {
            "accept": "application/json",
            "cookie": cookie
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

function sendSmartNotification(pcResult, mobileResult, config) {
    const totalEarned = pcResult.earned + mobileResult.earned;
    const pcCount = pcResult.count || 0;
    const mobileCount = mobileResult.count || 0;
    const totalConfigured = config.pc_times + config.mobile_times;
    
    if (totalEarned > 0) {
        $.notify(
            "Bing积分更新", 
            `获得 ${totalEarned} 积分`, 
            `PC:${pcCount}/${config.pc_times}次 移动:${mobileCount}/${config.mobile_times}次`
        );
    } else {
        let reason = "未知原因";
        const performedSearches = pcCount + mobileCount;
        
        if (performedSearches === 0) {
            if (config.pc_times === 0 && config.mobile_times === 0) {
                reason = "BoxJS中搜索次数设置为0";
            } else if (!config.pc_cookie && !config.mobile_cookie) {
                reason = "搜索Cookie未设置";
            } else {
                reason = "网络问题或Cookie失效";
            }
        } else if (performedSearches < totalConfigured) {
            reason = `部分搜索失败 (${performedSearches}/${totalConfigured}次)`;
        } else {
            reason = "可能已达今日上限";
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

// 诊断函数 - 显示当前BoxJS配置状态
function diagnoseConfig() {
    const config = getConfig();
    
    console.log("🔍 Bing积分脚本配置诊断");
    console.log("═".repeat(50));
    console.log(`📋 PC Cookie: ${config.pc_cookie ? `已设置 (${config.pc_cookie.length}字符)` : '未设置'}`);
    console.log(`📋 移动Cookie: ${config.mobile_cookie ? `已设置 (${config.mobile_cookie.length}字符)` : '未设置'}`);
    console.log(`📋 积分Cookie: ${config.point_cookie ? `已设置 (${config.point_cookie.length}字符)` : '未设置'}`);
    console.log(`⚙️ PC搜索次数: ${config.pc_times} (BoxJS: bing_pc_times)`);
    console.log(`⚙️ 移动搜索次数: ${config.mobile_times} (BoxJS: bing_mobile_times)`);
    console.log(`⏱️ 搜索间隔: ${config.search_interval}秒 (BoxJS: bing_interval)`);
    console.log(`🕒 重置时间: ${config.reset_hours}点 (BoxJS: bing_reset_hours)`);
    console.log(`🌐 使用域名: ${config.host} (BoxJS: bing_cn = ${config.useCnDomain})`);
    console.log("═".repeat(50));
    
    // 执行建议
    if (config.pc_times === 0 && config.mobile_times === 0) {
        console.log("💡 建议: BoxJS中搜索次数都设置为0，不会执行任何搜索");
    } else if (!config.pc_cookie && config.pc_times > 0) {
        console.log("💡 建议: 请在BoxJS中设置bingSearchCookiePCKey");
    } else if (!config.mobile_cookie && config.mobile_times > 0) {
        console.log("💡 建议: 请在BoxJS中设置bingSearchCookieMobileKey");
    }
    
    $.notify(
        "Bing配置诊断", 
        `PC:${config.pc_times}次 移动:${config.mobile_times}次`, 
        `域名:${config.host} 间隔:${config.search_interval}秒`
    );
}

// Env类
function Env(name) {
    this.name = name;
    this.log = console.log;
    this.getdata = (key) => $prefs.valueForKey(key);
    this.setdata = (value, key) => $prefs.setValueForKey(value, key);
    this.notify = (title, subtitle, message) => {
        if ($notify) {
            $notify(title, subtitle, message);
        }
    };
    this.done = () => {
        if ($done) {
            $done();
        }
    };
}

// 诊断模式入口
if (typeof $request === 'undefined' && typeof $argument !== 'undefined' && $argument === 'diagnose') {
    diagnoseConfig();
    $done();
}