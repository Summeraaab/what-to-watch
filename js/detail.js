function starRow(cur, id, big) {
  const st = big ? 'min-width:44px;padding:8px 10px;font-size:22px' : 'min-width:34px;padding:5px 7px;font-size:15px';
  return [1, 2, 3, 4, 5].map(function (n) {
    return `<button class="rchip ${cur >= n ? 'on' : ''}" data-act="rate" data-id="${esc(id)}" data-val="${n}" title="${n} 星" aria-label="${n} 星" style="line-height:1;${st}">★</button>`;
  }).join('');
}

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
      ${poster
        ? `<img class="poster" style="width:100%;height:150px;margin:10px 0 0" src="${esc(poster)}" alt="" referrerpolicy="no-referrer" data-drop="1">`
        : ''}
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

      ${creditsBlock(it)}

      ${simTitles ? '<div class="mlabel">气质相近</div><div class="simrow">' + simTitles + '</div>' : ''}

      <div class="mlabel">我记得这部</div>
      <div class="rate">
        <span class="rl">打几星：</span>
        ${starRow(cur, it.id, true)}
        ${cur ? `<button class="ghost-btn" data-act="rate-clear" data-id="${esc(it.id)}" style="font-size:11.5px">清除</button>` : ''}
      </div>
      <p class="hint" style="margin-top:6px">1 星很不喜欢，5 星很喜欢；打分会直接修正口味画像。${it.src === 'tmdb' ? '在线条目只保存 ID，不占空间。' : ''}</p>
      <div class="rate" style="margin-top:10px">
        <button class="btn ${state.interested[it.id] ? 'primary' : ''}" data-act="want" data-id="${esc(it.id)}">${state.interested[it.id] ? '已标感兴趣' : '感兴趣'}</button>
        <button class="btn" data-act="dislike" data-id="${esc(it.id)}" style="margin-left:auto">不感兴趣</button>
      </div>
    </div>
  </div>`;
}

function closeDetail() {
  view.detail = null;
  document.getElementById('overlay').innerHTML = '';
}

/* ---------- 演职员 ---------- */
function renderPeople(people) {
  if (!people || !people.length) return '<p class="hint">暂时没有演职员数据。</p>';
  const groups = [
    ['导演', people.filter(function (p) { return p.role === '导演'; }).slice(0, 3)],
    ['编剧', people.filter(function (p) { return p.role === '编剧'; }).slice(0, 3)],
    ['演员', people.filter(function (p) { return p.role === '演员'; }).slice(0, 10)]
  ];
  const html = groups.map(function (g) {
    if (!g[1].length) return '';
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 9px">
      <span class="hint" style="margin:0;min-width:30px">${g[0]}</span>
      ${g[1].map(function (p) {
        return `<button class="sim" data-act="person" data-pid="${esc(p.id)}" data-role="${g[0]}" data-as="${esc(p.as)}" title="${esc(p.as || p.name)}">${esc(p.name)}</button>`;
      }).join('')}
    </div>`;
  }).join('');
  return html + '<p class="hint" style="margin-top:2px">点人名看 TA 的资料、代表作和新作。</p>';
}

function creditsBlock(it) {
  if (!TMDB.canCredits(it)) {
    const label = it.type === '小说' ? '这本书' : it.type === '漫画' ? '这部漫画' : '这个栏目';
    return '<div class="mlabel">演职员</div><p class="hint">' + label + '暂不包含演职员信息。</p>';
  }
  return '<div class="mlabel">演职员</div><div id="dcred">' +
    (it._credits ? renderPeople(it._credits) : '<p class="hint">正在读取演职员…</p>') + '</div>';
}

function loadCredits(it) {
  if (!TMDB.canCredits(it)) return;
  if (it._credits) {
    it.peopleIds = it._credits.map(function (p) { return String(p.id); });
    return;
  }
  TMDB.credits(it).then(function (list) {
    it.peopleIds = (list || []).map(function (p) { return String(p.id); });
    const el = document.getElementById('dcred');
    if (el && view.detail === it.id) el.innerHTML = renderPeople(list);
  }).catch(function () {
    const el = document.getElementById('dcred');
    if (el && view.detail === it.id) el.innerHTML = '<p class="hint">演职员没取到，可能是网络或 TMDB 数据限制。</p>';
  });
}

/* ---------- 人物卡 ---------- */
function workButtons(works) {
  return works.map(function (w) {
    return `<button class="sim" data-act="open-work" data-media="${esc(w.media)}" data-tid="${esc(w.id)}">${esc(w.title)}${w.year ? ' · ' + w.year : ''}${w.vote ? ' · ★' + w.vote.toFixed(1) : ''}</button>`;
  }).join('');
}

function latestWorks(p) {
  const today = new Date().toISOString().slice(0, 10);
  const up = p.works.filter(function (w) { return w.date && w.date > today; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); });
  const recent = p.works.filter(function (w) { return w.date && w.date <= today; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });
  return (up.length ? up : recent).slice(0, 2).map(function (w) {
    return { id: w.id, media: w.media, title: w.title, year: w.year, date: w.date };
  });
}

function personHTML(p, meta) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = p.works.filter(function (w) { return w.date && w.date > today; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(0, 4);
  const recent = p.works.filter(function (w) { return w.date && w.date <= today; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 6);
  const known = p.works.slice().sort(function (a, b) { return (b.vote * 10 + b.votes / 100) - (a.vote * 10 + a.votes / 100); }).slice(0, 8);
  const on = !!(state.followed && state.followed[p.id]);
  const avatar = p.profilePath
    ? `<img class="poster" style="width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0" src="${esc(TMDB.imgBase() + '/w185' + p.profilePath)}" alt="" referrerpolicy="no-referrer" data-ph="影">`
    : `<div class="poster ph" style="width:64px;height:64px;border-radius:50%;margin:0;font-size:20px">${esc(p.name.slice(0, 1))}</div>`;
  const bio = p.biography ? p.biography.slice(0, 240) + (p.biography.length > 240 ? '…' : '') : '暂无人物简介。';
  return `<div class="scrim" data-act="person-close">
    <div class="sheet" data-stop="1" style="max-height:88vh;overflow:auto">
      <div class="grab"></div>
      <div class="mtop">
        <span class="badge">${esc(p.deptZh)}</span>
        <span>${esc(p.name)}</span>
        <button class="x" data-act="person-close">×</button>
      </div>
      <div style="display:flex;gap:14px;align-items:center;margin:16px 0 8px">
        ${avatar}
        <div style="min-width:0">
          <h2 class="mtitle serif" style="margin:0 0 4px;font-size:24px">${esc(p.name)}</h2>
          <div class="mmeta">${meta && meta.role ? '本片：' + esc(meta.role) + (meta.as ? ' · ' + esc(meta.as) : '') : esc(p.deptZh)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin:10px 0 4px">
        <button class="btn ${on ? 'primary' : ''}" data-act="follow-person" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-profile="${esc(p.profilePath)}" data-dept="${esc(p.deptZh)}">${on ? '已关注' : '关注 TA'}</button>
        <span class="hint" style="margin:0">关注后，TA 的新作会优先出现</span>
      </div>
      <p class="msyn" style="margin-top:10px">${esc(bio)}</p>
      ${upcoming.length ? '<div class="mlabel">即将推出</div><div class="simrow">' + workButtons(upcoming) + '</div>' : ''}
      ${recent.length ? '<div class="mlabel">最近作品</div><div class="simrow">' + workButtons(recent) + '</div>' : ''}
      ${known.length ? '<div class="mlabel">代表作</div><div class="simrow">' + workButtons(known) + '</div>' : '<p class="hint">暂无作品列表。</p>'}
      <p class="hint">点作品直接看详情；资料来自 TMDB，中文简介可能不完整。</p>
    </div>
  </div>`;
}

async function openPersonSheet(pid, meta) {
  if (!pid) return;
  view.personFrom = view.detail;
  view.person = String(pid);
  const ov = document.getElementById('overlay');
  ov.innerHTML = `<div class="scrim" data-act="person-close"><div class="sheet" data-stop="1">
    <div class="grab"></div>
    <div class="mtop"><span class="badge">人物</span><span>正在读取…</span><button class="x" data-act="person-close">×</button></div>
    <div class="loading"><span class="spin"></span>正在取 TMDB 人物资料…</div>
  </div></div>`;
  try {
    const p = await TMDB.person(pid);
    if (view.person !== String(pid)) return;
    ov.innerHTML = personHTML(p, meta || {});
  } catch (e) {
    if (view.person !== String(pid)) return;
    ov.innerHTML = `<div class="scrim" data-act="person-close"><div class="sheet" data-stop="1">
      <div class="grab"></div>
      <div class="mtop"><span class="badge">人物</span><span>没读到资料</span><button class="x" data-act="person-close">×</button></div>
      <p class="hint" style="margin:18px 0">${esc(e.message || '网络问题')}，稍后再试。</p>
    </div></div>`;
  }
}

function closePerson() {
  const from = view.personFrom;
  view.person = null;
  view.personFrom = null;
  document.getElementById('overlay').innerHTML = '';
  if (from) openDetail(from);
}

async function openWork(media, tid) {
  if (!media || !tid) return;
  view.person = null;
  view.personFrom = null;
  toast('正在取作品详情…');
  try {
    const it = await TMDB.work(media, tid);
    openDetail(it.id);
  } catch (e) {
    toast('没取到这部作品：' + (e.message || '网络问题'));
  }
}

async function openDetail(id) {
  const it = getItem(id);
  if (!it) return;
  view.detail = id;
  view.person = null;
  const ov = document.getElementById('overlay');
  ov.innerHTML = detailHTML(it) + '<div class="loading" id="dload" style="position:fixed;left:0;right:0;bottom:30px;z-index:99"><span class="spin"></span>正在取在线详情…</div>';
  loadCredits(it);
  const load = document.getElementById('dload');
  if (it.src === 'tmdb' && !it.detailLoaded) {
    try {
      await TMDB.detail(it);
      if (load) load.remove();
      if (view.detail === id) { ov.innerHTML = detailHTML(it); loadCredits(it); }
      return;
    } catch (e) {
      if (load) load.remove();
      toast('在线详情没取到：' + (e.message || '网络问题'));
      return;
    }
  }
  if (load) load.remove();
}

/* ---------- 打分小窗（点「看过了」时弹出） ---------- */
function openRateSheet(id) {
  const it = getItem(id);
  if (!it) return;
  const cur = state.ratings[id] || 0;
  const ov = document.getElementById('overlay');
  ov.innerHTML = `<div class="scrim" data-act="rate-close">
    <div class="sheet" data-stop="1">
      <div class="grab"></div>
      <div class="mtop">
        <span class="badge">${esc(it.type)}</span>
        <span>${esc(it.title)}</span>
        <button class="x" data-act="rate-close">×</button>
      </div>
      <p class="hint" style="margin:12px 0 2px">看完了就给这部打个星：1 星很不喜欢，5 星很喜欢。点已选的星可取消评分，打分会直接修正口味画像。</p>
      <div class="rate" style="justify-content:center;margin:18px 0 22px">${starRow(cur, it.id, true)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <button class="ghost-btn" data-act="rate-close">先不打</button>
        <span class="hint" style="margin:0">${cur ? '当前 ' + cur + ' 星' : '还没评过'}</span>
      </div>
    </div>
  </div>`;
}

/* ---------- 冷启动 ---------- */
function renderOnboard() {
  const items = SEEDS.map(getItem).filter(Boolean);
  const rows = items.map(function (it) {
    const cur = state.ratings[it.id] || 0;
    const stars = [1, 2, 3, 4, 5].map(function (n) {
      return `<button class="ob ${cur >= n ? 'on' : ''}" data-act="ob" data-id="${esc(it.id)}" data-val="${n}" title="${n} 星" aria-label="${n} 星" style="padding:7px 0">★</button>`;
    }).join('');
    return `<div class="obrow">
      <div class="oh"><span class="ot serif">${esc(it.title)}</span><span class="om">${esc(it.type)} · ${esc(it.region)} · ${esc(it.year)}</span></div>
      <div class="obtns">${stars}<button class="ob ${cur ? '' : 'on'}" data-act="ob" data-id="${esc(it.id)}" data-val="0" style="flex:1.5">没看过</button></div></div>`;
  }).join('');
  const marked = items.filter(function (it) { return state.ratings[it.id]; }).length;
  return `<div class="onb"><div class="onbin">
    <div class="kicker" style="margin-bottom:8px">COLD START · 30 秒</div>
    <h2 class="serif">先告诉我你看过什么</h2>
    <p>下面 12 部是不同方向上的代表作。看过的打个星，5 星是很喜欢，1 星是很不喜欢，没看过就跳过。</p>
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
    ['insight', '分析', 'M4 19V9M10 19V5M16 19v-7M22 19V3'],
    ['profile', '我的', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.5 3.6-5.5 8-5.5s8 2 8 5.5']
  ];
  const nav = `<div class="nav"><div class="navin">${tabs.map(function (t) {
    return `<button class="navbtn ${view.tab === t[0] ? 'on' : ''}" data-act="tab" data-val="${t[0]}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg>${t[1]}</button>`;
  }).join('')}</div></div>`;
  document.getElementById('nav').innerHTML = nav;
  const app = document.getElementById('app');
  if (view.tab === 'home') app.innerHTML = renderHome();
  else if (view.tab === 'library') app.innerHTML = renderLibrary();
  else if (view.tab === 'insight') app.innerHTML = renderInsight();
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
