function detailHTML(it) {
  const prof = buildProfile();
  const s = scoreItem(it, prof);
  const rs = reasonsFor(it, prof, s);
  const pct = pctOf(s, prof);
  const poster = it.src === 'tmdb' ? TMDB.poster(it, 'w500') : '';
  const simTitles = (it.similar || []).map(getItem).filter(Boolean)
    .map(function (x) { return `<button class="sim" data-act="jump" data-id="${esc(x.id)}">${esc(x.title)}</button>`; }).join('');
  const cur = state.ratings[it.id];
  return `
  <div class="scrim" data-act="close">
    <div class="sheet" data-stop="1">
      <div class="grab"></div>
      <div class="mtop">
        <span class="badge">${esc(it.type)}</span>
        <span>${esc(it.region)}${it.year ? ' · ' + it.year : ''}${it.unit === '分钟' ? ' · ' + it.dur + ' 分钟' : (it.eps ? ' · ' + it.eps + it.unit : '')}${it.src === 'tmdb' ? ' · 在线' : ''}</span>
        <span class="match" style="margin-left:auto">${pct}% 贴合</span>
        <button class="x" data-act="close">×</button>
      </div>
      ${poster ? `<img class="poster" style="width:100%;height:150px;margin:10px 0 0" src="${esc(poster)}" alt="" referrerpolicy="no-referrer">` : ''}
      <h2 class="mtitle serif">${esc(it.title)}</h2>
      <div class="mmeta">${esc(it.status)} · ${esc(it.pace)} · ${esc(it.mood.join(' / '))}${it.tagline ? ' · ' + esc(it.tagline) : ''}</div>

      <div class="mlabel">为什么推给你</div>
      <div class="mpoints" id="dpoints">
        ${rs.map(function (r) {
          return `<div class="point"><b>${r.w >= 60 ? '很对味' : r.w >= 45 ? '有依据' : '弱相关'}</b>${esc(r.t)}</div>`;
        }).join('')}
      </div>

      <div class="mlabel">故事梗概</div>
      <p class="msyn">${esc(it.synopsis)}</p>

      <div class="mlabel">吸引人的地方</div>
      <ul class="mhooks">${(it.hooks || []).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('')}</ul>
      <div class="tagrow">${it.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('')}</div>

      ${simTitles ? '<div class="mlabel">气质相近</div><div class="simrow">' + simTitles + '</div>' : ''}

      <div class="mlabel">我记得这部</div>
      <div class="rate">
        <span class="rl">看过了：</span>
        ${[[5, '很喜欢'], [3, '还不错'], [1, '不太喜欢']].map(function (o) {
          return `<button class="rchip ${cur === o[0] ? 'on' : ''}" data-act="rate" data-id="${esc(it.id)}" data-val="${o[0]}">${o[1]}</button>`;
        }).join('')}
        <button class="btn ${state.interested[it.id] ? 'primary' : ''}" data-act="want" data-id="${esc(it.id)}">${state.interested[it.id] ? '已标感兴趣' : '感兴趣'}</button>
        <button class="btn" data-act="dislike" data-id="${esc(it.id)}" style="margin-left:auto">不感兴趣</button>
      </div>
      <p class="hint">标记后这部作品会从推荐池里移出，口味画像同步更新。${it.src === 'tmdb' ? '在线条目只保存 ID，不占空间。' : ''}</p>
    </div>
  </div>`;
}

function closeDetail() {
  view.detail = null;
  document.getElementById('overlay').innerHTML = '';
}

async function openDetail(id) {
  const it = getItem(id);
  if (!it) return;
  view.detail = id;
  const ov = document.getElementById('overlay');
  ov.innerHTML = detailHTML(it) + '<div class="loading" id="dload" style="position:fixed;left:0;right:0;bottom:30px;z-index:99"><span class="spin"></span>正在取在线详情…</div>';
  const load = document.getElementById('dload');
  if (it.src === 'tmdb' && !it.detailLoaded) {
    try {
      await TMDB.detail(it);
      if (load) load.remove();
      if (view.detail === id) ov.innerHTML = detailHTML(it);
      return;
    } catch (e) {
      if (load) load.remove();
      toast('在线详情没取到：' + (e.message || '网络问题'));
      return;
    }
  }
  if (load) load.remove();
}

/* ---------- 冷启动 ---------- */
function renderOnboard() {
  const items = SEEDS.map(getItem).filter(Boolean);
  const rows = items.map(function (it) {
    const cur = state.ratings[it.id];
    return `<div class="obrow">
      <div class="oh"><span class="ot serif">${esc(it.title)}</span><span class="om">${esc(it.type)} · ${esc(it.region)} · ${esc(it.year)}</span></div>
      <div class="obtns">
        ${[[5, '很喜欢'], [3, '还不错'], [1, '不太喜欢'], [0, '没看过']].map(function (o) {
          const on = o[0] !== 0 && cur == o[0];
          return `<button class="ob ${on ? 'on' : ''}" data-act="ob" data-id="${esc(it.id)}" data-val="${o[0]}">${o[1]}</button>`;
        }).join('')}
      </div></div>`;
  }).join('');
  const marked = items.filter(function (it) { return state.ratings[it.id]; }).length;
  return `<div class="onb"><div class="onbin">
    <div class="kicker" style="margin-bottom:8px">COLD START · 30 秒</div>
    <h2 class="serif">先告诉我你看过什么</h2>
    <p>下面 12 部是不同方向上的代表作。看过的打个标记，喜欢的点「很喜欢」，没看过就跳过。</p>
    <p style="color:var(--dim2);font-size:12px">不用全填，标 4–5 部就能形成初步画像。</p>
    <div style="margin-top:18px">${rows}</div>
  </div>
  <div class="obf"><div class="in">
    <span class="pc">已标 ${marked}/${items.length}</span>
    <button class="go" data-act="finish">开始推荐</button>
    <button class="ghost-btn" data-act="skip" style="color:var(--dim2)">跳过</button>
  </div></div></div>`;
}

/* ---------- 总渲染 ---------- */
function render() {
  if (!state.onboarded) {
    document.getElementById('app').innerHTML = '';
    document.getElementById('nav').innerHTML = '';
    document.getElementById('overlay').innerHTML = renderOnboard();
    return;
  }
  const tabs = [
    ['home', '推荐', 'M3 12l9-8 9 8v8a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z'],
    ['library', '片库', 'M4 5h16M4 12h16M4 19h10'],
    ['profile', '我的', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.5 3.6-5.5 8-5.5s8 2 8 5.5']
  ];
  const nav = `<div class="nav"><div class="navin">${tabs.map(function (t) {
    return `<button class="navbtn ${view.tab === t[0] ? 'on' : ''}" data-act="tab" data-val="${t[0]}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg>${t[1]}</button>`;
  }).join('')}</div></div>`;
  document.getElementById('nav').innerHTML = nav;
  const app = document.getElementById('app');
  if (view.tab === 'home') app.innerHTML = renderHome();
  else if (view.tab === 'library') app.innerHTML = renderLibrary();
  else if (view.tab === 'settings') app.innerHTML = renderSettings();
  else app.innerHTML = renderProfile();
  document.getElementById('overlay').innerHTML = '';
  view.detail = null;
  if (view.tab === 'library') bindSearch();
  if (view.tab === 'settings') bindSettings();
  if (view.tab === 'home') enhanceAI();
}

function bindSearch() {
  const q = document.getElementById('q');
  if (!q) return;
  q.addEventListener('input', function (e) {
    if (e.isComposing) return;
    view.q = e.target.value;
    document.getElementById('app').innerHTML = renderLibrary();
    const q2 = document.getElementById('q');
    q2.focus();
    q2.setSelectionRange(q2.value.length, q2.value.length);
    bindSearch();
  });
  q.addEventListener('compositionend', function (e) {
    view.q = e.target.value;
    document.getElementById('app').innerHTML = renderLibrary();
    bindSearch();
  });
}

function bindSettings() {
  const saveTmdb = function () {
    state.settings.tmdb.key = ($('#tmdb-key') || {}).value || '';
    state.settings.tmdb.base = ($('#tmdb-base') || {}).value || '';
    state.settings.tmdb.img = ($('#tmdb-img') || {}).value || '';
    saveState();
  };
  const saveAI = function () {
    state.settings.ai.enabled = !!($('#ai-on') && $('#ai-on').checked);
    state.settings.ai.baseUrl = ($('#ai-base') || {}).value || '';
    state.settings.ai.model = ($('#ai-model') || {}).value || '';
    state.settings.ai.key = ($('#ai-key') || {}).value || '';
    saveState();
  };
  ['tmdb-key', 'tmdb-base', 'tmdb-img'].forEach(function (id) { const el = document.getElementById(id); if (el) el.addEventListener('change', saveTmdb); });
  ['ai-on', 'ai-base', 'ai-model', 'ai-key'].forEach(function (id) { const el = document.getElementById(id); if (el) el.addEventListener('change', saveAI); });
}

/* ---------- AI 增强 ---------- */