/* TMDB 在线数据源
   默认内置一个共享 Key，装上即用；用户可在设置里换成自己的 Key。
   base/img 可改成镜像地址以适配网络环境 */
const GENRE_ZH = {
  28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪', 99: '纪录', 18: '剧情',
  10751: '家庭', 14: '奇幻', 36: '历史', 27: '恐怖', 10402: '音乐', 9648: '悬疑',
  10749: '爱情', 878: '科幻', 10770: '电视电影', 53: '惊悚', 10752: '战争', 37: '西部',
  10759: '动作冒险', 10762: '儿童', 10763: '新闻', 10764: '真人秀', 10765: '奇幻科幻',
  10766: '肥皂剧', 10767: '脱口秀', 10768: '战争政治'
};
const GENRE_MOOD = {
  28: '燃', 12: '惊奇', 16: '温柔', 35: '轻松', 80: '紧张', 99: '平静', 18: '沉重',
  14: '惊奇', 27: '紧张', 9648: '烧脑', 10749: '浪漫', 878: '震撼', 53: '紧张',
  10752: '悲壮', 10764: '轻松', 10767: '轻松', 10765: '惊奇', 37: '苍凉'
};
const REGION_ZH = { CN: '中国', HK: '中国香港', TW: '中国台湾', JP: '日本', KR: '韩国', US: '美国', GB: '英国', FR: '法国', IN: '印度', TH: '泰国', RU: '俄罗斯', DE: '德国', ES: '西班牙' };
const LANG_REGION = { zh: '中国', ja: '日本', ko: '韩国', en: '美国', fr: '法国', hi: '印度', th: '泰国' };

function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

const TMDB = {
  catalog: [],
  loading: false,
  error: '',
  lastLoaded: 0,
  details: {},
  key: function () { return (state.settings.tmdb.key || '').trim(); },
  base: function () { return ((state.settings.tmdb.base || '').trim() || 'https://api.tmdb.org/3').replace(/\/+$/, ''); },
  /* 依次尝试：用户设置 → TMDB 备用域名，避免某个域名在本地网络被卡死 */
  bases: function () {
    const list = [this.base(), 'https://api.tmdb.org/3', 'https://api.themoviedb.org/3'];
    return list.filter(function (v, i) { return v && list.indexOf(v) === i; });
  },
  imgBase: function () { return ((state.settings.tmdb.img || '').trim() || 'https://image.tmdb.org/t/p').replace(/\/+$/, ''); },
  on: function () { return !!this.key(); },
  poster: function (it, size) { return it.posterPath ? this.imgBase() + '/' + (size || 'w342') + it.posterPath : ''; },

  api: async function (path, params) {
    const key = this.key();
    if (!key) throw new Error('还没有填写 TMDB API Key');
    const qs = new URLSearchParams(Object.assign({ api_key: key, language: 'zh-CN' }, params || {})).toString();
    const hosts = this.bases();
    let lastErr = null;
    for (let i = 0; i < hosts.length; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 12000);
      try {
        const res = await fetch(hosts[i] + path + '?' + qs, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) {
          const err = new Error('TMDB 返回 HTTP ' + res.status);
          err.hard = res.status >= 400 && res.status < 500;
          throw err;
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (e && e.hard) throw e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error('TMDB 连不上，检查网络或换个 API 地址');
  },

  async test() {
    const d = await this.api('/configuration', {});
    if (!d || !d.images) throw new Error('返回格式不对，检查 Base URL 是否指向 TMDB API');
    return true;
  },

  mapItem: function (raw, forceMedia) {
    const media = forceMedia || raw.media_type || (raw.title ? 'movie' : 'tv');
    if (media !== 'movie' && media !== 'tv') return null;
    const isMovie = media === 'movie';
    const tmdbId = raw.id;
    if (!tmdbId) return null;
    const gids = raw.genre_ids || (raw.genres ? raw.genres.map(function (g) { return g.id; }) : []);
    const tags = gids.map(function (g) { return GENRE_ZH[g]; }).filter(Boolean);
    const moods = uniq(gids.map(function (g) { return GENRE_MOOD[g]; }).filter(Boolean));
    const lang = raw.original_language || '';
    const origin = raw.origin_country && raw.origin_country[0];
    const region = REGION_ZH[origin] || LANG_REGION[lang] || '其他';
    let type;
    if (isMovie) type = gids.indexOf(16) > -1 ? '动画' : '电影';
    else if (gids.indexOf(10764) > -1 || gids.indexOf(10767) > -1) type = '综艺';
    else if (gids.indexOf(16) > -1 && lang === 'ja') type = '番剧';
    else if (gids.indexOf(16) > -1) type = '动画';
    else type = '剧集';
    const title = raw.title || raw.name || raw.original_title || raw.original_name || '未命名';
    const date = raw.release_date || raw.first_air_date || '';
    const year = date ? Number(date.slice(0, 4)) : 0;
    const dur = isMovie ? 100 : (type === '番剧' ? 24 : type === '综艺' ? 60 : 45);
    const vote = raw.vote_average || 0;
    const hooks = [];
    if (vote) hooks.push('TMDB 用户评分 ' + vote.toFixed(1) + ' 分' + (raw.vote_count ? '，' + raw.vote_count + ' 人评价' : ''));
    if (tags.length) hooks.push('类型覆盖「' + tags.slice(0, 3).join('」「') + '」');
    if (raw.overview) hooks.push('中文简介已收录，点开就能看剧情梗概');
    else hooks.push('暂无中文简介，可点开查看在线条目');
    return {
      id: 'tmdb-' + media + '-' + tmdbId,
      tmdbId: tmdbId, media: media, src: 'tmdb',
      title: title,
      type: type, region: region, year: year,
      dur: dur, unit: isMovie ? '分钟' : '集', eps: 0,
      status: '连载',
      tags: tags.length ? tags.slice(0, 5) : [isMovie ? '电影' : '剧集'],
      mood: moods.length ? moods.slice(0, 3) : ['平静'],
      pace: '中速',
      synopsis: raw.overview || '这部暂时没有中文简介，点开详情可以查看在线条目。',
      hooks: hooks,
      similar: [],
      hot: 0,
      vote: vote, voteCount: raw.vote_count || 0, popularity: raw.popularity || 0,
      posterPath: raw.poster_path || '',
      detailLoaded: false
    };
  },

  async load(force) {
    if (!this.on()) throw new Error('还没有填写 TMDB API Key');
    if (this.loading) return this.catalog;
    if (!force && this.catalog.length && Date.now() - this.lastLoaded < 10 * 60 * 1000) return this.catalog;
    this.loading = true; this.error = '';
    const calls = [
      ['/trending/all/week', {}],
      ['/movie/popular', {}],
      ['/movie/top_rated', {}],
      ['/tv/popular', {}],
      ['/tv/top_rated', {}],
      ['/discover/tv', { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc' }],
      ['/discover/tv', { with_genres: 10764, sort_by: 'popularity.desc' }],
      ['/discover/movie', { with_original_language: 'zh', sort_by: 'popularity.desc' }]
    ];
    try {
      const results = await Promise.all(calls.map(async function (c) {
        try { return await TMDB.api(c[0], c[1]); } catch (e) { return { results: [] }; }
      }));
      const seen = {};
      const list = [];
      results.forEach(function (r, idx) {
        const force = calls[idx][0].indexOf('/movie/') === 0 ? 'movie' : calls[idx][0].indexOf('/tv/') === 0 ? 'tv' : null;
        (r.results || []).forEach(function (raw) {
          const it = TMDB.mapItem(raw, force || undefined);
          if (!it) return;
          if (seen[it.id]) return;
          seen[it.id] = true;
          list.push(it);
        });
      });
      this.catalog = list.slice(0, 260);
      registerItems(this.catalog);
      this.lastLoaded = Date.now();
      if (!this.catalog.length) throw new Error('没取到数据，检查网络或 Key');
      return this.catalog;
    } catch (e) {
      this.error = e.message || '加载失败';
      throw e;
    } finally {
      this.loading = false;
    }
  },

  async detail(it) {
    if (!it || it.src !== 'tmdb' || it.detailLoaded) return it;
    const d = await this.api('/' + it.media + '/' + it.tmdbId, {});
    if (d) {
      if (d.overview) it.synopsis = d.overview;
      if (it.media === 'movie' && d.runtime) it.dur = d.runtime;
      if (it.media === 'tv') {
        const ert = d.episode_run_time && d.episode_run_time[0];
        if (ert) it.dur = ert;
        if (d.number_of_episodes) it.eps = d.number_of_episodes;
      }
      if (d.status) it.status = { Ended: '完结', 'Returning Series': '连载', Canceled: '已取消', InProduction: '制作中' }[d.status] || d.status;
      it.tagline = d.tagline || '';
      it.homepage = d.homepage || '';
      if (d.vote_average) it.vote = d.vote_average;
      if (d.vote_count) it.voteCount = d.vote_count;
      if (d.genres) {
        it.tags = d.genres.map(function (g) { return GENRE_ZH[g.id] || g.name; }).slice(0, 5);
      }
      it.detailLoaded = true;
    }
    return it;
  }
};