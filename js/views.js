function renderLibrary() {
  const prof = buildProfile();
  let pool = allItems().filter(function (it) {
    if (state.disliked[it.id]) return false;
    if (view.type !== '全部' && it.type !== view.type) return false;
    if (view.source !== 'all' && it.src !== view.source) return false;
    if (!matchTime(it, view.time)) return false;
    if (view.q.trim()) {
      const q = view.q.trim().toLowerCase();
      if ((it.title + it.tags.join('') + it.mood.join('') + it.region).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
  pool.sort(function (a, b) {
    const pa = pctOf(scoreItem(a, prof), prof), pb = pctOf(scoreItem(b, prof), prof);
    return pb - pa;
  });
  const rows = pool.slice(0, 400).map(function (it) {
    const rated = state.ratings[it.id];
    const pct = pctOf(scoreItem(it, prof), prof);
    return `<div class="lrow" data-act="open" data-id="${esc(it.id)}">
      <div class="lt"><div class="n">${esc(it.title)}</div>
      <div class="m">${esc(it.type)} · ${esc(shortMeta(it))} · ${esc(it.tags.slice(0, 2).join(' / '))}${it.src === 'tmdb' ? ' · 在线' : ''}</div></div>
      ${rated ? '<span class="seen">看过</span>' : state.interested[it.id] ? '<span class="seen">想看</span>' : '<span class="pct">' + pct + '%</span>'}
    </div>`;
  }).join('');
  const chips = TYPES.map(function (t) {
    return `<button class="chip ${view.type === t ? 'on' : ''}" data-act="type" data-val="${t}">${t}</button>`;
  }).join('');
  return `
  <div class="top"><div class="brand"><span class="dot"></span>片库</div><div class="cnt">${pool.length} / ${allItems().length}</div></div>
  <section class="hero" style="padding-bottom:12px">
    <h1 class="serif" style="font-size:30px">全部 ${allItems().length} 部</h1>
    <p class="lede">搜标题、类型、地区，或者直接翻。点开能看到它为什么适合你。</p>
  </section>
  <input class="search" id="q" enterkeyhint="search" placeholder="搜：悬疑 / 日本 / 权谋 / 芙莉莲…" value="${esc(view.q)}">
  <div class="srcchips">
    <button class="${view.source === 'all' ? 'on' : ''}" data-act="source" data-val="all">全部</button>
    <button class="${view.source === 'local' ? 'on' : ''}" data-act="source" data-val="local">内置</button>
    <button class="${view.source === 'tmdb' ? 'on' : ''}" data-act="source" data-val="tmdb">在线</button>
  </div>
  <div class="chips wrap">${chips}</div>
  <div class="chips">${TIME.map(function (p) { return `<button class="chip ${view.time === p[0] ? 'on' : ''}" data-act="time" data-val="${p[0]}">${p[1]}</button>`; }).join('')}</div>
  <div class="panel" style="padding:6px 17px">${rows || '<div class="empty">没有匹配的条目</div>'}</div>`;
}

/* ---------- 我的 ---------- */
function renderProfile() {
  const prof = buildProfile();
  const tags = Object.keys(prof.tagW).filter(function (k) { return k.indexOf('节奏·') !== 0; })
    .map(function (k) { return [k, prof.tagW[k]]; }).filter(function (x) { return x[1] > 0.05; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 7);
  const maxTag = tags.length ? tags[0][1] : 1;
  const moods = Object.keys(prof.moodW).map(function (k) { return [k, prof.moodW[k]]; })
    .filter(function (x) { return x[1] > 0.05; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
  const maxMood = moods.length ? moods[0][1] : 1;
  const rated = Object.keys(state.ratings).map(getItem).filter(Boolean)
    .sort(function (a, b) { return (state.ratings[b.id] || 0) - (state.ratings[a.id] || 0); });
  const disliked = Object.keys(state.disliked).map(getItem).filter(Boolean);
  const wanted = Object.keys(state.interested).map(getItem).filter(Boolean)
    .filter(function (it) { return !state.ratings[it.id]; })
    .sort(function (a, b) { return (state.interested[b.id] || 0) - (state.interested[a.id] || 0); });

  const tagBars = tags.length ? tags.map(function (p) {
    return `<div class="barrow"><span class="lbl">${esc(p[0])}</span><span class="bar"><i style="width:${Math.max(6, Math.round(p[1] / maxTag * 100))}%"></i></span><span class="v">${Math.round(p[1] * 100)}</span></div>`;
  }).join('') : '<p class="hint">还没有偏好数据，去首页给几部打个标记。</p>';
  const moodBars = moods.length ? moods.map(function (p) {
    return `<div class="barrow"><span class="lbl">${esc(p[0])}</span><span class="bar"><i style="width:${Math.max(6, Math.round(p[1] / maxMood * 100))}%"></i></span><span class="v">${Math.round(p[1] * 100)}</span></div>`;
  }).join('') : '';

  const seenRows = rated.length ? rated.map(function (it) {
    return `<div class="seenrow"><span class="t">${esc(it.title)}</span>
      ${[[5, '喜欢'], [3, '一般'], [1, '不喜欢']].map(function (o) {
        return `<button class="rchip ${state.ratings[it.id] === o[0] ? 'on' : ''}" data-act="rate" data-id="${esc(it.id)}" data-val="${o[0]}">${o[1]}</button>`;
      }).join('')}</div>`;
  }).join('') : '<p class="hint">还没有标记过作品。</p>';

  const wantRows = wanted.length ? wanted.map(function (it) {
    return `<div class="seenrow"><span class="t">${esc(it.title)}</span>
      <button class="rchip" data-act="seen" data-id="${esc(it.id)}">看过了</button>
      <button class="rchip" data-act="want" data-id="${esc(it.id)}">移除</button></div>`;
  }).join('') : '<p class="hint">还没有想看清单。首页卡片上点「感兴趣」就会进到这里。</p>';

  return `
  <div class="top"><div class="brand"><span class="dot"></span>我的口味</div><div class="cnt">${rated.length} 部已看 · ${wanted.length} 部想看</div></div>
  <section class="hero" style="padding-bottom:14px">
    <h1 class="serif" style="font-size:30px">你的口味画像</h1>
    <p class="lede">推荐不是玄学：它来自你标记过的每一部作品，以及这些作品共有的标签、情绪和气质。</p>
  </section>
  <div class="panel"><h4>状态概览</h4>
    <div class="stat">
      <div><b>${rated.length}</b><span>部看过</span></div>
      <div><b>${Object.keys(state.ratings).filter(function (k) { return state.ratings[k] === 5; }).length}</b><span>部很喜欢</span></div>
      <div><b>${wanted.length}</b><span>部想看</span></div>
    </div>
  </div>
  <div class="panel"><h4>你偏爱的标签</h4>${tagBars}
    ${moods.length ? '<h4 style="margin-top:16px">你偏爱的情绪</h4>' + moodBars : ''}
  </div>
  <div class="panel"><h4>看过的作品</h4>${seenRows}<p class="hint">换评分会立刻改变推荐顺序。</p></div>
  <div class="panel"><h4>想看清单 · ${wanted.length}</h4>${wantRows}<p class="hint">「感兴趣」是比评分更轻的正向信号；进了清单的不会再出现在推荐里。</p></div>
  <div class="panel"><h4>负反馈 · ${disliked.length}</h4>
    ${disliked.length ? disliked.map(function (it) { return `<div class="seenrow"><span class="t">${esc(it.title)}</span><button class="rchip" data-act="undislike" data-id="${esc(it.id)}">撤销</button></div>`; }).join('') : '<p class="hint">还没有拉黑任何一部。</p>'}
  </div>
  <div class="panel" data-act="go-settings" style="cursor:pointer">
    <h4>设置</h4>
    <div class="seenrow" style="border-bottom:none"><span class="t">TMDB 实时片库 · AI 增强 · 数据备份</span><span class="pct">›</span></div>
    <p class="hint">当前：${TMDB.on() ? 'TMDB 已接入' : 'TMDB 未接入'} · ${state.settings.ai.enabled && state.settings.ai.key ? 'AI 已开启' : 'AI 未开启'}</p>
  </div>
  <p class="hint">内置片库 ${LIBRARY.length} 部，全部写在这个应用里，离线也能用。版本 v${APP_VERSION}。</p>`;
}

/* ---------- 设置 ---------- */
function renderSettings() {
  const t = state.settings.tmdb, a = state.settings.ai;
  return `
  <div class="top"><div class="brand"><span class="dot"></span>设置</div>
    <button class="ghost-btn" data-act="back-profile">← 返回我的</button></div>
  <section class="hero" style="padding-bottom:8px">
    <h1 class="serif" style="font-size:28px">数据源与增强</h1>
    <p class="lede">Key 只存在这台设备的浏览器里，不会上传到任何服务器，也不会写进公开仓库。</p>
  </section>

  <div class="panel">
    <h4>TMDB 实时片库</h4>
    <div class="field"><label>API Key（v3 auth）</label>
      <input type="password" id="tmdb-key" placeholder="粘贴你的 TMDB API Key" value="${esc(t.key)}" autocomplete="off">
      <div class="tip">在 themoviedb.org 登录后，Settings → API → 复制 “API Key (v3 auth)”。不填也能用，只是只有内置 ${LIBRARY.length} 部。</div>
    </div>
    <div class="field"><label>API 地址</label>
      <input type="text" id="tmdb-base" value="${esc(t.base)}" autocomplete="off">
      <div class="tip">如果直连 api.themoviedb.org 不通，可以改成可访问的镜像地址，格式保持 https://…/3。</div>
    </div>
    <div class="field"><label>图片地址</label>
      <input type="text" id="tmdb-img" value="${esc(t.img)}" autocomplete="off">
    </div>
    <div class="acts" style="border:none;padding:0;margin-top:4px">
      <button class="btn primary" data-act="tmdb-save">保存并拉取</button>
      <button class="btn" data-act="tmdb-test">测试连接</button>
    </div>
    <div class="status" id="tmdb-status"></div>
  </div>

  <div class="panel">
    <h4>AI 增强（可选）</h4>
    <label class="switch"><input type="checkbox" id="ai-on" ${a.enabled ? 'checked' : ''}>开启后，把规则算出的推荐理由改写得更像人话</label>
    <div class="field"><label>接口地址（OpenAI 兼容）</label>
      <input type="text" id="ai-base" value="${esc(a.baseUrl)}" autocomplete="off">
      <div class="tip">填 https://api.openai.com/v1 或你自己的兼容网关。浏览器会直连，若被 CORS 拦截会自动退回本地理由。</div>
    </div>
    <div class="field"><label>模型名</label><input type="text" id="ai-model" value="${esc(a.model)}" autocomplete="off"></div>
    <div class="field"><label>API Key</label><input type="password" id="ai-key" value="${esc(a.key)}" autocomplete="off"></div>
    <div class="acts" style="border:none;padding:0;margin-top:4px">
      <button class="btn primary" data-act="ai-save">保存</button>
      <button class="btn" data-act="ai-test">测试</button>
    </div>
    <div class="status" id="ai-status"></div>
    <p class="ai-note">AI 只改写推荐理由这一段文字，推荐排序始终由本地规则决定；没网或失败时自动使用本地理由。</p>
  </div>

  <div class="panel">
    <h4>数据</h4>
    <p class="hint">记录只在本机。换设备、清缓存前先导出备份。</p>
    <div class="acts" style="border:none;padding:0;margin-top:10px">
      <button class="btn" data-act="export">导出记录</button>
      <button class="btn" data-act="import">导入记录</button>
      <button class="btn plain danger" data-act="reset">清空</button>
    </div>
    <input type="file" id="filein" accept="application/json" style="display:none">
  </div>

  <div class="panel">
    <h4>云端同步（预留）</h4>
    <label class="switch"><input type="checkbox" disabled>多设备同步</label>
    <p class="hint">状态已经按「可同步」结构保存（含版本号和最后修改时间），接入 Supabase 后可以直接整体推拉，不需要迁移数据。当前版本先只在本机。</p>
  </div>

  <div class="panel">
    <h4>关于</h4>
    <div class="seenrow"><span class="t">版本</span><span class="pct">v${APP_VERSION}</span></div>
    <div class="seenrow" style="border-bottom:none"><span class="t">离线可用</span><span class="pct">已缓存</span></div>
    <div class="acts" style="border:none;padding:0;margin-top:8px">
      <button class="btn" data-act="check-update">检查更新</button>
      <button class="btn" data-act="re-onboard">重新建立口味</button>
    </div>
  </div>`;
}

/* ---------- 详情 ---------- */