/* 应用层：视图、交互、AI 增强、PWA 更新 */
const TYPES = ['全部', '电影', '剧集', '番剧', '动画', '综艺', '小说', '漫画', '栏目'];
const TIME = [['any', '不限'], ['short', '20 分钟'], ['hour', '1 小时'], ['evening', '2 小时'], ['long', '追长线']];
const SEEDS = ['s1', 'a1', 'a3', 'a4', 'n1', 'n2', 'm2', 'm1', 'm6', 'v4', 'v1', 'c1'];

const view = {
  tab: 'home', time: 'any', type: '全部', q: '', source: 'all',
  shown: [], exclude: [], seed: 0, detail: null, person: null, personFrom: null, settings: false
};

const HASH_TAB = { '#home': 'home', '#library': 'library', '#insight': 'insight', '#profile': 'profile', '#settings': 'settings' };
if (location.hash && HASH_TAB[location.hash]) view.tab = HASH_TAB[location.hash];

const aiCache = {};
let aiError = '';
let tmdbTried = false;

/* 海报加载失败时退回占位块，避免卡片出现破图 */
document.addEventListener('error', function (e) {
  const el = e.target;
  if (!el || el.tagName !== 'IMG' || !el.classList || !el.classList.contains('poster')) return;
  if (el.getAttribute('data-drop') === '1') { if (el.parentNode) el.parentNode.removeChild(el); return; }
  const ph = document.createElement('div');
  ph.className = 'poster ph';
  ph.textContent = el.getAttribute('data-ph') || '暂无海报';
  ph.style.cssText = el.style.cssText;
  if (el.parentNode) el.parentNode.replaceChild(ph, el);
}, true);

function $(s, el) { return (el || document).querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
}

/* ---------- 评分与负反馈 ---------- */
function setRating(id, v) {
  state.ratings[id] = v;
  state.seenAt[id] = Date.now();
  delete state.disliked[id];
  delete state.interested[id];
  saveState();
}
function setDislike(id) {
  state.disliked[id] = true;
  delete state.ratings[id];
  delete state.interested[id];
  saveState();
}

/* ---------- 首页 ---------- */
function poolHome() {
  let pool = allItems().filter(function (it) {
    return !state.ratings[it.id] && !state.disliked[it.id] && !state.interested[it.id] && view.exclude.indexOf(it.id) < 0;
  });
  if (view.type !== '全部') pool = pool.filter(function (it) { return it.type === view.type; });
  pool = pool.filter(function (it) { return matchTime(it, view.time); });
  if (pool.length < 4) {
    view.exclude = [];
    pool = allItems().filter(function (it) {
      return !state.ratings[it.id] && !state.disliked[it.id] && !state.interested[it.id] &&
        (view.type === '全部' || it.type === view.type) && matchTime(it, view.time);
    });
  }
  return pool;
}

function cardHTML(x, prof) {
  const it = x.it, s = x.s;
  const rs = reasonsFor(it, prof, s);
  const pct = pctOf(s, prof);
  const poster = it.src === 'tmdb' ? TMDB.poster(it, 'w185') : '';
  const media = poster
    ? '<img class="poster" src="' + esc(poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-ph="' + esc(it.type) + '">'
    : '<div class="poster ph">' + esc(it.type) + '</div>';
  return `
  <article class="card">
    <div class="ctop">
      <span class="badge">${esc(it.type)}</span>
      <span class="mid">${esc(shortMeta(it))}${it.src === 'tmdb' ? ' · 在线' : ''}</span>
      <span class="match">${pct}% 贴合</span>
    </div>
    <div class="chead">
      ${media}
      <div class="ct">
        <h3 class="title serif">${esc(it.title)}</h3>
        <p class="why"><span class="tag">为什么推给你 · </span><span id="why-${esc(it.id)}">${esc(rs[0].t)}</span></p>
      </div>
    </div>
    <p class="syn">${esc(it.synopsis)}</p>
    <ul class="hooks">${(it.hooks || []).slice(0, 2).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('')}</ul>
    <div class="acts" style="flex-wrap:wrap">
      <button class="btn primary" data-act="open" data-id="${esc(it.id)}">看详情</button>
      <button class="btn ${state.interested[it.id] ? 'primary' : ''}" data-act="want" data-id="${esc(it.id)}">${state.interested[it.id] ? '已标感兴趣' : '感兴趣'}</button>
      <button class="btn" data-act="seen" data-id="${esc(it.id)}">看过了</button>
      <button class="btn plain" data-act="dislike" data-id="${esc(it.id)}">不感兴趣</button>
    </div>
  </article>`;
}

function sourceBar() {
  if (!TMDB.on()) {
    return `<div class="srcbar"><span class="dot" style="background:var(--dim2)"></span>
      内置 ${LIBRARY.length} 部可离线使用；接入 TMDB 后可多出数百部实时作品
      <button class="btn sm" data-act="go-settings">去接入</button></div>`;
  }
  if (TMDB.loading) {
    return `<div class="srcbar"><span class="loading" style="padding:0"><span class="spin"></span>正在拉取 TMDB 实时片库…</span></div>`;
  }
  if (TMDB.error) {
    return `<div class="srcbar"><span class="dot" style="background:var(--warn)"></span>
      TMDB 没连上：${esc(TMDB.error)}
      <button class="btn sm" data-act="tmdb-retry">重试</button></div>`;
  }
  if (!TMDB.catalog.length) {
    return `<div class="srcbar"><span class="loading" style="padding:0"><span class="spin"></span>已接入 TMDB，正在准备在线片库…</span></div>`;
  }
  return `<div class="srcbar"><span class="dot"></span>
    已接入 TMDB · 在线 ${TMDB.catalog.length} 部 + 内置 ${LIBRARY.length} 部
    <button class="btn sm" data-act="tmdb-retry">刷新</button></div>`;
}

function followFeedHTML() {
  const list = [], seen = {};
  Object.keys(state.followed || {}).forEach(function (fid) {
    const f = state.followed[fid];
    (f.latest || []).forEach(function (w) {
      const key = 'tmdb-' + w.media + '-' + w.id;
      if (seen[key] || state.ratings[key] || state.disliked[key]) return;
      /* 内置条目和 TMDB 条目可能同一部作品，按媒体+id 去重，避免把已看过的又推一遍 */
      const seenLocal = allItems().some(function (it) {
        const ent = TMDB.entryOf(it);
        return ent && ent.media === w.media && ent.id === w.id && (state.ratings[it.id] || state.disliked[it.id]);
      });
      if (seenLocal) return;
      seen[key] = 1;
      list.push({ key: key, w: w, f: f });
    });
  });
  if (!list.length) return '';
  list.sort(function (a, b) { return (b.w.date || '').localeCompare(a.w.date || ''); });
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const recent = list.filter(function (x) { return x.w.date && x.w.date >= cutoff; });
  if (!recent.length) return '';
  return `<div class="panel"><h4>关注的人 · 新作</h4>
    <div class="simrow">${recent.slice(0, 4).map(function (x) {
      const soon = x.w.date && x.w.date > today ? '即将 · ' : '';
      return `<button class="sim" data-act="open-work" data-media="${esc(x.w.media)}" data-tid="${esc(x.w.id)}">${soon}${esc(x.f.name)} · ${esc(x.w.title)}${x.w.year ? ' · ' + x.w.year : ''}</button>`;
    }).join('')}</div>
    <p class="hint">你关注的人有新作品或最近作品时，会先摆在这里。</p></div>`;
}

function renderHome() {
  const prof = buildProfile();
  const pool = poolHome();
  const list = recommendList(pool, 4, prof, view.seed);
  view.recs = list.map(function (x) { return x.it; });
  view.shown = view.shown.concat(list.map(function (x) { return x.it.id; }));
  const body = list.length
    ? list.map(function (x) { return cardHTML(x, prof); }).join('')
    : '<div class="empty"><b>这个条件下没有可推的了</b>换个时间档，或者去掉类型筛选；也可以先在片库标记几部看过的。</div>';
  const typeChips = TYPES.map(function (t) {
    return `<button class="chip ${view.type === t ? 'on' : ''}" data-act="type" data-val="${t}">${t}</button>`;
  }).join('');
  const timeChips = TIME.map(function (p) {
    return `<button class="chip ${view.time === p[0] ? 'on' : ''}" data-act="time" data-val="${p[0]}">${p[1]}</button>`;
  }).join('');
  return `
  <div class="top"><div class="brand"><span class="dot"></span>今晚看什么</div><div class="cnt">已看 ${Object.keys(state.ratings).length} · 想看 ${Object.keys(state.interested).length}</div></div>
  <section class="hero">
    <div class="kicker">A PERSONAL SCREENING ROOM</div>
    <h1 class="serif">别挑，<br><span style="color:var(--acc);font-style:normal">让口味替你做决定</span></h1>
    <p class="lede">电影、剧集、番剧、综艺、小说、ACG 与博主栏目。先看你有多少时间，再说清为什么是这一部。</p>
  </section>
  ${sourceBar()}
  ${followFeedHTML()}
  <div class="rowlabel">现在有多少时间</div>
  <div class="chips">${timeChips}</div>
  <div class="rowlabel">今天想看什么</div>
  <div class="chips wrap">${typeChips}</div>
  <div class="sec"><h2>为你挑的</h2><button class="ghost-btn" data-act="refresh">换一批 ↻</button></div>
  ${body}
  <p class="hint">点「感兴趣」会收进想看清单，之后不再重复推给你；点「看过了」会给这部打 1–5 星，评分直接更新口味画像；点「不感兴趣」会让同类内容降权。记录只存在这台设备上。</p>`;
}

/* ---------- 片库 ---------- */
