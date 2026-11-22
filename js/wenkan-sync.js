/* 闻刊 → 书库 一键同步：同标签页往返，用 window.name 携带书目，不依赖弹窗 opener */
(function () {
  var KEY = 'watchnext_library_v1';
  var PREFIX = 'WENKAN_SYNC:';
  var DEFAULT_READER = 'https://4ktzkbxqau69p.doubao.link/app/app_17jed742mpf';
  var SHUKU_ORIGIN = 'https://4ktzkbxqau69p.doubao.link';

  function loadLib() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        books: Array.isArray(d.books) ? d.books : [],
        readerBase: d.readerBase || DEFAULT_READER,
        syncedAt: Number(d.syncedAt) || 0,
        source: d.source || ''
      };
    } catch (e) {
      return { books: [], readerBase: DEFAULT_READER, syncedAt: 0, source: '' };
    }
  }

  function saveLib(lib) {
    try { localStorage.setItem(KEY, JSON.stringify(lib)); } catch (e) {}
  }

  function normalizeBooks(raw) {
    var books = [];
    var seen = {};
    if (!Array.isArray(raw)) return books;
    raw.forEach(function (b) {
      if (!b) return;
      var title = String(b.title || '').trim();
      if (!title) return;
      var id = String(b.id || title);
      if (seen[id]) return;
      seen[id] = 1;
      books.push({
        id: id,
        title: title,
        author: String(b.author || ''),
        type: String(b.type || 'text'),
        progress: Math.max(0, Math.min(100, Number(b.progress_pct != null ? b.progress_pct : b.progress) || 0)),
        lastRead: b.last_read || b.lastRead || null
      });
    });
    return books;
  }

  function applyPayload(d) {
    if (!d || d.type !== 'wenkan:shuku-books' || !Array.isArray(d.books)) return -1;
    var books = normalizeBooks(d.books);
    var lib = loadLib();
    lib.books = books;
    lib.syncedAt = Number(d.at) || Date.now();
    lib.source = 'bridge';
    saveLib(lib);
    return books.length;
  }

  function cleanWenkanParams() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('wenkan') && !u.searchParams.has('wenkan_data')) return;
      u.searchParams.delete('wenkan');
      u.searchParams.delete('wenkan_data');
      var clean = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash;
      history.replaceState(null, '', clean);
    } catch (e) {}
  }

  function toastLater(msg) {
    setTimeout(function () {
      if (typeof toast === 'function') toast(msg);
    }, 700);
  }

  var HANDOFF_N = -1;

  function consumeHandoff() {
    var raw = '';
    try { raw = String(window.name || ''); } catch (e) { return false; }
    if (raw.indexOf(PREFIX) !== 0) return false;
    var d = null;
    try { d = JSON.parse(raw.slice(PREFIX.length)); } catch (e) { d = null; }
    try { window.name = ''; } catch (e) {}
    if (!d) return false;
    var n = applyPayload(d);
    if (n < 0) return false;
    HANDOFF_N = n;
    cleanWenkanParams();
    return true;
  }

  function consumeQueryHandoff() {
    var raw = '';
    try {
      var q = new URLSearchParams(location.search);
      raw = q.get('wenkan_data') || '';
    } catch (e) { return false; }
    if (!raw) return false;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (!d) return false;
    var n = applyPayload(d);
    if (n < 0) return false;
    HANDOFF_N = n;
    cleanWenkanParams();
    return true;
  }

  var HANDOFF = consumeHandoff();
  if (!HANDOFF) HANDOFF = consumeQueryHandoff();

  /* 旧版 index 顺序是 library-link 先加载；它已经缓存了旧书目，写完 storage 后刷新一次让它重读 */
  if (HANDOFF && typeof window.findLibraryBook === 'function') {
    try { sessionStorage.setItem('wenkan_handoff_n', String(HANDOFF_N)); } catch (e) {}
    setTimeout(function () { location.reload(); }, 90);
    return;
  }

  /* 旧顺序刷新后，把数字从 sessionStorage 里取出来补一条 toast */
  try {
    var pending = sessionStorage.getItem('wenkan_handoff_n');
    if (pending !== null) {
      sessionStorage.removeItem('wenkan_handoff_n');
      toastLater('已从书库同步 ' + (Number(pending) || 0) + ' 本');
    } else if (HANDOFF) {
      toastLater('已从书库同步 ' + HANDOFF_N + ' 本');
    }
  } catch (e) {
    if (HANDOFF) toastLater('已从书库同步 ' + HANDOFF_N + ' 本');
  }

  function syncReturnURL() {
    var path = location.pathname || '/';
    return location.origin + path + '#settings';
  }

  function syncURL() {
    var lib = loadLib();
    var base = (lib.readerBase || DEFAULT_READER).replace(/[#?].*$/, '').replace(/\/+$/, '');
    return base + '?wenkan=sync&return=' + encodeURIComponent(syncReturnURL());
  }

  function openSync() {
    location.href = syncURL();
  }

  function lastSyncText() {
    var lib = loadLib();
    if (!lib.syncedAt) return '';
    var d = new Date(lib.syncedAt);
    return '上次同步：' + d.toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' · ' + lib.books.length + ' 本';
  }

  function enhance() {
    var panel = document.querySelector('.libpanel');
    if (!panel || panel.querySelector('[data-wenkan-sync]')) return;
    var acts = panel.querySelector('.acts');
    if (!acts) return;

    var btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.setAttribute('data-wenkan-sync', '1');
    btn.textContent = '从书库同步';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openSync();
    });
    acts.insertBefore(btn, acts.firstChild);

    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '点「从书库同步」会先打开书库；书库整理好书目后会自动回到这里。只同步普通书架的书目和阅读进度，隐藏书架、视频、正文、书签和笔记都不会传。';
    panel.insertBefore(hint, acts);

    var last = lastSyncText();
    if (last) {
      var meta = document.createElement('p');
      meta.className = 'hint';
      meta.setAttribute('data-wenkan-last', '1');
      meta.textContent = last;
      acts.parentNode.insertBefore(meta, acts.nextSibling);
    }
  }

  /* 兼容旧版弹窗桥接：收到 postMessage 后仍按原逻辑刷新 */
  window.addEventListener('message', function (e) {
    var allowed = [SHUKU_ORIGIN];
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      allowed.push('http://127.0.0.1:8000', 'http://localhost:8000');
    }
    if (allowed.indexOf(e.origin) < 0) return;
    var n = applyPayload(e.data);
    if (n < 0) return;
    if (typeof toast === 'function') toast('已从书库同步 ' + n + ' 本');
    var src = e.source;
    setTimeout(function () {
      try { if (src && src !== window) src.close(); } catch (err) {}
      location.reload();
    }, 900);
  });

  var app = document.getElementById('app');
  if (app) new MutationObserver(function () { enhance(); }).observe(app, { childList: true, subtree: true });

  /* 首次 settings 可能在 library-link 之前就被 events.js 画完，load 后补一次渲染 */
  function refreshAfterLoad() {
    if (typeof render === 'function') render();
    setTimeout(enhance, 60);
  }
  if (document.readyState === 'complete') setTimeout(refreshAfterLoad, 80);
  else window.addEventListener('load', function () { setTimeout(refreshAfterLoad, 80); });
})();
