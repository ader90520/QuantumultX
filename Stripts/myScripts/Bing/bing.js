{
  "id": "bing_complete",
  "name": "Bing积分智能版",
  "author": "@ader90520",
  "repo": "https://github.com/ader90520/QuantumultX",
  "icons": [
    "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Bing.png",
    "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Bing.png"
  ],
  "keys": [
    "bingPointCookieKey",
    "bingSearchCookiePCKey",
    "bingSearchCookieMobileKey",
    "bing_cn",
    "bing_pc_times",
    "bing_mobile_times",
    "bing_interval",
    "bing_reset_hours",
    "bing_cache_point",
    "bing_auto_skip",
    "bing_last_success_date"
  ],
  "settings": [
    {
      "id": "bing_cn",
      "name": "使用国区域名",
      "val": true,
      "type": "boolean",
      "desc": "开启使用cn.bing.com，关闭使用www.bing.com"
    },
    {
      "id": "bing_pc_times",
      "name": "PC端搜索次数",
      "val": 0,
      "type": "number",
      "placeholder": "0",
      "desc": "PC端每次执行搜索次数，设置为0则跳过PC搜索"
    },
    {
      "id": "bing_mobile_times",
      "name": "移动端搜索次数",
      "val": 0,
      "type": "number",
      "placeholder": "0", 
      "desc": "移动端每次执行搜索次数，设置为0则跳过移动搜索"
    },
    {
      "id": "bing_interval",
      "name": "搜索间隔(秒)",
      "val": 5,
      "type": "number",
      "placeholder": "5",
      "desc": "每次搜索之间的间隔时间，避免过快请求"
    },
    {
      "id": "bing_reset_hours",
      "name": "每日重置时间(小时)",
      "val": 8,
      "type": "number",
      "placeholder": "8",
      "desc": "设置每天几点重置任务，24小时制"
    },
    {
      "id": "bing_auto_skip",
      "name": "任务完成后自动跳过",
      "val": true,
      "type": "boolean",
      "desc": "开启后，当天成功获得积分后，后续执行将自动跳过"
    },
    {
      "id": "bing_cache_point",
      "name": "缓存积分",
      "val": 0,
      "type": "number",
      "placeholder": "0",
      "desc": "自动记录的上次积分，无需手动修改"
    },
    {
      "id": "bing_last_success_date",
      "name": "最后成功日期",
      "val": "",
      "type": "text",
      "placeholder": "自动记录",
      "desc": "自动记录最后成功获得积分的日期，用于自动跳过功能"
    },
    {
      "id": "bingPointCookieKey",
      "name": "积分面板Cookie",
      "val": "",
      "type": "textarea",
      "autoGrow": true,
      "placeholder": "自动获取 - 访问rewards.bing.com",
      "desc": "用于获取积分任务列表和执行积分任务"
    },
    {
      "id": "bingSearchCookiePCKey",
      "name": "PC端搜索Cookie",
      "val": "",
      "type": "textarea",
      "autoGrow": true,
      "placeholder": "自动获取 - 在PC浏览器访问Bing搜索",
      "desc": "用于PC端搜索任务，请使用PC浏览器获取"
    },
    {
      "id": "bingSearchCookieMobileKey",
      "name": "移动端搜索Cookie",
      "val": "",
      "type": "textarea",
      "autoGrow": true,
      "placeholder": "自动获取 - 在移动浏览器访问Bing搜索",
      "desc": "用于移动端搜索任务，请使用移动浏览器获取"
    },
    {
      "id": "@bing.diagnose",
      "name": "运行诊断模式",
      "val": false,
      "type": "boolean",
      "desc": "开启后下次执行将运行Cookie诊断，检查所有Cookie状态和配置"
    }
  ],
  "script": "https://raw.githubusercontent.com/ader90520/QuantumultX/refs/heads/main/Stripts/myScripts/Bing/bing.js",
  "desc_html": [
    "<h3>🏆 Bing积分智能版 v5.3</h3>",
    "<p>智能跳过0次搜索配置，完全按照BoxJS设置执行，支持任务完成后自动跳过</p>",
    
    "<h4>🔄 智能执行逻辑</h4>",
    "<ul>",
    "<li><strong>PC搜索次数为0</strong>：完全跳过PC搜索</li>",
    "<li><strong>移动搜索次数为0</strong>：完全跳过移动搜索</li>",
    "<li><strong>Cookie无效</strong>：自动跳过对应端搜索</li>",
    "<li><strong>任务已完成</strong>：当天获得积分后自动跳过后续执行</li>",
    "<li><strong>配置检查</strong>：执行前显示当前配置状态</li>",
    "</ul>",
    
    "<h4>⚙️ 自动跳过功能</h4>",
    "<div style='padding: 10px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px;'>",
    "<p><strong>工作原理：</strong></p>",
    "<ol>",
    "<li>脚本成功获得积分后，记录当前日期</li>",
    "<li>后续执行时检查日期，如果是同一天则自动跳过</li>",
    "<li>第二天自动重置，重新开始执行</li>",
    "</ol>",
    "<p><strong>手动控制：</strong></p>",
    "<ul>",
    "<li>开启/关闭：通过「任务完成后自动跳过」开关控制</li>",
    "<li>强制重置：删除「最后成功日期」的值</li>",
    "</ul>",
    "</div>",
    
    "<h4>⚙️ 配置示例</h4>",
    "<div style='padding: 10px; background: #e9ecef; border-radius: 5px;'>",
    "<p><strong>仅PC搜索：</strong></p>",
    "<ul>",
    "<li>PC搜索次数：2</li>",
    "<li>移动搜索次数：0</li>",
    "</ul>",
    "<p><strong>仅移动搜索：</strong></p>",
    "<ul>",
    "<li>PC搜索次数：0</li>",
    "<li>移动搜索次数：2</li>",
    "</ul>",
    "<p><strong>两者都执行：</strong></p>",
    "<ul>",
    "<li>PC搜索次数：2</li>",
    "<li>移动搜索次数：2</li>",
    "</ul>",
    "</div>",
    
    "<h4>📊 执行日志示例</h4>",
    "<pre>🚀 开始执行智能版搜索 v5.3\n📊 配置: PC2次, 移动0次\n🔧 自动跳过: 开启\n⏭️ 移动搜索次数为0，跳过移动搜索\n✅ PC搜索获得积分: 6 (2次成功)\n📅 记录今日 Mon Dec 04 2023 任务完成，下次将自动跳过\n✅ 脚本执行完成</pre>",
    
    "<div style='padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; margin-top: 15px;'>",
    "<p><strong>🎯 使用场景</strong></p>",
    "<ul>",
    "<li><strong>定时任务优化</strong>：配置每2分钟执行，但每天只真正执行一次</li>",
    "<li><strong>网络不稳定</strong>：只配置一端搜索减少超时风险</li>",
    "<li><strong>Cookie问题</strong>：暂时禁用问题端的搜索</li>",
    "<li><strong>积分上限</strong>：某端已达上限时禁用该端</li>",
    "<li><strong>测试目的</strong>：单独测试PC或移动端搜索效果</li>",
    "</ul>",
    "</div>"
  ]
}