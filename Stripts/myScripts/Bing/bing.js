/*
🏆 Bing积分安全优化版 v6.2
解决积分不增加问题，大幅延长搜索间隔，增强安全性
*/

const $ = new Env("Bing积分优化版");

class BingSafeManager {
    constructor() {
        this.config = this.loadConfig();
        this.STATUS = {
            SAFE: "SAFE",
            RESTRICTED: "RESTRICTED", 
            UNKNOWN: "UNKNOWN",
            NO_COOKIE: "NO_COOKIE"
        };
        this.consecutiveFailures = parseInt($prefs.valueForKey("bing_consecutive_failures")) || 0;
    }

    loadConfig() {
        return {
            // Cookie设置
            pc_cookie: $prefs.valueForKey("bingSearchCookiePCKey"),
            mobile_cookie: $prefs.valueForKey("bingSearchCookieMobileKey"),
            point_cookie: $prefs.valueForKey("bingPointCookieKey"),
            
            // 搜索设置 - 大幅减少次数
            pc_times: Math.min(Math.max(parseInt($prefs.valueForKey("bing_pc_times")) || 1, 1), 2),
            mobile_times: Math.min(Math.max(parseInt($prefs.valueForKey("bing_mobile_times")) || 1, 1), 2),
            
            // 间隔设置 - 大幅延长间隔时间
            min_interval: Math.max(parseInt($prefs.valueForKey("bing_min_interval")) || 300, 180), // 3-10分钟
            max_interval: Math.max(parseInt($prefs.valueForKey("bing_max_interval")) || 600, 300),
            
            // 基础间隔设置
            base_interval: Math.max(parseInt($prefs.valueForKey("bing_interval")) || 600, 300),
            
            // 积分检查设置
            point_check_interval: Math.max(parseInt($prefs.valueForKey("bing_point_check_interval")) || 3, 1),
            run_count: parseInt($prefs.valueForKey("bing_run_count")) || 0,
            
            // 安全控制
            safe_mode: $prefs.valueForKey("bing_safe_mode") !== "false",
            auto_skip_enabled: $prefs.valueForKey("bing_auto_skip") !== "false",
            max_daily_searches: 4, // 大幅减少每日上限
            host: $prefs.valueForKey("bing_cn") === "true" ? "cn.bing.com" : "www.bing.com",
            
            // 状态记录
            last_check_date: $prefs.valueForKey("bing_last_check_date"),
            last_success_date: $prefs.valueForKey("bing_last_success_date"),
            daily_search_count: parseInt($prefs.valueForKey("bing_daily_count")) || 0,
            account_status: $prefs.valueForKey("bing_account_status") || "UNKNOWN",
            cache_point: parseInt($prefs.valueForKey("bing_cache_point")) || 0,
            last_points: parseInt($prefs.valueForKey("bing_last_points")) || 0
        };
    }

    async startSafeManagement() {
        console.log("🚀 Bing积分安全优化版 v6.2 启动");
        console.log("🛡️  配置: 大幅延长间隔，严格安全检查");
        console.log("═".repeat(50));
        
        // 更新运行计数
        this.updateRunCount();
        
        // 全面账户状态检查
        const accountStatus = await this.comprehensiveAccountCheck();
        
        // 检查是否需要跳过搜索（积分不增加时）
        const skipSearch = await this.shouldSkipSearch(accountStatus);
        
        if (skipSearch) {
            console.log("⏭️ 检测到积分不增加，跳过搜索任务");
            this.sendSkipSearchNotification(accountStatus);
            return;
        }
        
        if (accountStatus.status === this.STATUS.SAFE && !skipSearch) {
            console.log("✅ 账户状态正常，执行安全搜索");
            await this.executeUltraSafeSearch(accountStatus);
        } else if (accountStatus.status === this.STATUS.RESTRICTED) {
            console.log("🚫 账户受限制，仅执行状态监控");
            this.sendRestrictedNotification(accountStatus);
        } else {
            console.log("⚠️ 账户状态未知，执行保守策略");
            this.sendUnknownStatusNotification(accountStatus);
        }
        
        // 更新账户状态记录
        this.updateAccountStatus(accountStatus);
    }

    async shouldSkipSearch(accountStatus) {
        // 如果连续失败次数过多，跳过搜索
        if (this.consecutiveFailures >= 3) {
            console.log(`🚫 连续${this.consecutiveFailures}次未获得积分，跳过搜索`);
            return true;
        }
        
        // 检查上次积分是否增加
        if (this.config.last_points > 0 && accountStatus.points > 0) {
            if (accountStatus.points <= this.config.last_points) {
                console.log(`⚠️ 积分未增加: ${this.config.last_points} → ${accountStatus.points}`);
                this.consecutiveFailures++;
                $prefs.setValueForKey(this.consecutiveFailures.toString(), "bing_consecutive_failures");
                return true;
            } else {
                // 积分增加了，重置失败计数
                this.consecutiveFailures = 0;
                $prefs.setValueForKey("0", "bing_consecutive_failures");
            }
        }
        
        return false;
    }

    updateRunCount() {
        let runCount = this.config.run_count + 1;
        $prefs.setValueForKey(runCount.toString(), "bing_run_count");
        console.log(`📊 运行计数: ${runCount}/${this.config.point_check_interval}`);
    }

    async executeUltraSafeSearch(accountStatus) {
        console.log("2. 执行超安全搜索...");
        
        // 检查搜索条件
        const searchCheck = this.checkSearchConditions();
        if (!searchCheck.allowed) {
            console.log(`⏭️ 跳过搜索: ${searchCheck.reason}`);
            this.sendSkipNotification(accountStatus, searchCheck.reason);
            return;
        }

        let startPoints = accountStatus.points;
        let finalPoints = 0;
        let searchCount = 0;

        try {
            // 记录开始积分
            $prefs.setValueForKey(startPoints.toString(), "bing_last_points");
            
            // PC搜索
            if (this.config.pc_cookie && this.config.pc_times > 0) {
                console.log(`💻 开始PC搜索 (${this.config.pc_times}次)...`);
                const pcResult = await this.ultraSafeDeviceSearch('pc', this.config.pc_cookie, this.config.pc_times);
                searchCount += pcResult.searches;
                console.log(`💻 PC搜索完成: ${pcResult.searches}次`);
            }

            // 移动搜索
            if (this.config.mobile_cookie && this.config.mobile_times > 0) {
                console.log(`📱 开始移动搜索 (${this.config.mobile_times}次)...`);
                const mobileResult = await this.ultraSafeDeviceSearch('mobile', this.config.mobile_cookie, this.config.mobile_times);
                searchCount += mobileResult.searches;
                console.log(`📱 移动搜索完成: ${mobileResult.searches}次`);
            }

            // 更新搜索统计
            this.updateSearchStats(searchCount, true);

            // 等待更长的时间让积分更新
            console.log("⏳ 等待积分更新...");
            await this.delay(15000);

            // 检查是否需要获取积分
            if (this.shouldCheckPoints()) {
                console.log("🔍 达到积分检查间隔，获取积分面板...");
                finalPoints = await this.getPointsWithValidation(this.config.point_cookie);
                if (finalPoints > 0) {
                    console.log(`📊 当前积分: ${finalPoints}`);
                    $prefs.setValueForKey(finalPoints.toString(), "bing_cache_point");
                    
                    // 检查积分是否增加
                    if (finalPoints > startPoints) {
                        console.log("🎉 积分增加成功!");
                        this.consecutiveFailures = 0;
                        $prefs.setValueForKey("0", "bing_consecutive_failures");
                    } else {
                        console.log("⚠️ 积分未增加");
                        this.consecutiveFailures++;
                        $prefs.setValueForKey(this.consecutiveFailures.toString(), "bing_consecutive_failures");
                    }
                }
                // 重置运行计数
                $prefs.setValueForKey("0", "bing_run_count");
            } else {
                finalPoints = this.config.cache_point;
            }

            // 发送结果通知
            const earned = finalPoints > startPoints ? finalPoints - startPoints : 0;
            this.sendUltraSafeNotification(searchCount, earned, startPoints, finalPoints);

        } catch (error) {
            console.log(`❌ 搜索异常: ${error}`);
            $.notify("Bing积分搜索", "执行异常", "请检查网络连接");
        }
    }

    async ultraSafeDeviceSearch(device, cookie, times) {
        let successCount = 0;
        const actualSearches = Math.min(times, this.config.max_daily_searches - this.config.daily_search_count);
        
        if (actualSearches <= 0) {
            return { searches: 0 };
        }

        for (let i = 1; i <= actualSearches; i++) {
            console.log(`   🔍 ${device}第${i}次搜索...`);
            const success = await this.performValidatedSearch(device, cookie, i);
            
            if (success) {
                successCount++;
                
                // 大幅延长搜索间隔：3-10分钟随机延迟
                if (i < actualSearches) {
                    const delayTime = this.getExtendedInterval();
                    console.log(`   ⏳ 等待${Math.round(delayTime/1000)}秒后进行下一次搜索...`);
                    await this.delay(delayTime);
                }
            }
        }

        return { searches: successCount };
    }

    getExtendedInterval() {
        // 基础间隔 + 随机扰动
        const base = this.config.base_interval * 1000; // 转换为毫秒
        const min = this.config.min_interval * 1000;
        const max = this.config.max_interval * 1000;
        
        // 如果连续失败，进一步延长间隔
        const failureMultiplier = 1 + (this.consecutiveFailures * 0.5);
        const adjustedBase = base * failureMultiplier;
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async performValidatedSearch(device, cookie, round) {
        return new Promise((resolve) => {
            const keyword = this.generateNaturalKeyword(round);
            const searchUrl = `https://${this.config.host}/search?q=${encodeURIComponent(keyword)}&FORM=QBLH`;
            
            const headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "User-Agent": device === 'pc' 
                    ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
                    : "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1 EdgiOS/120.0.0.0",
                "Referer": `https://${this.config.host}/`,
                "Cookie": cookie,
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Upgrade-Insecure-Requests": "1"
            };

            const timeout = setTimeout(() => {
                console.log(`   ⏰ ${device}搜索超时`);
                resolve(false);
            }, 20000);

            $task.fetch({
                url: searchUrl,
                headers: headers,
                timeout: 20000
            }).then(response => {
                clearTimeout(timeout);
                
                if (response.statusCode === 200) {
                    if (response.body && this.isValidSearchResponse(response.body)) {
                        console.log(`   ✅ ${device}第${round}次搜索验证成功`);
                        resolve(true);
                    } else {
                        console.log(`   ⚠️ ${device}搜索响应异常`);
                        resolve(false);
                    }
                } else {
                    console.log(`   ⚠️ ${device}搜索状态码: ${response.statusCode}`);
                    resolve(false);
                }
            }).catch(error => {
                clearTimeout(timeout);
                console.log(`   ❌ ${device}搜索错误: ${error}`);
                resolve(false);
            });
        });
    }

    isValidSearchResponse(body) {
        if (!body) return false;
        
        const validIndicators = [
            'bing.com',
            'Bing',
            'search?q=',
            'var params',
            'Microsoft'
        ];
        
        return validIndicators.some(indicator => body.includes(indicator));
    }

    shouldCheckPoints() {
        return this.config.run_count >= this.config.point_check_interval;
    }

    checkSearchConditions() {
        if (this.config.auto_skip_enabled && this.config.last_success_date === new Date().toDateString()) {
            return { allowed: false, reason: "今日任务已完成" };
        }

        if (this.config.daily_search_count >= this.config.max_daily_searches) {
            return { 
                allowed: false, 
                reason: `今日搜索已达上限 (${this.config.daily_search_count}/${this.config.max_daily_searches})` 
            };
        }

        const hasValidCookies = (this.config.pc_cookie && this.config.pc_times > 0) || 
                               (this.config.mobile_cookie && this.config.mobile_times > 0);
        if (!hasValidCookies) {
            return { allowed: false, reason: "无有效的搜索Cookie配置" };
        }

        return { allowed: true };
    }

    generateNaturalKeyword(round) {
        const naturalTopics = [
            "人工智能技术发展", "机器学习算法应用", "深度学习框架比较", 
            "神经网络原理详解", "大数据分析方法", "云计算服务平台",
            "物联网技术应用", "区块链发展现状", "元宇宙概念解析",
            "数字化转型案例", "边缘计算技术", "量子计算进展",
            "计算机视觉应用", "自然语言处理技术", "自动驾驶发展",
            "网络安全防护", "数据隐私保护", "数字经济发展"
        ];
        
        const word = naturalTopics[Math.floor(Math.random() * naturalTopics.length)];
        return word;
    }

    async getPointsWithValidation(cookie) {
        const endpoints = [
            "https://rewards.bing.com/api/getuserinfo?type=1",
            "https://www.bing.com/rewards/api/getuserinfo?type=1"
        ];
        
        for (let endpoint of endpoints) {
            try {
                const points = await this.getPointsFromEndpoint(endpoint, cookie);
                if (points > 0) return points;
            } catch (e) {
                console.log(`端点 ${endpoint} 失败: ${e.message}`);
            }
        }
        return 0;
    }

    getPointsFromEndpoint(url, cookie) {
        return new Promise((resolve) => {
            const headers = {
                "accept": "application/json",
                "cookie": cookie,
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
                "referer": "https://rewards.bing.com/"
            };

            $task.fetch({
                url: url,
                headers: headers,
                timeout: 15000
            }).then(response => {
                if (response.statusCode === 200 && response.body) {
                    try {
                        const data = JSON.parse(response.body);
                        console.log("📋 积分API响应成功");
                        
                        let points = 0;
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
                        console.log("❌ 积分数据解析失败");
                    }
                }
                resolve(0);
            }).catch(() => resolve(0));
        });
    }

    updateSearchStats(searchesCount, success) {
        const today = new Date().toDateString();
        const newCount = this.config.daily_search_count + searchesCount;
        
        $prefs.setValueForKey(newCount.toString(), "bing_daily_count");
        
        if (success && searchesCount > 0) {
            $prefs.setValueForKey(today, "bing_last_success_date");
        }
        
        console.log(`📈 更新统计: 今日搜索 ${newCount}次`);
    }

    updateAccountStatus(status) {
        $prefs.setValueForKey(status.status, "bing_account_status");
        $prefs.setValueForKey(new Date().toISOString(), "bing_last_check_date");
    }

    sendUltraSafeNotification(searchesCount, pointsEarned, startPoints, finalPoints) {
        const runInfo = `运行: ${this.config.run_count}/${this.config.point_check_interval}`;
        const intervalInfo = `间隔: ${this.config.min_interval}-${this.config.max_interval}秒`;
        const failureInfo = this.consecutiveFailures > 0 ? `连续失败: ${this.consecutiveFailures}次` : "";
        
        let message = "";
        
        if (pointsEarned > 0) {
            message = `🎉 获得积分: +${pointsEarned}\n`;
            message += `搜索次数: ${searchesCount}次\n`;
            message += `当前积分: ${finalPoints}\n`;
            message += `${runInfo}\n`;
            message += `${intervalInfo}`;
            
            $.notify("Bing积分成功", `获得${pointsEarned}积分`, message);
        } else {
            message = `搜索完成: ${searchesCount}次\n`;
            message += `获得积分: +0\n`;
            message += `当前积分: ${finalPoints}\n`;
            message += `${runInfo}\n`;
            message += `${intervalInfo}\n`;
            if (failureInfo) message += `${failureInfo}\n`;
            message += `可能原因: 积分延迟更新或已达上限`;
            
            $.notify("Bing积分", "搜索完成", message);
        }
    }

    sendRestrictedNotification(accountStatus) {
        $.notify("🚫 Bing账户受限制", "已跳过搜索", 
            `当前积分: ${accountStatus.points}\n连续失败: ${this.consecutiveFailures}次`);
    }

    sendUnknownStatusNotification(accountStatus) {
        $.notify("⚠️ Bing状态未知", "保守策略", 
            `状态: ${accountStatus.message}\n连续失败: ${this.consecutiveFailures}次`);
    }

    sendSkipNotification(accountStatus, reason) {
        $.notify("⏭️ 跳过搜索", reason,
            `运行计数: ${this.config.run_count}/${this.config.point_check_interval}\n连续失败: ${this.consecutiveFailures}次`);
    }

    sendSkipSearchNotification(accountStatus) {
        $.notify("⏭️ 跳过搜索任务", "积分未增加保护",
            `连续${this.consecutiveFailures}次未获得积分\n当前积分: ${accountStatus.points}\n建议: 延长间隔或手动搜索`);
    }

    async comprehensiveAccountCheck() {
        if (!this.config.point_cookie) {
            return { status: this.STATUS.NO_COOKIE, message: "未设置积分Cookie", points: 0 };
        }

        try {
            const points = await this.getPointsWithValidation(this.config.point_cookie);
            if (points > 0) {
                // 检查是否有限制关键词
                const isRestricted = await this.checkAccountRestriction();
                return { 
                    status: isRestricted ? this.STATUS.RESTRICTED : this.STATUS.SAFE, 
                    message: isRestricted ? "账户受限制" : "账户状态正常", 
                    points: points 
                };
            } else {
                return { status: this.STATUS.UNKNOWN, message: "无法获取积分", points: 0 };
            }
        } catch (error) {
            return { status: this.STATUS.UNKNOWN, message: "检查失败", points: 0 };
        }
    }

    async checkAccountRestriction() {
        return new Promise((resolve) => {
            const url = "https://rewards.bing.com/";
            const headers = {
                "cookie": this.config.point_cookie,
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15"
            };

            $task.fetch({
                url: url,
                headers: headers,
                timeout: 10000
            }).then(response => {
                if (response.statusCode === 200 && response.body) {
                    const restrictionKeywords = ["限制", "restrict", "异常", "suspended"];
                    const hasRestriction = restrictionKeywords.some(keyword => 
                        response.body.toLowerCase().includes(keyword.toLowerCase())
                    );
                    resolve(hasRestriction);
                } else {
                    resolve(false);
                }
            }).catch(() => resolve(false));
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 执行安全管理
if (typeof $request !== 'undefined') {
    if ($request && /rewards\.bing\.com/.test($request.url)) {
        console.log("🍪 获取积分Cookie");
        let cookie = $request.headers?.Cookie || $request.headers?.cookie;
        if (cookie) {
            $prefs.setValueForKey(cookie, "bingPointCookieKey");
            console.log("✅ 积分Cookie保存成功");
        }
    }
    $done();
} else {
    const timeoutId = setTimeout(() => {
        console.log("⏰ 脚本执行超时");
        $done();
    }, 180000);

    const manager = new BingSafeManager();
    manager.startSafeManagement().finally(() => {
        clearTimeout(timeoutId);
        console.log("✅ 安全优化脚本执行完成");
        $done();
    });
}

function Env(name) {
    this.name = name;
    this.log = console.log;
    this.getdata = (key) => $prefs.valueForKey(key);
    this.setdata = (value, key) => $prefs.setValueForKey(value, key);
    this.notify = (title, subtitle, message) => {
        if ($notify) $notify(title, subtitle, message);
    };
    this.done = () => {
        if ($done) $done();
    };
}