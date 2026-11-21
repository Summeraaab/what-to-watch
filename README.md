# 今晚看什么 · 影视推荐器

一个可以安装到手机桌面的 PWA。它只回答一个问题：**现在这点时间，看什么？**

- 内置 60 部精选作品（电影 / 剧集 / 番剧 / 动画 / 综艺 / 小说 / 漫画 / 博主栏目）
- 可选接入 TMDB，实时补充在线片库
- 每条推荐都给出：贴合度、为什么推给你、故事梗概、吸引人的地方
- 按「现在有多少时间」和类型筛选
- 「看过了 / 不感兴趣」会持续修正你的口味画像
- 纯前端，无后端；记录保存在浏览器本地，可导出 / 导入
- 支持 PWA：同一地址自动更新，不用重新下载

## 安装到手机

1. 用手机浏览器打开 Pages 地址（Chrome / Safari 均可）
2. Android Chrome：菜单 →「安装应用」或「添加到主屏幕」
3. iOS Safari：分享 →「添加到主屏幕」
4. 之后从桌面图标打开，就是全屏应用；有新版本时打开会自动更新

## 接入 TMDB（可选）

1. 注册 <https://www.themoviedb.org>，进入 Settings → API
2. 复制 **API Key (v3 auth)**
3. 在应用里打开「我的 → 设置 → TMDB 实时片库」，粘贴并保存
4. Key 只存在这台设备的 `localStorage`，不会进入仓库，也不会外发

> 如果直连 `api.themoviedb.org` 不通，可在设置里把 API 地址换成可访问的镜像（保持 `https://…/3` 格式）。

## AI 增强（可选）

设置里填写任意 OpenAI 兼容接口的 Base URL、模型名和 Key。开启后，只有「为什么推给你」这句话会被模型改写得更自然；排序始终由本地规则决定，失败会自动退回本地理由。

## 更新机制

代码推送到 `main` 分支后，GitHub Actions 自动部署（构建时会先把 `icons/*.png.b64` 解码成 `png`）；Service Worker 带版本号的缓存会在新版本激活时替换旧缓存。用户不需要卸载重装，同一个图标打开就是新版。

发版时改两个地方：

- `js/store.js` 里的 `APP_VERSION`
- `sw.js` 里的 `VERSION` 与 `CACHE` 前缀

## 目录

```
index.html            应用外壳
css/app.css           样式
js/data-1.js ~ 3.js    内置片库（分段数据）
js/data.js            片库合并入口
js/store.js           本地存储 / 导入导出 / 同步接口占位
js/engine.js          口味画像与推荐打分
js/tmdb.js            TMDB 在线数据源
js/app.js             基础工具与首页
js/views.js           片库 / 我的 / 设置视图
js/detail.js          详情页与首次引导
js/events.js          交互事件 / AI 增强 / PWA 更新
sw.js                 Service Worker
manifest.webmanifest  PWA 清单
icons/*.png.b64       图标源（构建时解码为 png）
```
