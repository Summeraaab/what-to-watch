/* ---------- AI 增强 ---------- */
function aiReady() {
  const a = state.settings.ai;
  return !!(a.enabled && a.key && a.model);
}

function aiSignature(items) { return items.map(function (i) { return i.id; }).join('|'); }

async function enhanceAI() {
  const items = view.recs || [];
  if (!aiReady() || !items.length) return;
  const sig = aiSignature(items);
  if (aiCache[sig]) return;
  const prof = buildProfile();
  const payload = {
    profile: {
      tags: Object.keys(prof.tagW).map(function (k) { return [k, +prof.tagW[k].toFixed(2)]; }).filter(function (p) { return p[0].indexOf('节奏·') !== 0 && p[1] > 0.1; }).slice(0, 8),
      liked: Object.keys(prof.liked).map(getItem).filter(Boolean).slice(0, 6).map(function (i) { return i.title; })
    },
    items: items.map(function (it) {
      return { id: it.id, title: it.title, type: it.type, tags: it.tags, synopsis: it.synopsis.slice(0, 90) };
    })
  };
  const a = state.settings.ai;
  try {
    const res = await fetch(a.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.key },
      body: JSON.stringify({
        model: a.model, temperature: 0.35,
        messages: [
          { role: 'system', content: '你是中文影视推荐编辑。根据用户口味和候选条目，为每条写一句具体的推荐理由，不超过40字，要提到具体标签或相似作品，不要空话、不要说“根据算法”。只输出 JSON：{"items":[{"id":"","why":""}]}' },
          { role: 'user', content: JSON.stringify(payload) }
        ],
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const parsed = JSON.parse((text.match(/\{[\s\S]*\}/) || [text])[0]);
    (parsed.items || []).forEach(function (x) {
      if (x.id && x.why) {
        aiCache[sig] = aiCache[sig] || {};
        aiCache[sig][x.id] = String(x.why).slice(0, 60);
        const el = document.getElementById('why-' + x.id);
        if (el) el.textContent = x.why;
      }
    });
  } catch (e) {
    if (!aiError) {
      aiError = e.message || 'AI 未连接';
      if (view.tab === 'home') toast('AI 增强没连上，已使用本地理由');
    }
  }
}

/* ---------- 事件 ---------- */
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.getAttribute('data-act');
  const id = el.getAttribute('data-id');
  const val = el.getAttribute('data-val');

  if (act === 'tab') { view.tab = val; view.detail = null; if (location.hash) history.replaceState(null, '', '#' + val); render(); window.scrollTo({ top: 0 }); return; }
  if (act === 'time') { view.time = val; view.shown = []; view.exclude = []; if (view.tab === 'settings') view.tab = 'home'; render(); return; }
  if (act === 'type') { view.type = val; view.shown = []; view.exclude = []; render(); return; }
  if (act === 'source') { view.source = val; render(); return; }
  if (act === 'refresh') { view.seed++; view.exclude = view.exclude.concat(view.shown); view.shown = []; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (act === 'open') { openDetail(id); return; }
  if (act === 'jump') { openDetail(id); return; }
  if (act === 'close') { if (e.target.closest('.sheet') && !e.target.closest('.x')) return; closeDetail(); return; }
  if (act === 'seen') { setRating(id, 3); view.shown = []; view.exclude = []; render(); toast('已按「还不错」记下，可在详情里改评分'); return; }
  if (act === 'rate') { setRating(id, Number(val)); closeDetail(); view.shown = []; view.exclude = []; render(); toast('评分已更新'); return; }
  if (act === 'dislike') { setDislike(id); closeDetail(); view.shown = []; view.exclude = []; render(); toast('已减少同类推荐'); return; }
  if (act === 'undislike') { delete state.disliked[id]; saveState(); render(); toast('已撤销'); return; }
  if (act === 'go-settings') { view.tab = 'settings'; history.replaceState(null, '', '#settings'); render(); window.scrollTo({ top: 0 }); return; }
  if (act === 'back-profile') { view.tab = 'profile'; history.replaceState(null, '', '#profile'); render(); return; }
  if (act === 'ob') {
    const v = Number(val);
    if (v === 0) delete state.ratings[id]; else state.ratings[id] = v;
    saveState();
    const row = el.closest('.obrow');
    if (row) row.querySelectorAll('.ob').forEach(function (b) {
      const bv = b.getAttribute('data-val');
      b.classList.toggle('on', bv !== '0' && Number(bv) === state.ratings[id]);
    });
    const pc = document.querySelector('.obf .pc');
    if (pc) {
      const marked = SEEDS.map(getItem).filter(function (x) { return x && state.ratings[x.id]; }).length;
      pc.textContent = '已标 ' + marked + '/' + SEEDS.length;
    }
    return;
  }
  if (act === 'finish' || act === 'skip') { state.onboarded = true; saveState(); view.tab = 'home'; render(); window.scrollTo({ top: 0 }); return; }
  if (act === 'tmdb-retry') {
    TMDB.load(true).then(function () { render(); toast('已更新在线片库'); })
      .catch(function (err) { TMDB.error = err.message; render(); });
    render(); return;
  }
  if (act === 'tmdb-save') {
    bindSettingsValues(function () {
      const st = document.getElementById('tmdb-status');
      if (st) st.textContent = '正在连接 TMDB…';
      TMDB.load(true).then(function () {
        if (st) { st.className = 'status ok'; st.textContent = '连接成功，已加载 ' + TMDB.catalog.length + ' 部在线作品'; }
        render();
        toast('TMDB 已接入');
      }).catch(function (err) {
        if (st) { st.className = 'status err'; st.textContent = '连接失败：' + err.message; }
      });
    });
    return;
  }
  if (act === 'tmdb-test') {
    bindSettingsValues(function () {
      const st = document.getElementById('tmdb-status');
      if (st) { st.className = 'status'; st.textContent = '正在连接…'; }
      TMDB.test().then(function () {
        if (st) { st.className = 'status ok'; st.textContent = '连接正常，Key 可用'; }
      }).catch(function (err) {
        if (st) { st.className = 'status err'; st.textContent = '连接失败：' + err.message; }
      });
    });
    return;
  }
  if (act === 'ai-save') {
    bindSettingsValues(function () {
      const st = document.getElementById('ai-status');
      if (st) { st.className = 'status ok'; st.textContent = aiReady() ? '已保存，下次推荐会启用 AI 改写' : '已保存（未开启或缺少 Key）'; }
    });
    return;
  }
  if (act === 'ai-test') {
    bindSettingsValues(async function () {
      const st = document.getElementById('ai-status');
      if (st) { st.className = 'status'; st.textContent = '正在请求模型…'; }
      try {
        const a = state.settings.ai;
        const r = await fetch(a.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.key },
          body: JSON.stringify({ model: a.model, messages: [{ role: 'user', content: '回复 OK' }], max_tokens: 8 })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (st) { st.className = 'status ok'; st.textContent = '连接成功，模型可用'; }
      } catch (err) {
        if (st) { st.className = 'status err'; st.textContent = '连接失败：' + (err.message || '可能是 CORS 限制') + '。失败时会自动使用本地理由。'; }
      }
    });
    return;
  }
  if (act === 'export') {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '今晚看什么-记录-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    toast('已导出'); return;
  }
  if (act === 'import') { const f = document.getElementById('filein'); if (f) f.click(); return; }
  if (act === 'reset') {
    if (confirm('清空所有记录？评分、负反馈和设置都会删除。')) {
      resetState(); view.tab = 'home'; view.detail = null; render();
    }
    return;
  }
  if (act === 'check-update') {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) { toast('当前不是通过网页安装的版本'); return; }
        reg.update().then(function () { toast('已检查，最新版本会在后台生效'); });
      });
    } else { toast('当前浏览器不支持自动更新'); }
    return;
  }
  if (act === 're-onboard') { state.onboarded = false; saveState(); render(); return; }
});

function bindSettingsValues(after) {
  state.settings.tmdb.key = (document.getElementById('tmdb-key') || {}).value || '';
  state.settings.tmdb.base = (document.getElementById('tmdb-base') || {}).value || '';
  state.settings.tmdb.img = (document.getElementById('tmdb-img') || {}).value || '';
  state.settings.ai.enabled = !!(document.getElementById('ai-on') && document.getElementById('ai-on').checked);
  state.settings.ai.baseUrl = (document.getElementById('ai-base') || {}).value || '';
  state.settings.ai.model = (document.getElementById('ai-model') || {}).value || '';
  state.settings.ai.key = (document.getElementById('ai-key') || {}).value || '';
  saveState();
  if (after) after();
}

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'filein') {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function () {
      try { importState(r.result); toast('记录已导入'); view.tab = 'profile'; render(); }
      catch (err) { toast('文件读不出来，需要本应用导出的 JSON'); }
    };
    r.readAsText(f);
  }
});

/* ---------- PWA 注册与更新 ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      reg.addEventListener('updatefound', function () {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const bar = document.getElementById('upbar');
            if (bar) bar.classList.remove('hidden');
            const btn = document.getElementById('upbtn');
            if (btn) btn.onclick = function () { nw.postMessage({ type: 'SKIP_WAITING' }); };
          }
        });
      });
      setInterval(function () { reg.update(); }, 60 * 60 * 1000);
      reg.update();
    }).catch(function () { /* 未安装也可以正常使用 */ });
  });
}

/* ---------- 启动 ---------- */
render();
if (TMDB.on() && !tmdbTried) {
  tmdbTried = true;
  TMDB.load().then(function () { if (view.tab === 'home' || view.tab === 'library') render(); })
    .catch(function (err) { TMDB.error = err.message; if (view.tab === 'home') render(); });
}
