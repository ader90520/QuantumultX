/*
福利吧签到 for Quantumult X
功能：自动签到、记录连续天数、获取积分
作者：@ader90520 (优化版)
支持：BoxJs 配置、多域名自动切换、详细日志
*/

const $ = new Env("福利吧签到");

// 配置项（从 BoxJs 读取）
let config = {
    domain: $prefs.valueForKey("fuba_domain") || "www.wnflb2023.com",
    cookie: $prefs.valueForKey("fuba_cookie") || "",
    username: $prefs.valueForKey("fuba_username") || "",
    debug: $prefs.valueForKey("@fuba.debug_mode") === "true",
};

// 备选域名列表（当主域名失效时自动切换）
const backupDomains = [
    "www.wnflb2023.com",
    "www.wnflb00.com",
    "www.wnflb99.com",
    "www.wnflb77.com"
];

// 签到结果存储
let signResult = {
    success: false,
    message: "",
    points: "未知",
    continuousDays: 0,
    totalDays: 0,
    lastSignDate: ""
};

// 主函数
!(async () => {
    try {
        $.log("🚀 福利吧签到脚本启动");
        if (!config.cookie) throw new Error("未配置 Cookie，请先登录福利吧并获取 Cookie");
        if (!config.username) $.log("⚠️ 未配置用户名，将尝试自动获取");

        // 1. 尝试签到（支持自动切换域名）
        await trySignWithDomains();

        // 2. 更新本地存储的签到统计
        if (signResult.success) {
            updateLocalStats();
        }

        // 3. 发送通知
        sendNotification();

    } catch (error) {
        $.log(`❌ 签到失败: ${error.message}`);
        $.notify("福利吧签到", "失败", error.message);
    } finally {
        $.done();
    }
})();

// 尝试多个域名签到
async function trySignWithDomains() {
    let domainsToTry = [config.domain, ...backupDomains.filter(d => d !== config.domain)];
    let lastError = null;

    for (let domain of domainsToTry) {
        $.log(`🌐 尝试域名: ${domain}`);
        try {
            const result = await performSign(domain);
            if (result.success) {
                signResult = result;
                // 如果当前配置的域名不是有效的，自动更新到有效的域名
                if (config.domain !== domain) {
                    $.log(`✅ 域名 ${domain} 有效，更新配置`);
                    $prefs.setValueForKey(domain, "fuba_domain");
                    config.domain = domain;
                }
                return;
            }
        } catch (e) {
            lastError = e;
            $.log(`❌ 域名 ${domain} 签到失败: ${e.message}`);
            continue;
        }
    }
    throw lastError || new Error("所有域名均签到失败");
}

// 执行签到流程（指定域名）
async function performSign(domain) {
    const baseUrl = `https://${domain}`;
    let cookieValid = false;
    let userName = "";

    // 1. 访问首页验证 Cookie
    $.log("🔍 验证 Cookie 有效性...");
    const homeHtml = await request({
        url: `${baseUrl}/forum.php?mobile=no`,
        headers: buildHeaders(config.cookie, "pc"),
        timeout: 20000
    });

    // 检查是否被重定向到登录页
    if (homeHtml.includes("登录") && (homeHtml.includes("password") || homeHtml.includes("member.php?mod=logging"))) {
        throw new Error("Cookie 已失效，请重新获取");
    }

    // 提取用户名
    const nameMatch = homeHtml.match(/title="访问我的空间">(.*?)<\/a>/);
    if (nameMatch) {
        userName = nameMatch[1].trim();
        $.log(`👤 当前登录用户: ${userName}`);
        if (config.username && config.username !== userName) {
            $.log(`⚠️ 配置的用户名 ${config.username} 与当前登录用户 ${userName} 不匹配，将使用实际用户`);
            // 可选：自动更新用户名
            $prefs.setValueForKey(userName, "fuba_username");
            config.username = userName;
        }
        cookieValid = true;
    } else {
        // 可能页面结构变化，但不一定是 Cookie 无效
        $.log("⚠️ 未找到用户名，但 Cookie 可能仍有效");
    }

    if (!cookieValid) throw new Error("Cookie 验证失败");

    // 2. 检查今日是否已签到
    if (homeHtml.includes("今日已签到") || homeHtml.includes("已经签到")) {
        $.log("📅 今日已签到过，跳过签到动作");
        signResult.success = true;
        signResult.message = "今日已签到";
        // 仍然尝试获取最新积分信息
        await updatePointsInfo(domain, config.cookie);
        return signResult;
    }

    // 3. 提取签到链接
    let signUrl = extractSignUrl(homeHtml, domain);
    if (!signUrl) {
        // 可能是新版本或结构变化，尝试另一种模式
        const altMatch = homeHtml.match(/checkin.*?href\s*=\s*['"](.*?)['"]/);
        if (altMatch) signUrl = altMatch[1];
        else throw new Error("无法提取签到链接，网站结构可能已更新");
    }

    // 4. 执行签到请求
    $.log(`🔗 签到链接: ${signUrl}`);
    const signHtml = await request({
        url: signUrl.startsWith("http") ? signUrl : `${baseUrl}/${signUrl}`,
        headers: buildHeaders(config.cookie, "pc", `${baseUrl}/forum.php`),
        timeout: 15000
    });

    // 5. 判断签到结果
    if (signHtml.includes("今日已签到") || signHtml.includes("签到成功") || signHtml.includes("奖励")) {
        $.log("✅ 签到成功");
        signResult.success = true;
        signResult.message = "签到成功";
    } else {
        $.log("⚠️ 签到结果未知，可能已成功或重复");
        signResult.success = true; // 假定成功
        signResult.message = "签到请求已发送";
    }

    // 6. 获取签到后的积分和统计信息
    await updatePointsInfo(domain, config.cookie);

    return signResult;
}

// 提取签到链接（兼容多种格式）
function extractSignUrl(html, domain) {
    // 匹配 fx_checkin 函数中的链接
    let match = html.match(/function fx_checkin\(.*?\)\s*\{[^}]*?window\.location\.href\s*=\s*['"](.*?)['"]/);
    if (match) return match[1];

    // 匹配链接形式的签到
    match = html.match(/checkin.*?href\s*=\s*['"](.*?plugin\.php\?id=.*?checkin.*?)['"]/);
    if (match) return match[1];

    // 匹配 a 标签中的签到链接
    match = html.match(/<a[^>]*?href\s*=\s*['"](.*?(?:checkin|sign).*?)['"][^>]*?>.*?签到.*?<\/a>/i);
    if (match) return match[1];

    return null;
}

// 获取积分和签到统计信息
async function updatePointsInfo(domain, cookie) {
    const baseUrl = `https://${domain}`;
    const homeHtml = await request({
        url: `${baseUrl}/forum.php?mobile=no`,
        headers: buildHeaders(cookie, "pc"),
        timeout: 20000
    });

    // 获取积分（尝试多种匹配）
    let points = "未知";
    // 模式1：extcreditmenu
    let pointsMatch = homeHtml.match(/<a.*?id="extcreditmenu".*?>(.*?)<\/a>/);
    if (pointsMatch) points = pointsMatch[1].trim();
    else {
        // 模式2：积分数字
        pointsMatch = homeHtml.match(/(?:积分|金币|金钱)[^\d]*(\d+)/);
        if (pointsMatch) points = pointsMatch[1];
    }
    signResult.points = points;

    // 获取连续签到天数（如果有）
    const continuousMatch = homeHtml.match(/连续签到[：:]\s*(\d+)\s*天/);
    if (continuousMatch) signResult.continuousDays = parseInt(continuousMatch[1]);

    const totalMatch = homeHtml.match(/累计签到[：:]\s*(\d+)\s*天/);
    if (totalMatch) signResult.totalDays = parseInt(totalMatch[1]);

    const lastDateMatch = homeHtml.match(/上次签到[：:]\s*(\d{4}-\d{2}-\d{2})/);
    if (lastDateMatch) signResult.lastSignDate = lastDateMatch[1];

    $.log(`📊 当前积分: ${points}, 连续: ${signResult.continuousDays}天, 总计: ${signResult.totalDays}天`);
}

// 更新本地存储的统计数据
function updateLocalStats() {
    const today = new Date().toDateString();
    $prefs.setValueForKey(today, "fuba_last_sign_date");
    if (signResult.continuousDays > 0) $prefs.setValueForKey(String(signResult.continuousDays), "fuba_continuous_days");
    if (signResult.totalDays > 0) $prefs.setValueForKey(String(signResult.totalDays), "fuba_total_days");
    if (signResult.points !== "未知") $prefs.setValueForKey(signResult.points, "fuba_points");
}

// 发送通知
function sendNotification() {
    let subtitle = signResult.success ? "✅ 签到成功" : "❌ 签到失败";
    let message = `用户: ${config.username || "未知"}\n积分: ${signResult.points}\n`;
    if (signResult.continuousDays) message += `连续签到: ${signResult.continuousDays}天\n`;
    if (signResult.totalDays) message += `累计签到: ${signResult.totalDays}天\n`;
    message += signResult.message;
    $.notify("福利吧签到", subtitle, message);
}

// 构建请求头
function buildHeaders(cookie, device = "pc", referer = null) {
    const ua = device === "pc"
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        : "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1";
    const headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cookie": cookie,
        "Connection": "keep-alive"
    };
    if (referer) headers["Referer"] = referer;
    return headers;
}

// 网络请求封装
function request(options) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("请求超时")), options.timeout || 20000);
        $task.fetch(options).then(resp => {
            clearTimeout(timeout);
            if (resp.statusCode === 200) resolve(resp.body);
            else reject(new Error(`HTTP ${resp.statusCode}`));
        }).catch(err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Env 类（模拟 Quantumult X 环境）
function Env(name) {
    this.name = name;
    this.log = console.log;
    this.getdata = (key) => $prefs.valueForKey(key);
    this.setdata = (value, key) => $prefs.setValueForKey(value, key);
    this.notify = (title, subtitle, message) => {
        if ($notify) $notify(title, subtitle, message);
        else console.log(`${title} - ${subtitle}: ${message}`);
    };
    this.done = () => { if ($done) $done(); };
}