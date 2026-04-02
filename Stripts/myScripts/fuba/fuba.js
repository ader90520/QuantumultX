// 福利吧签到脚本 for Quantumult X (BoxJS版本)
const cookieName = '福利吧签到'

// 配置获取函数
function getConfig() {
    let config = { 
        cookie: '', 
        username: '',
        domain: 'www.wnflb2023.com'
    };
    
    // 从BoxJS持久化存储获取配置（主要方式）
    config.cookie = $prefs.valueForKey('fuba_cookie') || '';
    config.username = $prefs.valueForKey('fuba_username') || '';
    config.domain = $prefs.valueForKey('fuba_domain') || 'www.wnflb2023.com';
    
    // 通过参数获取（覆盖，用于调试或临时传值）
    if (typeof $argument !== 'undefined' && $argument) {
        $argument.split('&').forEach((part) => {
            const [key, value] = part.split('=');
            if (key === 'cookie') config.cookie = decodeURIComponent(value);
            if (key === 'username') config.username = decodeURIComponent(value);
            if (key === 'domain') config.domain = decodeURIComponent(value);
        });
    }
    
    console.log(`配置获取: 用户名=${config.username ? '已设置' : '未设置'}, 域名=${config.domain}`);
    return config;
}

const { cookie: myCookie, username: myUsername, domain: flbDomain } = getConfig();

// 检查环境支持
if (!$task) {
    $notify(cookieName, "错误", "当前环境不支持，请在Quantumult X中运行");
    $done();
}

if (!myCookie || !myUsername) {
    const errorMsg = `请在BoxJS中配置福利吧签到参数\nCookie: ${myCookie ? '已设置' : '未设置'}\n用户名: ${myUsername ? '已设置' : '未设置'}`;
    $notify(cookieName, "配置错误", errorMsg);
    console.log(errorMsg);
    $done();
}

;(async () => {
    try {
        console.log('开始福利吧签到流程...');
        console.log(`使用域名: ${flbDomain}`);
        console.log(`用户名: ${myUsername}`);
        
        // 1. 访问PC主页验证Cookie并获取用户名
        console.log('正在验证Cookie和访问网站...');
        const userOptions = {
            url: `https://${flbDomain}/forum.php?mobile=no`,
            headers: {
                'Cookie': myCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            timeout: 20000
        };

        const userInfo = await request(userOptions);
        
        // 检查网站是否可访问
        if (!userInfo) {
            throw new Error('网站访问失败，请检查网络连接或域名状态');
        }
        
        // 检查是否被重定向到登录页
        if (userInfo.includes('登录') && userInfo.includes('password')) {
            throw new Error('Cookie已失效，请重新获取Cookie并在BoxJS中更新');
        }
        
        // 检查网站维护或其他错误页面
        if (userInfo.includes('维护') || userInfo.includes('错误') || userInfo.includes('404')) {
            throw new Error('网站暂时无法访问，请稍后重试');
        }
        
        const userNameMatch = userInfo.match(/title="访问我的空间">(.*?)<\/a>/);
        
        if (!userNameMatch) {
            throw new Error('Cookie可能已失效，无法获取用户名信息，请在BoxJS中检查Cookie配置');
        }

        const userName = userNameMatch[1].trim();
        console.log(`登录用户名为：${userName}`);
        console.log(`配置用户名为：${myUsername}`);

        if (userName !== myUsername) {
            throw new Error(`Cookie用户不匹配：期望"${myUsername}"，实际"${userName}"，请在BoxJS中检查用户名配置`);
        }

        // 2. 获取签到链接
        console.log('正在获取签到链接...');
        let signUrl = '';
        const signUrlMatch = userInfo.match(/}function fx_checkin(.*?);/);
        
        if (!signUrlMatch) {
            // 尝试其他可能的匹配模式
            const altSignUrlMatch = userInfo.match(/checkin.*?href.*?['"](.*?)['"]/);
            if (altSignUrlMatch) {
                signUrl = altSignUrlMatch[1];
                console.log(`通过备用模式获取签到链接: ${signUrl}`);
            } else {
                // 检查是否已经签到
                if (userInfo.includes('今日已签到') || userInfo.includes('已签到')) {
                    console.log('今日已签到过，直接获取积分信息');
                } else {
                    throw new Error('无法提取签到链接，请检查网页结构是否变化');
                }
            }
        } else {
            let rawSignUrl = signUrlMatch[1];
            // 修正：用正则提取真实URL，避免硬编码偏移
            const urlMatch = rawSignUrl.match(/https?:\/\/[^'"]+/);
            if (urlMatch) {
                signUrl = urlMatch[0];
            } else if (rawSignUrl.includes('plugin.php')) {
                signUrl = `https://${flbDomain}/${rawSignUrl}`;
            } else {
                signUrl = rawSignUrl;
            }
            console.log(`签到链接: ${signUrl}`);
        }

        // 3. 执行签到（如果有签到链接且尚未签到）
        if (signUrl && !userInfo.includes('今日已签到')) {
            console.log('正在执行签到...');
            const signOptions = {
                url: signUrl.startsWith('http') ? signUrl : `https://${flbDomain}/${signUrl}`,
                headers: {
                    'Cookie': myCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': `https://${flbDomain}/forum.php`
                },
                timeout: 15000
            };

            const signResult = await request(signOptions);
            
            // 检查签到结果
            if (signResult && (signResult.includes('今日已签到') || signResult.includes('已经签到') || signResult.includes('签到成功'))) {
                console.log('📝 签到完成');
            } else {
                console.log('✅ 签到请求已发送');
            }
        }

        // 4. 获取签到后的积分信息
        console.log('正在获取积分信息...');
        const finalUserInfo = await request(userOptions);
        
        if (!finalUserInfo) {
            throw new Error('获取积分信息时网络请求失败');
        }
        
        // 尝试多种匹配模式获取积分信息
        let currentMoney = '未知';
        let singDay = '今日签到完成';
        
        // 模式1: extcreditmenu（主要模式）
        const currentMoneyMatch = finalUserInfo.match(/<a.*?id="extcreditmenu".*?>(.*?)<\/a>/);
        // 模式2: 积分显示
        const moneyMatch2 = finalUserInfo.match(/积分.*?(\d+)/);
        // 模式3: 金钱/金币显示
        const moneyMatch3 = finalUserInfo.match(/(金钱|金币|金币).*?(\d+)/);
        
        if (currentMoneyMatch) {
            currentMoney = currentMoneyMatch[1].trim();
            console.log(`通过extcreditmenu获取积分: ${currentMoney}`);
        } else if (moneyMatch3) {
            currentMoney = moneyMatch3[2];
            console.log(`通过金钱匹配获取积分: ${currentMoney}`);
        } else if (moneyMatch2) {
            currentMoney = moneyMatch2[1];
            console.log(`通过积分匹配获取积分: ${currentMoney}`);
        } else {
            // 最后尝试搜索数字格式的积分
            const fallbackMoneyMatch = finalUserInfo.match(/(\d+\.?\d*)\s*(金币|金钱|积分)/);
            if (fallbackMoneyMatch) {
                currentMoney = fallbackMoneyMatch[1];
                console.log(`通过备用匹配获取积分: ${currentMoney}`);
            }
        }
        
        // 查找签到信息
        const singDayMatch = finalUserInfo.match(/<div class="tip_c">(.*?)<\/div>/);
        if (singDayMatch) {
            singDay = singDayMatch[1].trim();
        } else {
            // 尝试其他可能的签到信息位置
            const altSingDayMatch = finalUserInfo.match(/签到.*?(已签到|\d+天)/);
            if (altSingDayMatch) {
                singDay = altSingDayMatch[0];
            }
        }
        
        const logInfo = `用户: ${userName} | ${singDay} | 积分: ${currentMoney}`;
        
        $notify(cookieName, `签到成功`, logInfo);
        console.log('✅ ' + logInfo);

    } catch (error) {
        const errorMsg = error.message || error;
        $notify(cookieName, '签到失败', errorMsg);
        console.error(`❌ 签到失败: ${errorMsg}`);
        
        // 提供具体的解决建议
        if (errorMsg.includes('网站访问失败') || errorMsg.includes('域名状态')) {
            console.log('💡 建议: 请在BoxJS中检查域名配置或尝试其他域名');
        } else if (errorMsg.includes('Cookie') || errorMsg.includes('用户名')) {
            console.log('💡 建议: 请在BoxJS中检查Cookie和用户名配置');
        }
    } finally {
        $done();
    }
})();

// 通用请求函数
function request(options, throwError = true) {
    return new Promise((resolve, reject) => {
        $task.fetch(options).then(response => {
            if (response.statusCode === 200) {
                resolve(response.body);
            } else if (throwError) {
                reject(`HTTP错误: ${response.statusCode} - ${response.statusText}`);
            } else {
                resolve(response.body); // 非200也返回body，由调用方决定是否处理
            }
        }, reason => {
            if (throwError) {
                reject(reason.error || reason);
            } else {
                resolve(null); // 不抛出错误时返回null
            }
        });
    });
}