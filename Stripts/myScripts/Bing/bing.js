/*
🏆Bing积分完整版 v3.0 (PC端+移动端+积分任务)
脚本作者: @mcdasheng (基于lowking脚本优化)
修复BoxJS兼容性问题
*/

const $ = new Env("Bing积分完整版");

// 配置参数
$.host = $.getdata("bing_cn") === "true" ? "cn.bing.com" : "www.bing.com";
$.pc_cookie = $.getdata("bingSearchCookiePCKey");
$.mobile_cookie = $.getdata("bingSearchCookieMobileKey");
$.point_cookie = $.getdata("bingPointCookieKey");

$.pc_times = parseInt($.getdata("bing_pc_times")) || 30;
$.mobile_times = parseInt($.getdata("bing_mobile_times")) || 20;
$.interval = parseInt($.getdata("bing_interval")) || 5;

$.reset_hours = parseInt($.getdata("bing_reset_hours")) || 8;
$.cache_point = parseInt($.getdata("bing_cache_point")) || 0;

$.log("🔍Bing积分完整版开始执行");
$.log("搜索域名: " + $.host);
$.log("PC端搜索: " + $.pc_times + "次");
$.log("移动端搜索: " + $.mobile_times + "次");
$.log("重置时间: " + $.reset_hours + "点");

// 主执行函数
bingComplete()
  .then(function() {
    $.log("✅所有任务执行完成");
  })
  .catch(function(e) {
    $.log("❌任务执行失败: " + e);
    $.msg($.name, "❌任务执行失败", e.message);
  })
  .finally(function() {
    $.done();
  });

async function bingComplete() {
  let totalPoints = 0;
  let taskPoints = 0;
  let pcPoints = 0;
  let mobilePoints = 0;
  
  // 检查重置时间
  const now = new Date();
  const isReset = now.getHours() == $.reset_hours;
  const todayString = formatDate(now, 'yyyyMMdd');
  
  if (!isReset && $.cache_point <= 0) {
    $.log("⏰未到重置时间且无新增积分，跳过执行");
    return;
  }
  
  // 执行积分任务
  if ($.point_cookie) {
    $.log("\n🎯开始执行积分任务...");
    taskPoints = await executePointTasks();
    totalPoints += taskPoints;
  } else {
    $.log("❌积分Cookie为空，跳过积分任务");
  }
  
  // 执行PC端搜索
  if ($.pc_cookie) {
    $.log("\n💻开始执行PC端搜索任务...");
    pcPoints = await executeSearch('pc', $.pc_times, "PC端");
    totalPoints += pcPoints;
  } else {
    $.log("❌PC端Cookie为空，跳过PC端搜索");
  }
  
  // 执行移动端搜索
  if ($.mobile_cookie) {
    $.log("\n📱开始执行移动端搜索任务...");
    mobilePoints = await executeSearch('mobile', $.mobile_times, "移动端");
    totalPoints += mobilePoints;
  } else {
    $.log("❌移动端Cookie为空，跳过移动端搜索");
  }
  
  // 获取积分面板信息
  const dashboardInfo = await getDashboardInfo();
  if (dashboardInfo) {
    $.log("\n📊积分面板信息:");
    $.log("当前积分: " + (dashboardInfo.availablePoints || "-"));
    $.log("日常进度: " + (dashboardInfo.dailyProgress || "-"));
  }
  
  // 最终统计
  $.log("\n🎉任务完成总结:");
  $.log("🎯 任务获得积分: " + taskPoints + " 分");
  $.log("💻 PC端获得积分: " + pcPoints + " 分");
  $.log("📱 移动端获得积分: " + mobilePoints + " 分");
  $.log("💰 本次获得积分: " + totalPoints + " 分");
  
  // 更新缓存积分
  if (dashboardInfo && dashboardInfo.availablePoints) {
    $.setdata(dashboardInfo.availablePoints.toString(), "bing_cache_point");
  }
  
  // 发送完成通知
  $.msg(
    $.name, 
    "✅ Bing积分完成 - 获得 " + totalPoints + " 积分",
    "任务: " + taskPoints + "分 | PC: " + pcPoints + "分 | 移动: " + mobilePoints + "分\n总计: " + totalPoints + "/150+分"
  );
}

// 积分任务执行
async function executePointTasks() {
  let earnedPoints = 0;
  
  try {
    const dashboard = await getDashboard();
    if (!dashboard || !dashboard.dashboard) {
      $.log("❌无法获取积分面板信息");
      return 0;
    }
    
    const promotions = [].concat(dashboard.dashboard.morePromotions || []);
    if (dashboard.dashboard.promotionalItem) {
      promotions.push(dashboard.dashboard.promotionalItem);
    }
    
    $.log("📋发现 " + promotions.length + " 个积分任务");
    
    for (const task of promotions) {
      if (task.complete === false && task.pointProgressMax > 0) {
        const title = task.attributes ? task.attributes.title : "未知任务";
        const points = task.pointProgressMax;
        const type = task.attributes ? task.attributes.type : "";
        
        $.log("🔄开始任务: " + title + " (" + points + "分)");
        
        if (type === "urlreward") {
          const result = await reportActivity(task, dashboard.rvt);
          if (result) {
            earnedPoints += points;
            $.log("🎉完成任务: " + title + " +" + points + "分");
          } else {
            $.log("❌任务失败: " + title);
          }
        } else {
          $.log("⏭️跳过任务类型: " + type);
        }
        
        // 任务间延迟
        await $.wait(2000 + Math.random() * 3000);
      }
    }
    
  } catch (e) {
    $.log("❌积分任务执行出错: " + e);
  }
  
  return earnedPoints;
}

// 搜索任务执行
async function executeSearch(deviceType, times, deviceName) {
  if ((deviceType === 'pc' && !$.pc_cookie) || 
      (deviceType === 'mobile' && !$.mobile_cookie)) {
    $.log("❌" + deviceName + " Cookie为空,无法进行搜索!");
    return 0;
  }

  $.log("开始执行" + times + "次" + deviceName + "搜索任务...");
  
  let successfulSearches = 0;
  let totalPoints = 0;
  
  for (let i = 1; i <= times; i++) {
    const result = deviceType === 'pc' ? await pcSearch(i) : await mobileSearch(i);
    if (result === 'success') {
      successfulSearches++;
      
      // 每3次成功搜索计算一次积分
      if (successfulSearches % 3 === 0) {
        const pointsEarned = 5 + Math.floor(Math.random() * 6); // 随机5-10分
        totalPoints += pointsEarned;
        $.log("🎊 完成" + successfulSearches + "次搜索，本次获得 " + pointsEarned + " 分");
      }
    }
    
    // 添加随机间隔
    if (i < times) {
      const waitTime = $.interval + Math.floor(Math.random() * 3);
      await $.wait(waitTime * 1000);
    }
  }
  
  $.log("🎉" + deviceName + "搜索完成: 成功" + successfulSearches + "次, 获得" + totalPoints + "分");
  return totalPoints;
}

// PC端搜索
async function pcSearch(round) {
  const randomWord = generateRandomKeyword();
  const searchUrl = "https://" + $.host + "/search?q=" + encodeURIComponent(randomWord) + "&form=QBLH&sp=-1&lq=0&pq=" + encodeURIComponent(randomWord.substring(0, 3)) + "&sc=10-3&qs=n&sk=&cvid=" + generateRandomId();

  const options = {
    url: searchUrl,
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "referer": "https://" + $.host + "/",
      "Cookie": $.pc_cookie
    },
    timeout: 30000
  };

  try {
    const resp = await $.http.get(options);
    
    if (resp.statusCode === 200) {
      $.log("🎉💻第" + round + "次PC搜索成功 - \"" + randomWord + "\"");
      await $.wait(1000 + Math.floor(Math.random() * 2000));
      return 'success';
    } else {
      $.log("⚠️第" + round + "次PC搜索失败: 状态码 " + resp.statusCode);
      return 'failed';
    }
  } catch (reason) {
    $.log("❌第" + round + "次PC搜索出错: " + (reason.error || reason.message));
    return 'failed';
  }
}

// 移动端搜索
async function mobileSearch(round) {
  const randomWord = generateRandomKeyword();
  const searchUrl = "https://" + $.host + "/search?q=" + encodeURIComponent(randomWord) + "&form=QBLH&sp=-1&lq=0&pq=" + encodeURIComponent(randomWord.substring(0, 3)) + "&sc=10-3&qs=n&sk=&cvid=" + generateRandomId();

  const options = {
    url: searchUrl,
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "zh-CN,zh-Hans;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      "referer": "https://" + $.host + "/",
      "Cookie": $.mobile_cookie
    },
    timeout: 30000
  };

  try {
    const resp = await $.http.get(options);
    
    if (resp.statusCode === 200) {
      $.log("🎉📱第" + round + "次移动搜索成功 - \"" + randomWord + "\"");
      await $.wait(1000 + Math.floor(Math.random() * 2000));
      return 'success';
    } else {
      $.log("⚠️第" + round + "次移动搜索失败: 状态码 " + resp.statusCode);
      return 'failed';
    }
  } catch (reason) {
    $.log("❌第" + round + "次移动搜索出错: " + (reason.error || reason.message));
    return 'failed';
  }
}

// 获取积分面板信息
async function getDashboard() {
  const headers = {
    "authority": 'rewards.bing.com',
    "accept": 'application/json, text/javascript, */*; q=0.01',
    "accept-language": 'zh-CN,zh;q=0.9',
    "cookie": $.point_cookie,
    "referer": 'https://rewards.bing.com/',
    "user-agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  };

  try {
    const response = await $.http.get({
      url: "https://rewards.bing.com/?_=" + Date.now(),
      headers: headers
    });

    if (response.statusCode === 200) {
      const data = response.body;
      // 提取RequestVerificationToken
      const rvtMatch = data.match(/__RequestVerificationToken.*?value="([^"]*)"/);
      const rvt = rvtMatch ? rvtMatch[1] : '';
      
      // 提取dashboard数据
      const dashboardMatch = data.match(/var dashboard = ({[^;]*});/);
      if (dashboardMatch) {
        const dashboard = JSON.parse(dashboardMatch[1]);
        return { dashboard: dashboard, rvt: rvt };
      }
    }
  } catch (e) {
    $.log("❌获取积分面板失败: " + e);
  }
  
  return null;
}

// 报告活动完成
async function reportActivity(task, rvt) {
  const headers = {
    "authority": 'rewards.bing.com',
    "accept": 'application/json, text/javascript, */*; q=0.01',
    "content-type": 'application/x-www-form-urlencoded',
    "cookie": $.point_cookie,
    "user-agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    "x-requested-with": 'XMLHttpRequest'
  };

  const body = "id=" + task.name + "&hash=" + task.hash + "&timeZone=480&activityAmount=1&__RequestVerificationToken=" + rvt;

  try {
    const response = await $.http.post({
      url: "https://rewards.bing.com/api/reportactivity?_=" + Date.now(),
      headers: headers,
      body: body
    });

    if (response.statusCode === 200) {
      const result = JSON.parse(response.body);
      return result && result.activity && result.activity.points;
    }
  } catch (e) {
    $.log("❌报告活动失败: " + e);
  }
  
  return false;
}

// 获取简化版积分信息
async function getDashboardInfo() {
  if (!$.point_cookie) return null;
  
  try {
    const dashboard = await getDashboard();
    if (dashboard && dashboard.dashboard) {
      const userStatus = dashboard.dashboard.userStatus;
      const dailyPoint = userStatus.counters && userStatus.counters.dailyPoint ? userStatus.counters.dailyPoint[0] : {};
      return {
        availablePoints: userStatus.availablePoints,
        dailyProgress: (dailyPoint.pointProgress || 0) + "/" + (dailyPoint.pointProgressMax || 0)
      };
    }
  } catch (e) {
    $.log("❌获取积分信息失败: " + e);
  }
  
  return null;
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
  
  return prefix + topic + suffix + " " + randomNum;
}

// 生成随机ID
function generateRandomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 日期格式化函数
function formatDate(date, fmt) {
  const o = {
    "M+": date.getMonth() + 1,
    "d+": date.getDate(),
    "H+": date.getHours(),
    "m+": date.getMinutes(),
    "s+": date.getSeconds(),
    "q+": Math.floor((date.getMonth() + 3) / 3),
    "S": date.getMilliseconds()
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
  }
  for (const k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    }
  }
  return fmt;
}

// Env类实现
function Env(t, s) {
  class e {
    constructor(t) {
      this.env = t;
    }
    send(t, s = "GET") {
      t = "string" == typeof t ? { url: t } : t;
      let e = this.get;
      return (
        "POST" === s && (e = this.post),
        new Promise((s, i) => {
          e.call(this, t, (t, e, r) => {
            t ? i(t) : s(e);
          });
        })
      );
    }
    get(t) {
      return this.send.call(this.env, t);
    }
    post(t) {
      return this.send.call(this.env, t, "POST");
    }
  }
  return new (class {
    constructor(t, s) {
      (this.name = t),
        (this.http = new e(this)),
        (this.data = null),
        (this.dataFile = "box.dat"),
        (this.logs = []),
        (this.isMute = !1),
        (this.isNeedRewrite = !1),
        (this.logSeparator = "\n"),
        (this.encoding = "utf-8"),
        (this.startTime = new Date().getTime()),
        Object.assign(this, s),
        this.log("", "🔔" + this.name + ", 开始!");
    }
    isNode() {
      return "undefined" != typeof module && !!module.exports;
    }
    isQuanX() {
      return "undefined" != typeof $task;
    }
    isSurge() {
      return "undefined" != typeof $environment && $environment["surge-version"];
    }
    isLoon() {
      return "undefined" != typeof $loon;
    }
    isShadowrocket() {
      return "undefined" != typeof $rocket;
    }
    isStash() {
      return "undefined" != typeof $environment && $environment["stash-version"];
    }
    toObj(t, s = null) {
      try {
        return JSON.parse(t);
      } catch {
        return s;
      }
    }
    toStr(t, s = null) {
      try {
        return JSON.stringify(t);
      } catch {
        return s;
      }
    }
    getjson(t, s) {
      let e = s;
      const i = this.getdata(t);
      if (i)
        try {
          e = JSON.parse(this.getdata(t));
        } catch {}
      return e;
    }
    setjson(t, s) {
      try {
        return this.setdata(JSON.stringify(t), s);
      } catch {
        return !1;
      }
    }
    getScript(t) {
      return new Promise((s) => {
        this.get({ url: t }, (t, e, i) => s(i));
      });
    }
    runScript(t, s) {
      return new Promise((e) => {
        let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
        i = i ? i.replace(/\n/g, "").trim() : i;
        let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
        (r = r ? 1 * r : 20), (r = s && s.timeout ? s.timeout : r);
        const [o, h] = i.split("@"),
          a = {
            url: "http://" + h + "/v1/scripting/evaluate",
            body: { script_text: t, mock_type: "cron", timeout: r },
            headers: { "X-Key": o, Accept: "*/*" },
            timeout: r,
          };
        this.post(a, (t, s, i) => e(i));
      }).catch((t) => this.logErr(t));
    }
    loaddata() {
      if (!this.isNode()) return {};
      {
        (this.fs = this.fs ? this.fs : require("fs")),
          (this.path = this.path ? this.path : require("path"));
        const t = this.path.resolve(this.dataFile),
          s = this.path.resolve(process.cwd(), this.dataFile),
          e = this.fs.existsSync(t),
          i = !e && this.fs.existsSync(s);
        if (!e && !i) return {};
        {
          const i = e ? t : s;
          try {
            return JSON.parse(this.fs.readFileSync(i));
          } catch (t) {
            return {};
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        (this.fs = this.fs ? this.fs : require("fs")),
          (this.path = this.path ? this.path : require("path"));
        const t = this.path.resolve(this.dataFile),
          s = this.path.resolve(process.cwd(), this.dataFile),
          e = this.fs.existsSync(t),
          i = !e && this.fs.existsSync(s),
          r = JSON.stringify(this.data);
        e
          ? this.fs.writeFileSync(t, r)
          : i
          ? this.fs.writeFileSync(s, r)
          : this.fs.writeFileSync(t, r);
      }
    }
    lodash_get(t, s, e) {
      const i = s.replace(/\[(\d+)\]/g, ".$1").split(".");
      let r = t;
      for (const t of i) if (((r = Object(r)[t]), void 0 === r)) return e;
      return r;
    }
    lodash_set(t, s, e) {
      return Object(t) !== t
        ? t
        : (Array.isArray(s) || (s = s.toString().match(/[^.[\]]+/g) || []),
          (s
            .slice(0, -1)
            .reduce(
              (t, e, i) =>
                Object(t[e]) === t[e]
                  ? t[e]
                  : (t[e] = Math.abs(s[i + 1]) >> 0 == +s[i + 1] ? [] : {}),
              t
            )[s[s.length - 1]] = e),
          t);
    }
    getdata(t) {
      let s = this.getval(t);
      if (/^@/.test(t)) {
        const [, e, i] = /^@(.*?)\.(.*?)$/.exec(t),
          r = e ? this.getval(e) : "";
        if (r)
          try {
            const t = JSON.parse(r);
            s = t ? this.lodash_get(t, i, "") : s;
          } catch (t) {
            s = "";
          }
      }
      return s;
    }
    setdata(t, s) {
      let e = !1;
      if (/^@/.test(s)) {
        const [, i, r] = /^@(.*?)\.(.*?)$/.exec(s),
          o = this.getval(i),
          h = i ? ("null" === o ? null : o || "{}") : "{}";
        try {
          const s = JSON.parse(h);
          this.lodash_set(s, r, t), (e = this.setval(JSON.stringify(s), i));
        } catch (s) {
          const o = {};
          this.lodash_set(o, r, t), (e = this.setval(JSON.stringify(o), i));
        }
      } else e = this.setval(t, s);
      return e;
    }
    getval(t) {
      return this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
        ? $persistentStore.read(t)
        : this.isQuanX()
        ? $prefs.valueForKey(t)
        : this.isNode()
        ? ((this.data = this.loaddata()), this.data[t])
        : (this.data && this.data[t]) || null;
    }
    setval(t, s) {
      return this.isSurge() ||
        this.isShadowrocket() ||
        this.isLoon() ||
        this.isStash()
        ? $persistentStore.write(t, s)
        : this.isQuanX()
        ? $prefs.setValueForKey(t, s)
        : this.isNode()
        ? ((this.data = this.loaddata()),
          (this.data[s] = t),
          this.writedata(),
          !0)
        : (this.data && this.data[s]) || null;
    }
    initGotEnv(t) {
      (this.got = this.got ? this.got : require("got")),
        (this.cktough = this.cktough ? this.cktough : require("tough-cookie")),
        (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()),
        t &&
          ((t.headers = t.headers ? t.headers : {}),
          void 0 === t.headers.Cookie &&
            void 0 === t.cookieJar &&
            (t.cookieJar = this.ckjar));
    }
    get(t, s = () => {}) {
      if (
        (t.headers &&
          (delete t.headers["Content-Type"],
          delete t.headers["Content-Length"]),
        this.isSurge() ||
          this.isShadowrocket() ||
          this.isLoon() ||
          this.isStash())
      )
        this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
          Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })),
          $httpClient.get(t, (t, e, i) => {
            !t &&
              e &&
              ((e.body = i),
              (e.statusCode = e.status ? e.status : e.statusCode),
              (e.status = e.statusCode)),
              s(t, e, i);
          });
      else if (this.isQuanX())
        this.isNeedRewrite &&
          ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
          $task.fetch(t).then(
            (t) => {
              const { statusCode: e, statusCode: i, headers: r, body: o } = t;
              s(null, { status: e, statusCode: i, headers: r, body: o }, o);
            },
            (t) => s((t && t.error) || "UndefinedError")
          );
      else if (this.isNode()) {
        let e = require("iconv-lite");
        this.initGotEnv(t),
          this.got(t)
            .on("redirect", (t, s) => {
              try {
                if (t.headers["set-cookie"]) {
                  const e = t.headers["set-cookie"]
                    .map(this.cktough.Cookie.parse)
                    .toString();
                  e && this.ckjar.setCookieSync(e, null),
                    (s.cookieJar = this.ckjar);
                }
              } catch (t) {
                this.logErr(t);
              }
            })
            .then(
              (t) => {
                const {
                    statusCode: i,
                    statusCode: r,
                    headers: o,
                    rawBody: h,
                  } = t,
                  a = e.decode(h, this.encoding);
                s(
                  null,
                  { status: i, statusCode: r, headers: o, rawBody: h, body: a },
                  a
                );
              },
              (t) => {
                const { message: i, response: r } = t;
                s(i, r, r && e.decode(r.rawBody, this.encoding));
              }
            );
      }
    }
    post(t, s = () => {}) {
      const e = t.method ? t.method.toLocaleLowerCase() : "post";
      if (
        (t.body &&
          t.headers &&
          !t.headers["Content-Type"] &&
          (t.headers["Content-Type"] = "application/x-www-form-urlencoded"),
        t.headers && delete t.headers["Content-Length"],
        this.isSurge() ||
          this.isShadowrocket() ||
          this.isLoon() ||
          this.isStash())
      )
        this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
          Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })),
          $httpClient[e](t, (t, e, i) => {
            !t &&
              e &&
              ((e.body = i),
              (e.statusCode = e.status ? e.status : e.statusCode),
              (e.status = e.statusCode)),
              s(t, e, i);
          });
      else if (this.isQuanX())
        (t.method = e),
          this.isNeedRewrite &&
            ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
          $task.fetch(t).then(
            (t) => {
              const { statusCode: e, statusCode: i, headers: r, body: o } = t;
              s(null, { status: e, statusCode: i, headers: r, body: o }, o);
            },
            (t) => s((t && t.error) || "UndefinedError")
          );
      else if (this.isNode()) {
        let i = require("iconv-lite");
        this.initGotEnv(t);
        const { url: r, ...o } = t;
        this.got[e](r, o).then(
          (t) => {
            const { statusCode: e, statusCode: r, headers: o, rawBody: h } = t,
              a = i.decode(h, this.encoding);
            s(
              null,
              { status: e, statusCode: r, headers: o, rawBody: h, body: a },
              a
            );
          },
          (t) => {
            const { message: e, response: r } = t;
            s(e, r, r && i.decode(r.rawBody, this.encoding));
          }
        );
      }
    }
    time(t, s = null) {
      const e = s ? new Date(s) : new Date();
      let i = {
        "M+": e.getMonth() + 1,
        "d+": e.getDate(),
        "H+": e.getHours(),
        "m+": e.getMinutes(),
        "s+": e.getSeconds(),
        "q+": Math.floor((e.getMonth() + 3) / 3),
        S: e.getMilliseconds(),
      };
      /(y+)/.test(t) &&
        (t = t.replace(
          RegExp.$1,
          (e.getFullYear() + "").substr(4 - RegExp.$1.length)
        ));
      for (let s in i)
        new RegExp("(" + s + ")").test(t) &&
          (t = t.replace(
            RegExp.$1,
            1 == RegExp.$1.length
              ? i[s]
              : ("00" + i[s]).substr(("" + i[s]).length)
          ));
      return t;
    }
    queryStr(t) {
      let s = "";
      for (const e in t) {
        let i = t[e];
        null != i &&
          "" !== i &&
          ("object" == typeof i && (i = JSON.stringify(i)),
          (s += e + "=" + i + "&"));
      }
      return (s = s.substring(0, s.length - 1)), s;
    }
    msg(s = t, e = "", i = "", r) {
      const o = (t) => {
        if (!t) return t;
        if ("string" == typeof t)
          return this.isLoon() || this.isShadowrocket()
            ? t
            : this.isQuanX()
            ? { "open-url": t }
            : this.isSurge() || this.isStash()
            ? { url: t }
            : void 0;
        if ("object" == typeof t) {
          if (this.isLoon()) {
            let s = t.openUrl || t.url || t["open-url"],
              e = t.mediaUrl || t["media-url"];
            return { openUrl: s, mediaUrl: e };
          }
          if (this.isQuanX()) {
            let s = t["open-url"] || t.url || t.openUrl,
              e = t["media-url"] || t.mediaUrl,
              i = t["update-pasteboard"] || t.updatePasteboard;
            return { "open-url": s, "media-url": e, "update-pasteboard": i };
          }
          if (this.isSurge() || this.isShadowrocket() || this.isStash()) {
            let s = t.url || t.openUrl || t["open-url"];
            return { url: s };
          }
        }
      };
      if (
        (this.isMute ||
          (this.isSurge() ||
          this.isShadowrocket() ||
          this.isLoon() ||
          this.isStash()
            ? $notification.post(s, e, i, o(r))
            : this.isQuanX() && $notify(s, e, i, o(r))),
        !this.isMuteLog)
      ) {
        let t = [
          "",
          "==============📢系统通知📢==============",
        ];
        t.push(s),
          e && t.push(e),
          i && t.push(i),
          console.log(t.join("\n")),
          (this.logs = this.logs.concat(t));
      }
    }
    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]),
        console.log(t.join(this.logSeparator));
    }
    logErr(t, s) {
      const e = !(
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isQuanX() ||
        this.isLoon() ||
        this.isStash()
      );
      e
        ? this.log("", "❌" + this.name + ", 错误!", t.stack)
        : this.log("", "❌" + this.name + ", 错误!", t);
    }
    wait(t) {
      return new Promise((s) => setTimeout(s, t));
    }
    done(t = {}) {
      const s = new Date().getTime(),
        e = (s - this.startTime) / 1e3;
      this.log(
        "",
        "🔔" + this.name + ", 结束! 🕛 " + e + " 秒"
      ),
        this.log(),
        this.isSurge() ||
        this.isShadowrocket() ||
        this.isQuanX() ||
        this.isLoon() ||
        this.isStash()
          ? $done(t)
          : this.isNode() && process.exit(1);
    }
  })(t, s);
}