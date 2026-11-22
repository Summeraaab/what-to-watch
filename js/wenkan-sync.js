/* 闻刊 → 书库 一键同步：在设置的书库面板加同步按钮，接收书库回传的书目 */
(function () {
  var KEY = 'watchnext_library_v1';
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

  function syncURL() {
    var lib = loadLib();
    var base = (lib.readerBase || DEFAULT_READER).replace(/[#?].*$/, '').replace(/\/+$/, '');
    return base + '?wenkan=sync';
  }

  function openSync() {
    var w = window.open(syncURL(), '_blank');
    if (!w) {
      if (typeof toast === 'function') toast('浏览器拦截了弹窗，请允许弹窗后重试');
      return;
    }
    try { w.focus(); } catch (e) {}
    if (typeof toast === 'function') toast('已打开书库，请在书库点「同步到闻刊」');
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
    hint.textContent = '点「从书库同步」会打开书库；在书库点「同步到闻刊」后，书目会自动回到这里。只同步普通书架的书目和阅读进度，隐藏书架、视频、正文、书签和笔记都不会传。';
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

  window.addEventListener('message', function (e) {
    var allowed = [SHUKU_ORIGIN];
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      allowed.push('http://127.0.0.1:8000', 'http://localhost:8000');
    }
    if (allowed.indexOf(e.origin) < 0) return;
    var d = e.data;
    if (!d || d.type !== 'wenkan:shuku-books' || !Array.isArray(d.books)) return;

    var books = [];
    var seen = {};
    d.books.forEach(function (b) {
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
        progress: Math.max(0, Math.min(100, Number(b.progress_pct) || 0)),
        lastRead: b.last_read || null
      });
    });

    var lib = loadLib();
    lib.books = books;
    lib.syncedAt = Number(d.at) || Date.now();
    lib.source = 'bridge';
    saveLib(lib);

    if (typeof toast === 'function') toast('已从书库同步 ' + books.length + ' 本');
    var src = e.source;
    setTimeout(function () {
      try { if (src && src !== window) src.close(); } catch (err) {}
      location.reload();
    }, 900);
  });

  var app = document.getElementById('app');
  if (app) new MutationObserver(function () { enhance(); }).observe(app, { childList: true, subtree: true });
  setTimeout(enhance, 500);
})();
