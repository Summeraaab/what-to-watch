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
    const cur = state.ratings[it.id] || 0;
    return `<div class="seenrow"><span class="t" data-act="open" data-id="${esc(it.id)}" title="看详情" style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.14);text-underline-offset:3px">${esc(it.title)}</span>
      ${[1, 2, 3, 4, 5].map(function (n) {
        return `<button class="rchip ${cur >= n ? 'on' : ''}" data-act="rate" data-id="${esc(it.id)}" data-val="${n}" title="${n} 星（再点一次取消）" aria-label="${n} 星" style="padding:3px 4px;font-size:13px;line-height:1">★</button>`;
      }).join('')}
      <button class="rchip danger" data-act="unrate" data-id="${esc(it.id)}" title="标错了，移出看过的作品" style="padding:3px 2px;font-size:11px;border:0;background:none;color:#8a8a8a;text-decoration:underline;text-underline-offset:2px">移除</button></div>`;
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
      <div><b>${Object.keys(state.ratings).filter(function (k) { return state.ratings[k] >= 4; }).length}</b><span>部 4 星以上</span></div>
      <div><b>${wanted.length}</b><span>部想看</span></div>
    </div>
  </div>
  <div class="panel"><h4>你偏爱的标签</h4>${tagBars}
    ${moods.length ? '<h4 style="margin-top:16px">你偏爱的情绪</h4>' + moodBars : ''}
  </div>
  <div class="panel"><h4>看过的作品</h4>${seenRows}<p class="hint">点标题看详情；点星星改分，再点同一颗星可取消评分；标错了点「移除」，会重新参与推荐。</p></div>
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

/* ---------- 口味分析 ---------- */
function insightTagStats() {
  const out = {};
  Object.keys(state.ratings).forEach(function (id) {
    const it = getItem(id);
    if (!it) return;
    const r = state.ratings[id];
    it.tags.forEach(function (t) {
      if (!out[t]) out[t] = { sum: 0, n: 0 };
      out[t].sum += r; out[t].n += 1;
    });
  });
  return Object.keys(out).map(function (t) { return { tag: t, avg: out[t].sum / out[t].n, n: out[t].n }; });
}

function tasteClusters(high) {
  const used = {}, out = [];
  while (out.length < 3) {
    const cand = high.filter(function (it) { return !used[it.id]; });
    if (cand.length < 2) break;
    const cnt = {};
    cand.forEach(function (it) { it.tags.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    let best = null, bc = 1;
    Object.keys(cnt).forEach(function (t) { if (cnt[t] > bc) { bc = cnt[t]; best = t; } });
    if (!best) break;
    const members = cand.filter(function (it) { return it.tags.indexOf(best) > -1; });
    members.forEach(function (it) { used[it.id] = 1; });
    out.push({ tag: best, members: members });
  }
  return out;
}

function radarSVG(rows) {
  const n = rows.length, cx = 160, cy = 136, R = 86;
  function pt(i, rad) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  }
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(function (k) {
    const pts = rows.map(function (r, i) {
      const p = pt(i, R * k);
      return p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join(' ');
    grid += '<polygon points="' + pts + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1"/>';
  });
  let poly = '', dots = '';
  rows.forEach(function (r, i) {
    const rad = Math.max(8, R * Math.max(0, Math.min(1, r.v)));
    const p = pt(i, rad);
    poly += (poly ? ' ' : '') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
    dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.5" fill="#d8b46a"/>';
  });
  const labels = rows.map(function (r, i) {
    const p = pt(i, R + 20);
    const anchor = p[0] < cx - 10 ? 'end' : p[0] > cx + 10 ? 'start' : 'middle';
    return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" fill="#9a9a9a" font-size="11" text-anchor="' + anchor + '">' + esc(r.tag.slice(0, 4)) + '</text>';
  }).join('');
  return '<svg viewBox="0 0 320 272" style="width:100%;height:auto" role="img" aria-label="口味雷达图">' + grid +
    '<polygon points="' + poly + '" fill="rgba(216,180,106,.16)" stroke="#d8b46a" stroke-width="1.5"/>' + dots + labels + '</svg>';
}

function renderInsight() {
  const prof = buildProfile();
  const ids = Object.keys(state.ratings).map(getItem).filter(Boolean);
  const n = ids.length;
  const head = `<div class="top"><div class="brand"><span class="dot"></span>口味分析</div><div class="cnt">${n} 部已评分</div></div>
  <section class="hero" style="padding-bottom:12px">
    <h1 class="serif" style="font-size:30px">你的口味，拆开看</h1>
    <p class="lede">不只是打分本身，而是背后的结构：偏好、雷区、盲区，以及你自己可能都没注意到的摇摆。</p>
  </section>`;
  if (!n) {
    return head + '<div class="panel"><p class="hint">还没有评分。去首页点「看过了」给几部打星，这里会自动长出来。</p></div>';
  }

  const vals = ids.map(function (it) { return state.ratings[it.id]; }).filter(function (v) { return v > 0; });
  const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce(function (s, v) { return s + (v - avg) * (v - avg); }, 0) / vals.length);
  const highN = vals.filter(function (v) { return v >= 4; }).length;
  const dist = [5, 4, 3, 2, 1].map(function (k) { return { k: k, c: vals.filter(function (v) { return v === k; }).length }; });
  const distMax = Math.max(1, Math.max.apply(null, dist.map(function (d) { return d.c; })));
  const distRows = dist.map(function (d) {
    return `<div class="barrow"><span class="lbl">${d.k} ★</span><span class="bar"><i style="width:${Math.max(3, Math.round(d.c / distMax * 100))}%"></i></span><span class="v">${d.c}</span></div>`;
  }).join('');

  const tagRows = Object.keys(prof.tagW).filter(function (k) { return k.indexOf('节奏·') !== 0; })
    .map(function (k) { return { tag: k, v: prof.tagW[k] }; }).filter(function (x) { return x.v > 0.02; })
    .sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
  const radar = tagRows.length >= 3 ? radarSVG(tagRows) : '<p class="hint">标签样本还太少，标到 5 部以上会出现雷达图。</p>';

  const tagStats = insightTagStats();
  const best = tagStats.filter(function (x) { return x.n >= 2 && x.avg >= 3.4; })
    .sort(function (a, b) { return b.avg - a.avg; }).slice(0, 4);
  const worst = tagStats.filter(function (x) { return x.avg < 3; })
    .sort(function (a, b) { return a.avg - b.avg; }).slice(0, 4);
  const tagLine = function (x, danger) {
    return `<div class="seenrow"><button class="rchip ${danger ? 'danger' : 'on'}" data-act="tag-search" data-val="${esc(x.tag)}">${esc(x.tag)}</button><span class="t">平均 ${x.avg.toFixed(1)} 星 · ${x.n} 部</span></div>`;
  };
  const bestHTML = best.length ? best.map(function (x) { return tagLine(x, false); }).join('') : '<p class="hint">还没有稳定的加分标签，至少给同一类打 2 部以上。</p>';
  const worstHTML = worst.length ? worst.map(function (x) { return tagLine(x, true); }).join('') : '<p class="hint">暂未发现明显雷区。</p>';

  const high = ids.filter(function (it) { return state.ratings[it.id] >= 4; });
  const clusters = high.length >= 4 ? tasteClusters(high) : [];
  const clustersHTML = clusters.length ? clusters.map(function (c) {
    return `<div class="panel"><h4>「${esc(c.tag)}」型 · ${c.members.length} 部</h4>
      <div class="simrow">${c.members.slice(0, 4).map(function (it) {
        return `<button class="sim" data-act="open" data-id="${esc(it.id)}">${esc(it.title)}</button>`;
      }).join('')}</div></div>`;
  }).join('') : '<div class="panel"><p class="hint">高分作品还不够 4 部，暂时分不出口味簇。</p></div>';

  const allTypes = TYPES.filter(function (t) { return t !== '全部'; });
  const blind = allTypes.map(function (t) {
    return { t: t, rated: ids.filter(function (it) { return it.type === t; }).length, total: allItems().filter(function (it) { return it.type === t; }).length };
  }).filter(function (x) { return x.rated === 0 && x.total > 0; });
  const blindHTML = blind.length
    ? `<div class="simrow">${blind.map(function (b) {
        return `<button class="sim" data-act="type-go" data-val="${esc(b.t)}">${esc(b.t)} · ${b.total} 部待看</button>`;
      }).join('')}</div><p class="hint">点一个跳到片库。换口味最快的方式，是在完全没碰过的类型里先挑一部。</p>`
    : '<p class="hint">每个类型都至少评过一部，覆盖面挺全。</p>';

  const covered = new Set(ids.map(function (it) { return it.type; })).size;
  const conf = n < 8 ? `样本只有 ${n} 部，先当参考；标到 15 部以上结论会稳很多。` : `基于 ${n} 部评分、${vals.length} 个有效星级。`;

  return head + `
  <div class="panel"><h4>一眼看懂</h4>
    <div class="stat">
      <div><b>${avg.toFixed(1)}</b><span>平均星</span></div>
      <div><b>${highN}</b><span>部 4 星以上</span></div>
      <div><b>${sd.toFixed(2)}</b><span>打分波动</span></div>
      <div><b>${covered}/${allTypes.length}</b><span>类型覆盖</span></div>
    </div>
    <p class="hint">${conf}</p>
  </div>
  <div class="panel"><h4>评分分布</h4>${distRows}
    <p class="hint">集中在 3 星说明你打分偏保守；两头多说明口味分化明显。</p>
  </div>
  <div class="panel"><h4>口味雷达 · 最突出的六个标签</h4>${radar}
    <p class="hint">数值是相对强度，不是绝对喜好；越靠外表示这个标签在你评分里权重越高。</p>
  </div>
  <div class="panel"><h4>稳定加分标签</h4>${bestHTML}<p class="hint">点标签可以直接跳到片库搜同类。</p></div>
  <div class="panel"><h4>你的雷区</h4>${worstHTML}<p class="hint">这些标签平均不到 3 星，推荐里会自动降权。</p></div>
  ${clustersHTML}
  <div class="panel"><h4>还没碰过的类型</h4>${blindHTML}</div>`;
}

/* ---------- 设置 ---------- */
function renderSettings() {
  const t = state.settings.tmdb, a = state.settings.ai;
  return `
  <div class="top"><div class="brand"><span class="dot"></span>设置</div>
    <button class="ghost-btn" data-act="back-profile">← 返回我的</button></div>
  <section class="hero" style="padding-bottom:8px">
    <h1 class="serif" style="font-size:28px">数据源与增强</h1>
    <p class="lede">已内置一个 TMDB 共享 Key，装上就能用；换成自己的 Key 后只存在这台设备的浏览器里，不会上传。</p>
  </section>

  <div class="panel">
    <h4>TMDB 实时片库</h4>
    <div class="field"><label>API Key（v3 auth）</label>
      <input type="password" id="tmdb-key" placeholder="粘贴你的 TMDB API Key" value="${esc(t.key)}" autocomplete="off">
      <div class="tip">在 themoviedb.org 登录后，Settings → API → 复制 “API Key (v3 auth)”。留空则继续用内置 Key。</div>
    </div>
    <div class="field"><label>API 地址</label>
      <input type="text" id="tmdb-base" value="${esc(t.base)}" autocomplete="off">
      <div class="tip">默认 api.tmdb.org 比 api.themoviedb.org 快；如果仍不通，可改成能访问的镜像地址，格式保持 https://…/3。</div>
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
