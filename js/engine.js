/* 推荐引擎：口味画像 -> 打分 -> 挑一批 -> 生成可解释的理由
   全部在本地计算，不需要联网；TMDB / AI 只是可选增强层 */
const ITEMS = new Map();
function registerItems(list) {
  list.forEach(function (it) { ITEMS.set(it.id, it); });
}
function allItems() { return Array.from(ITEMS.values()); }
function getItem(id) { return ITEMS.get(id); }
registerItems(LIBRARY);

function buildProfile() {
  const tagW = {}, moodW = {}, liked = {}, seen = {};
  allItems().forEach(function (it) {
    const r = state.ratings[it.id];
    if (!r) return;
    seen[it.id] = true;
    const w = r === 5 ? 1 : r === 3 ? 0.5 : r === 1 ? -0.75 : 0;
    if (!w) return;
    it.tags.forEach(function (t) { tagW[t] = (tagW[t] || 0) + w; });
    it.mood.forEach(function (t) { moodW[t] = (moodW[t] || 0) + w; });
    tagW['节奏·' + it.pace] = (tagW['节奏·' + it.pace] || 0) + w * 0.55;
    if (w > 0) liked[it.id] = w;
  });
  Object.keys(state.disliked).forEach(function (id) {
    const it = getItem(id);
    if (!it) return;
    it.tags.forEach(function (t) { tagW[t] = (tagW[t] || 0) - 0.55; });
    it.mood.forEach(function (t) { moodW[t] = (moodW[t] || 0) - 0.35; });
  });
  /* 「感兴趣」= 弱正向信号：只加 0.4 权重，比「还不错」轻，避免没看过就过度收窄 */
  const wantIds = Object.keys(state.interested).filter(function (id) { return !state.ratings[id]; });
  wantIds.forEach(function (id) {
    const it = getItem(id);
    if (!it) return;
    const w = 0.4;
    it.tags.forEach(function (t) { tagW[t] = (tagW[t] || 0) + w; });
    it.mood.forEach(function (t) { moodW[t] = (moodW[t] || 0) + w * 0.6; });
    tagW['节奏·' + it.pace] = (tagW['节奏·' + it.pace] || 0) + w * 0.3;
  });
  let mx = 0; Object.keys(tagW).forEach(function (k) { mx = Math.max(mx, tagW[k]); });
  if (mx > 0) Object.keys(tagW).forEach(function (k) { tagW[k] = tagW[k] / mx; });
  let mm = 0; Object.keys(moodW).forEach(function (k) { mm = Math.max(mm, moodW[k]); });
  if (mm > 0) Object.keys(moodW).forEach(function (k) { moodW[k] = moodW[k] / mm; });
  return { tagW: tagW, moodW: moodW, liked: liked, seen: seen, n: Object.keys(state.ratings).length + wantIds.length };
}

function overlapTags(a, b, limit) {
  const out = [];
  for (let i = 0; i < a.length && out.length < (limit || 99); i++) {
    if (b.indexOf(a[i]) > -1) out.push(a[i]);
  }
  return out;
}

function neighborOf(it, prof) {
  let best = 0, src = null;
  Object.keys(prof.liked).forEach(function (lid) {
    const li = getItem(lid);
    if (!li || li.id === it.id) return;
    const w = prof.liked[lid];
    if ((li.similar || []).indexOf(it.id) > -1 && 0.85 * w > best) { best = 0.85 * w; src = li; return; }
    if ((it.similar || []).indexOf(li.id) > -1 && 0.6 * w > best) { best = 0.6 * w; src = li; return; }
    const shared = overlapTags(it.tags, li.tags, 99).length;
    if (shared >= 2 && 0.4 * w > best) { best = 0.4 * w; src = li; return; }
    if (shared === 1 && 0.16 * w > best) { best = 0.16 * w; src = li; }
  });
  return { score: best, src: src };
}

function qualityOf(it) {
  if (it.src === 'tmdb') {
    const vote = (it.vote || 0) / 10;
    const pop = Math.min(1, Math.log10((it.popularity || 1) + 1) / 3);
    return vote * 0.85 + pop * 0.15;
  }
  return (it.hot || 3) / 5;
}

function scoreItem(it, prof) {
  const tags = it.tags.concat(['节奏·' + it.pace]);
  const tAvg = tags.reduce(function (s, t) { return s + (prof.tagW[t] || 0); }, 0) / tags.length;
  const mAvg = it.mood.reduce(function (s, t) { return s + (prof.moodW[t] || 0); }, 0) / it.mood.length;
  const nb = neighborOf(it, prof);
  const q = qualityOf(it);
  const score = 1.15 * tAvg + 0.55 * mAvg + 0.6 * nb.score + 0.32 * (q * 2 - 1);
  return { tAvg: tAvg, mAvg: mAvg, nb: nb.score, src: nb.src, q: q, score: score };
}

function reasonsFor(it, prof, s) {
  const out = [];
  if (prof.n === 0) {
    out.push({ t: '还没建立口味模型，先按口碑和类型广度铺开，标记几部之后会越来越准', w: 60 });
    if (qualityOf(it) > 0.75) out.push({ t: '这一部在同类里属于第一梯队，试错成本低', w: 70 });
    return out;
  }
  const good = it.tags.filter(function (t) { return (prof.tagW[t] || 0) > 0.16; })
    .sort(function (a, b) { return prof.tagW[b] - prof.tagW[a]; }).slice(0, 2);
  if (good.length) {
    out.push({ t: '你常选「' + good.join('」「') + '」，它都有', w: Math.round(52 + s.tAvg * 42) });
  }
  if (s.src) {
    const shared = overlapTags(it.tags, s.src.tags, 2);
    out.push({
      t: '和你给高分的《' + s.src.title + '》是同一路' + (shared.length ? '：都属「' + shared.join('、') + '」' : ''),
      w: Math.round(48 + s.nb * 45)
    });
  }
  let moodBest = null, mv = 0;
  it.mood.forEach(function (m) { const v = prof.moodW[m] || 0; if (v > mv) { mv = v; moodBest = m; } });
  if (moodBest && mv > 0.2) {
    out.push({ t: '情绪对得上：你常选的「' + moodBest + '」', w: Math.round(40 + mv * 40) });
  }
  if (it.src === 'tmdb') {
    out.push({
      t: '在线数据：TMDB ' + (it.vote ? it.vote.toFixed(1) : '—') + ' 分' + (it.voteCount ? '，' + it.voteCount + ' 人评分' : ''),
      w: Math.round(50 + (it.vote || 0) * 4)
    });
  }
  if (!out.length) {
    out.push({ t: '「' + it.type + '」里口碑靠前的一档，适合当作入口', w: 55 });
  }
  return out.slice(0, 3);
}

function pctOf(s, prof) {
  if (prof.n === 0) return Math.round(58 + s.q * 34);
  const p = 52 + 36 * s.tAvg + 12 * s.mAvg + 12 * s.nb + 6 * (s.q * 2 - 1);
  return Math.max(45, Math.min(98, Math.round(p)));
}

function totalMin(it) {
  if (it.unit === '分钟') return it.dur;
  if (it.eps) return it.eps * it.dur;
  return it.dur * 30;
}

function matchTime(it, t) {
  if (t === 'any') return true;
  if (t === 'short') return it.dur <= 30;
  if (t === 'hour') return it.dur <= 60;
  if (t === 'evening') return it.dur <= 130;
  if (t === 'long') return totalMin(it) >= 400;
  return true;
}

function basePool(opt) {
  const o = opt || {};
  return allItems().filter(function (it) {
    if (state.ratings[it.id]) return false;
    if (state.disliked[it.id]) return false;
    if (state.interested[it.id]) return false;
    if (o.source && o.source !== 'all' && it.src !== o.source) return false;
    if (o.type && o.type !== '全部' && it.type !== o.type) return false;
    if (o.time && !matchTime(it, o.time)) return false;
    if (o.q) {
      const q = o.q.toLowerCase();
      if ((it.title + it.tags.join('') + it.mood.join('') + it.region).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
}

function recommendList(pool, n, prof, seed) {
  const arr = pool.map(function (it) { return { it: it, s: scoreItem(it, prof) }; });
  arr.forEach(function (x) { if (prof.n === 0) x.s.score += (hashNoise(x.it.id + (seed || 0)) - 0.5) * 0.5; });
  const chosen = [];
  while (chosen.length < n && arr.length) {
    let bi = -1, bv = -1e9;
    arr.forEach(function (x, i) {
      let pen = 0;
      chosen.forEach(function (c) {
        pen += overlapTags(x.it.tags, c.it.tags, 99).length * 0.085;
        if (c.it.type === x.it.type) pen += 0.05;
      });
      const v = x.s.score - pen;
      if (v > bv) { bv = v; bi = i; }
    });
    chosen.push(arr[bi]); arr.splice(bi, 1);
  }
  return chosen;
}

function hashNoise(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
  return (h % 1000) / 1000;
}

function metaLine(it) {
  let len;
  if (it.unit === '分钟') len = it.dur + ' 分钟';
  else if (it.eps) len = (it.unit === '章' || it.unit === '话' ? '约 ' : '') + it.eps + ' ' + it.unit + ' · 单' + it.unit + ' ' + it.dur + ' 分钟';
  else len = '每' + it.unit + ' ' + it.dur + ' 分钟 · 连载';
  return it.year + ' · ' + it.region + ' · ' + len;
}

function shortMeta(it) {
  if (it.unit === '分钟') return it.year + ' · ' + it.dur + ' 分钟';
  if (it.eps) return it.year + ' · ' + (it.unit === '章' || it.unit === '话' ? '约' : '') + it.eps + it.unit;
  return it.year + ' · 连载';
}