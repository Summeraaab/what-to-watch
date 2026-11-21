/* 应用层：视图、交互、AI 增强、PWA 更新 */
const TYPES = ['全部', '电影', '剧集', '番剧', '动画', '综艺', '小说', '漫画', '栏目'];
const TIME = [['any', '不限'], ['short', '20 分钟'], ['hour', '1 小时'], ['evening', '2 小时'], ['long', '追长线']];
const SEEDS = ['s1', 'a1', 'a3', 'a4', 'n1', 'n2', 'm2', 'm1', 'm6', 'v4', 'v1', 'c1'];

const view = {
  tab: 'home', time: 'any', type: '全部', q: '', source: 'all',
  shown: [], exclude: [], seed: 0, detail: null, settings: false
};

const HASH_TAB = { '#home': 'home', '#library': 'library', '#profile': 'profile', '#settings': 'settings' };
if (location.hash && HASH_TAB[location.hash]) view.tab = HASH_TAB[location.hash];

const aiCache = {};
let aiError = '';
let tmdbTried = false;

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
  saveState();
}
function setDislike(id) {
  state.disliked[id] = true;
  delete state.ratings[id];
  saveState();
}

/* ---------- 首页 ---------- */
function poolHome() {
  let pool = allItems().filter(function (it) {
    return !state.ratings[it.id] && !state.disliked[it.id] && view.exclude.indexOf(it.id) < 0;
  });
  if (view.type !== '全部') pool = pool.filter(function (it) { return it.type === view.type; });
  pool = pool.filter(function (it) { return matchTime(it, view.time); });
  if (pool.length < 4) {
    view.exclude = [];
    pool = allItems().filter(function (it) {
      return !state.ratings[it.id] && !state.disliked[it.id] &&
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
    ? '<img class="poster" src="' + esc(poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
    : '';
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
    <div class="acts">
      <button class="btn primary" data-act="open" data-id="${esc(it.id)}">看详情</button>
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
  <div class="top"><div class="brand"><span class="dot"></span>今晚看什么</div><div class="cnt">${allItems().length} 部 · 已标记 ${prof.n}</div></div>
  <section class="hero">
    <div class="kicker">A PERSONAL SCREENING ROOM</div>
    <h1 class="serif">别挑，<br><span style="color:var(--acc);font-style:normal">让口味替你做决定</span></h1>
    <p class="lede">电影、剧集、番剧、综艺、小说、ACG 与博主栏目。先看你有多少时间，再说清为什么是这一部。</p>
  </section>
  ${sourceBar()}
  <div class="rowlabel">现在有多少时间</div>
  <div class="chips">${timeChips}</div>
  <div class="rowlabel">今天想看什么</div>
  <div class="chips wrap">${typeChips}</div>
  <div class="sec"><h2>为你挑的</h2><button class="ghost-btn" data-act="refresh">换一批 ↻</button></div>
  ${body}
  <p class="hint">点「看过了」会更新口味画像；点「不感兴趣」会让同类内容降权。记录只存在这台设备上。</p>`;
}

/* ---------- 片库 ---------- */
