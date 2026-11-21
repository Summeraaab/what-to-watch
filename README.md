# 今晚看什么 · 影视推荐器

一个可以安装到手机桌面的 PWA。它只回答一个问题：**现在这点时间，看什么？**

- 内置 60 部精选作品（电影 / 剧集 / 番剧 / 动画 / 综艺 / 小说 / 漫画 / 博主栏目）
- 按你看过什么、打几分，给每部片算贴合度，并用一句话说清「为什么推给你」
- 时间（今晚只有 30 分钟？）+ 类型筛选，永远不会推给你一部 3 小时的电影
- 数据默认只存在本机（localStorage），可导出 / 导入 JSON 备份
- 可选接入 TMDB 实时片库与 AI 理由改写（Key 只存本机）

## 安装到手机

1. 用手机浏览器打开部署地址（推荐 Chrome / Edge / Safari）
2. Android：菜单 →「安装应用」或「添加到主屏幕」
3. iOS Safari：分享 →「添加到主屏幕」
4. 装好之后从桌面图标启动，全屏无地址栏

## 更新机制

代码更新后不需要卸载重装：Service Worker 会在后台拉新版本，切换 UI 时自动提示，点一下即生效，图标和桌面位置保持不变。

## 目录结构

```
index.html              应用外壳（按序加载下面的脚本）
css/app.css             样式
js/data-1~3.js          内置片库（分段存放，便于维护）
js/data.js              拼装片库
js/store.js             状态读写、导入导出、同步适配器占位
js/engine.js            口味画像、打分、推荐理由
js/tmdb.js              TMDB 实时片库客户端
js/app.js               工具函数与首页
js/views.js             片库 / 我的 / 设置
js/detail.js            详情页与冷启动
js/events.js            事件、AI 增强、PWA 启动
sw.js                   离线缓存与版本更新
manifest.webmanifest    安装清单
tools/make_icons.py     构建期生成图标
.github/workflows/pages.yml   GitHub Pages 自动部署
```

## 接入 TMDB（可选）

1. 到 https://www.themoviedb.org/settings/api 申请免费 API Key
2. 应用内「设置 → TMDB」填入 Key，可改镜像地址（国内直连 api.themoviedb.org 可能不通）
3. 片库里会出现「实时」来源的条目，与内置片库一起参与推荐

## 接入 AI 理由（可选）

设置里填 OpenAI 兼容的 `base_url` / `key` / `model`。AI 只改写「为什么推给你」这一句，排序始终由本地规则决定；请求失败会自动回退到规则生成的文案。

## 隐私

TMDB Key、AI Key 与观看记录都只保存在当前设备浏览器里，不上传任何服务器。
