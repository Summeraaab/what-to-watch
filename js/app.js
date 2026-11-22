/* 应用层：视图、交互、AI 增强、PWA 更新 */
const TYPES = ['全部', '电影', '剧集', '番剧', '动画', '综艺', '小说', '漫画', '栏目'];
const TIME = [['any', '不限'], ['short', '20 分钟'], ['hour', '1 小时'], ['evening', '2 小时'], ['long', '追长线']];
const SEEDS = ['s1', 'a1', 'a3', 'a4', 'n1', 'n2', 'm2', 'm1', 'm6', 'v4', 'v1', 'c1'];

const HOME_REC_N = 10;

const view = {
  tab: 'home', time: 'any', type: '全部', q: '', source: 'all',
  shown: [], exclude: [], seed: 0, detail: null, person: null, personFrom: null, settings: false,
  poolNote: ''
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
  ph.className = el.className + ' ph';
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
function collectHome(opt) {
  const o = opt || {};
  return allItems().filter(function (it) {
    if (!it) return false;
    if (o.exclude && o.exclude.indexOf(it.id) >= 0) return false;
    if (o.rewatch) {
      if (!state.ratings[it.id] || state.disliked[it.id] || state.interested[it.id]) return false;
    } else {
      if (state.ratings[it.id] || state.disliked[it.id] || state.interested[it.id]) return false;
    }
    if (o.type && o.type !== '全部' && it.type !== o.type) return false;
    if (o.time && o.time !== 'any' && !matchTime(it, o.time)) return false;
    return true;
  });
}

function mergePool(pool, extra) {
  const ids = {};
  pool.forEach(function (it) { ids[it.id] = 1; });
  extra.forEach(function (it) { if (!ids[it.id]) { ids[it.id] = 1; pool.push(it); } });
  return pool;
}

function poolHome() {
  const need = HOME_REC_N;
  view.poolNote = '';
  let pool = collectHome({ type: view.type, time: view.time, exclude: view.exclude });

  /* 换一批换到后面没人了：把已看过的这一批放回来，先保证有片可推 */
  if (pool.length < need) {
    const noExclude = collectHome({ type: view.type, time: view.time });
    if (noExclude.length > pool.length) {
      pool = noExclude;
      view.exclude = [];
      view.poolNote = '可推的片不够了，已重新轮换推荐';
    }
  }
  /* 当前时长档位太窄，放宽时长但仍保留类型 */
  if (pool.length < need) {
    const anyTime = collectHome({ type: view.type, time: 'any' });
    if (anyTime.length > pool.length) {
      pool = mergePool(pool, anyTime);
      view.poolNote = '这个时长档位的片不够，已补上同类型的其他时长';
    }
  }
  /* 类型本身片源太少，补充其他类型，保证列表始终有内容 */
  if (pool.length < need) {
    const allTypes = collectHome({ type: '全部', time: 'any' });
    if (allTypes.length > pool.length) {
      pool = mergePool(pool, allTypes);
      view.poolNote = '这个类型的片不够 10 部，已补充其他类型';
    }
  }
  /* 真的没有新片了，拿看过的高分作品做“值得重看” */
  if (pool.length < need) {
    const rewatch = collectHome({ rewatch: true, time: 'any' })
      .sort(function (a, b) { return (state.ratings[b.id] || 0) - (state.ratings[a.id] || 0); });
    if (rewatch.length) {
      pool = mergePool(pool, rewatch);
      view.poolNote = '没有更多新片了，下面是看过的高分作品，可以重看或改分';
    }
  }
  return pool;
}

function recStars(cur, id) {
  return [1, 2, 3, 4, 5].map(function (n) {
    return `<button class="sstar ${cur >= n ? 'on' : ''}" data-act="rate" data-id="${esc(id)}" data-val="${n}" title="${n} 星（再点一次取消）" aria-label="${n} 星">★</button>`;
  }).join('');
}

function cardHTML(x, prof) {
  const it = x.it, s = x.s;
  const rs = reasonsFor(it, prof, s);
  const pct = pctOf(s, prof);
  const poster = it.src === 'tmdb' ? TMDB.poster(it, 'w185') : '';
  const media = poster
    ? '<img class="poster rposter" src="' + esc(poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-ph="' + esc(it.type) + '">'
    : '<div class="poster rposter ph">' + esc(it.type) + '</div>';
  const cur = state.ratings[it.id] || 0;
  return `
  <article class="rrow ${cur ? 'rewatch' : ''}" data-act="open" data-id="${esc(it.id)}">
    ${media}
    <div class="rmain">
      <div class="rmeta"><span class="badge">${esc(it.type)}</span><span class="rmeta2">${esc(shortMeta(it))}${it.src === 'tmdb' ? ' · 在线' : ''}</span></div>
      <h3 class="rname serif">${esc(it.title)}</h3>
      <p class="rwhy"><span class="rtag">${cur ? '重看' : '为什么'}</span>${esc(rs[0].t)}</p>
    </div>
    <div class="rright">
      <span class="rmatch">${pct}%</span>
      <div class="rstars">${recStars(cur, it.id)}</div>
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
  const list = recommendList(pool, Math.min(HOME_REC_N, pool.length), prof, view.seed);
  view.recs = list.map(function (x) { return x.it; });
  view.shown = view.shown.concat(list.map(function (x) { return x.it.id; }));
  const body = list.length
    ? '<div class="reclist">' + list.map(function (x) { return cardHTML(x, prof); }).join('') + '</div>'
    : '<div class="empty"><b>暂时没有可推的了</b>先到片库标记几部看过的，或者去「我的 → 设置」接入 TMDB 增加在线片库。</div>';
  const typeChips = TYPES.map(function (t) {
    return `<button class="chip ${view.type === t ? 'on' : ''}" data-act="type" data-val="${t}">${t}</button>`;
  }).join('');
  const timeChips = TIME.map(function (p) {
    return `<button class="chip ${view.time === p[0] ? 'on' : ''}" data-act="time" data-val="${p[0]}">${p[1]}</button>`;
  }).join('');
  return `
  <div class="top"><div class="brand"><span class="dot"></span>今晚看什么</div><div class="cnt">已看 ${Object.keys(state.ratings).length} · 想看 ${Object.keys(state.interested).length}</div></div>
  <section class="hero home">
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
  <div class="sec"><h2>为你挑的 · ${list.length} 部</h2><button class="ghost-btn" data-act="refresh">换一批 ↻</button></div>
  ${view.poolNote ? '<p class="poolnote">' + esc(view.poolNote) + '</p>' : ''}
  ${body}
  <p class="hint">点整行看详情；右侧星星可以直接打分，再点同一颗星取消评分。每次会给 10 部，片不够时会自动放宽条件补上，不会让推荐页空着。</p>`;
}

/* ---------- 片库 ---------- */
