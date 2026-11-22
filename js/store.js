/* 本地存储层：数据结构从第一天起就按「可同步」设计
   - 顶层带 v（schema 版本）、updatedAt（最后修改时间）
   - 只存纯 JSON，方便未来整体推送到云端
*/
const APP_VERSION = '1.0.11';
const STORE_KEY = 'watchnext_state_v1';

const DEFAULT_SETTINGS = {
  tmdb: { key: '3b7ae078f0c27db48a992487c0f006ad', base: 'https://api.tmdb.org/3', img: 'https://image.tmdb.org/t/p' },
  ai: { enabled: false, baseUrl: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini' }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function defaultState() {
  return {
    v: 1,
    ratings: {},      // id -> 1~5 星（1 很不喜欢，5 很喜欢）
    disliked: {},     // id -> true
    interested: {},   // id -> 标「感兴趣」的时间戳（想看清单）
    seenAt: {},       // id -> timestamp
    followed: {},     // 人物 id -> { name, profilePath, dept, latest, at }
    settings: clone(DEFAULT_SETTINGS),
    onboarded: false,
    createdAt: Date.now(),
    updatedAt: 0
  };
}

function mergeState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;
  s.ratings = raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {};
  s.disliked = raw.disliked && typeof raw.disliked === 'object' ? raw.disliked : {};
  s.interested = raw.interested && typeof raw.interested === 'object' ? raw.interested : {};
  s.seenAt = raw.seenAt && typeof raw.seenAt === 'object' ? raw.seenAt : {};
  s.followed = raw.followed && typeof raw.followed === 'object' ? raw.followed : {};
  s.onboarded = !!raw.onboarded;
  s.createdAt = raw.createdAt || Date.now();
  s.updatedAt = raw.updatedAt || 0;
  const st = raw.settings || {};
  s.settings.tmdb = Object.assign({}, DEFAULT_SETTINGS.tmdb, st.tmdb || {});
  if (!s.settings.tmdb.key) s.settings.tmdb.key = DEFAULT_SETTINGS.tmdb.key;
  const tb = (s.settings.tmdb.base || '').replace(/\/+$/, '');
  if (!tb || tb === 'https://api.themoviedb.org/3') s.settings.tmdb.base = DEFAULT_SETTINGS.tmdb.base;
  s.settings.ai = Object.assign({}, DEFAULT_SETTINGS.ai, st.ai || {});
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 隐私模式或空间不足时静默失败，功能仍可用 */
  }
}

/* 感兴趣：加入/移出「想看清单」。看了就清掉，避免两个状态打架 */
function toggleInterest(id) {
  if (state.interested[id]) {
    delete state.interested[id];
  } else {
    state.interested[id] = Date.now();
    delete state.disliked[id];
  }
  saveState();
  return !!state.interested[id];
}

function exportState() {
  const out = clone(state);
  out.exportedAt = new Date().toISOString();
  return JSON.stringify(out, null, 2);
}

function importState(text) {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || !raw.ratings) throw new Error('不是本应用导出的记录');
  const s = mergeState(raw);
  s.onboarded = true;
  state = s;
  saveState();
}

function resetState() {
  state = defaultState();
  saveState();
}

/* 预留的云端同步接口：接入 Supabase 时只需实现这两个方法，
   页面层不用改，因为状态本身就是一份可序列化的快照 */
const SyncAdapter = {
  ready: false,
  async push() { throw new Error('云端同步尚未启用'); },
  async pull() { throw new Error('云端同步尚未启用'); }
};
