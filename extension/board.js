const api = globalThis.browser ?? globalThis.chrome;

/* ---------------- i18n ---------------- */

const I18N = {
  en: {
    'app.title': 'Bounty Board',
    'filter.minMoney': 'Min pay',
    'filter.maxMinutes': 'Max time',
    'filter.days': 'Window',
    'filter.unitMoney': '¥',
    'filter.unitMinutes': 'min',
    'filter.unitDays': 'days',
    'filter.sort': 'Sort',
    'sort.priority': 'Stars',
    'sort.hourly': 'Rate',
    'sort.money': 'Pay',
    'sort.minutes': 'Time',
    'lang.label': 'Lang',
    'ph.any': 'any',
    'action.rescan': 'Rescan',
    'action.diag': 'Diagnose',
    'action.copy': 'Copy debug',
    'action.reload': 'Reload extension',
    'debug.summary': 'Debug info',
    'section.cash': 'Cash',
    'hint.cash': 'pay and duration both known',
    'section.voucher': 'Vouchers',
    'hint.voucher': 'ranked by face value',
    'section.vague': 'Unclear',
    'hint.vague': 'reward mentioned, no number',
    'section.lottery': 'Lotteries',
    'hint.lottery': 'no guaranteed return',
    'card.open': 'Open',
    'card.skip': 'Skip',
    'kind.cash': 'cash',
    'kind.voucher': 'voucher',
    'kind.vague': 'unclear',
    'kind.lottery': 'lottery',
    'money.voucherUnknown': 'face value unknown',
    'money.unknown': 'no amount',
    'money.none': 'amount unknown',
    'time.unknown': 'duration unknown',
    'time.minutes': '{n} min',
    'time.hours': '{n} h',
    'when.unknown': 'date unknown',
    'when.today': 'today',
    'when.yesterday': 'yesterday',
    'when.dayBefore': '2 days ago',
    'sender.unknown': 'unknown sender',
    'subject.none': '(no subject)',
    'scanned.title': 'Scanned this run',
    'scanned.count': '{n}',
    'tags.hit': 'matched',
    'tags.miss': 'no match',
    'scanned.more': 'Showing first {a} of {b}.',
    'stats.hits': '{n} hits',
    'stats.best': 'best {v}/h',
    'stats.window': 'last {n} days',
    'figure.perHour': ' / h',
    'sub.ext': 'ext v{v}',
    'sub.script': 'script v{v}',
    'note.filtered': '{n} filtered out',
    'note.tooTight': 'nothing passes — loosen the filters',
    'note.scanning': 'Scanning: paging through the list, up to 60s (Chrome shows a debug banner, that is expected)…',
    'note.versionMismatch': 'ext v{ext} · page v{build} — it will reload itself when you refresh',
    'note.legacy': 'This data came from an older script. Hit Rescan.',
    'note.scannedNone': 'Scanned {n} emails and found nothing that looks like a bounty.\nThey are all listed below.',
    'note.empty': 'Nothing collected yet.\nOpen your Outlook inbox, then hit Rescan.',
    'note.opening': 'Opening…',
    'note.openFailed': 'Could not jump there. Subject copied — paste it into Outlook search.',
    'note.diagRunning': 'Running diagnostics…',
    'note.diagFailed': 'Diagnostics failed: {err}',
    'note.diagDone': 'Result below.',
    'note.copied': 'Copied.',
    'note.copyFailed': 'Copy failed — select the text manually.',
    'note.reloading': 'Reloading the extension… the page will refresh itself.',
    'note.waiting': 'Updating extension to v{v}, hold on…',
    'note.reloadManual': 'Still on v{ext}. Reload it manually at chrome://extensions.',
    'note.scanFailed': 'Scan failed: {err}',
    'note.monthDay': '{m}/{d}'
  },
  zh: {
    'app.title': '悬赏令',
    'filter.minMoney': '金额 ≥',
    'filter.maxMinutes': '耗时 ≤',
    'filter.days': '范围',
    'filter.unitMoney': '元',
    'filter.unitMinutes': '分钟',
    'filter.unitDays': '天',
    'filter.sort': '排序',
    'sort.priority': '星级',
    'sort.hourly': '时薪',
    'sort.money': '金额',
    'sort.minutes': '耗时',
    'lang.label': '语言',
    'ph.any': '不限',
    'action.rescan': '重新抓取',
    'action.diag': '诊断',
    'action.copy': '复制调试',
    'action.reload': '重载扩展',
    'debug.summary': '调试信息',
    'section.cash': '现金',
    'hint.cash': '金额和耗时都有，时薪可算',
    'section.voucher': '代金券',
    'hint.voucher': '按面额排，不算时薪',
    'section.vague': '待确认',
    'hint.vague': '只说了有奖励，没写数字',
    'section.lottery': '抽奖',
    'hint.lottery': '不一定有回报',
    'card.open': '打开',
    'card.skip': '忽略',
    'kind.cash': '现金',
    'kind.voucher': '代金券',
    'kind.vague': '待确认',
    'kind.lottery': '抽奖',
    'money.voucherUnknown': '面额未知',
    'money.unknown': '金额未写',
    'money.none': '金额未知',
    'time.unknown': '耗时未知',
    'time.minutes': '{n} 分钟',
    'time.hours': '{n} 小时',
    'when.unknown': '时间未知',
    'when.today': '今天',
    'when.yesterday': '昨天',
    'when.dayBefore': '前天',
    'sender.unknown': '未知发件人',
    'subject.none': '(无主题)',
    'scanned.title': '本次扫到的邮件',
    'scanned.count': '{n} 封',
    'tags.hit': '命中',
    'tags.miss': '未命中',
    'scanned.more': '只列前 {a} 封，共 {b} 封。',
    'stats.hits': '{n} 条命中',
    'stats.best': '最高 {v}/时',
    'stats.window': '扫描 {n} 天',
    'figure.perHour': ' / 时',
    'sub.ext': '扩展 v{v}',
    'sub.script': '脚本 v{v}',
    'note.filtered': '已按条件滤掉 {n} 条',
    'note.tooTight': '条件太紧了，放宽试试',
    'note.scanning': '扫描中：会自动翻页，最多 60 秒（Chrome 顶部会出现调试提示，正常）…',
    'note.versionMismatch': '扩展 v{ext} · 页面 v{build}（刷新后会自动重载）',
    'note.legacy': '这批数据是旧脚本产出的，点「重新抓取」即可。',
    'note.scannedNone': '扫到 {n} 封邮件，但没有一封被认成悬赏。\n下面全列出来了。',
    'note.empty': '还没有抓到东西。\n在 Outlook 里打开收件箱，然后点「重新抓取」。',
    'note.opening': '打开中…',
    'note.openFailed': '没能直接跳转。标题已复制，去 Outlook 搜索框粘贴即可。',
    'note.diagRunning': '诊断中…',
    'note.diagFailed': '诊断失败：{err}',
    'note.diagDone': '结果在下面。',
    'note.copied': '已复制。',
    'note.copyFailed': '复制失败，手动选一下。',
    'note.reloading': '正在重载扩展…页面会自己刷新。',
    'note.waiting': '正在更新到 v{v}，稍等…',
    'note.reloadManual': '扩展仍是 v{ext}，请到 chrome://extensions 手动重载。',
    'note.scanFailed': '抓取失败：{err}',
    'note.monthDay': '{m}/{d}'
  }
};

let LANG = 'en';

function t(key, vars) {
  const dict = I18N[LANG] || I18N.en;
  let s = dict[key] != null ? dict[key] : I18N.en[key] != null ? I18N.en[key] : key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  }
  return s;
}

function applyStatic() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t('app.title');
  document.getElementById('wordmark').textContent = t('app.title');
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.getAttribute('data-i18n'));
  }
  for (const node of document.querySelectorAll('[data-i18n-ph]')) {
    node.placeholder = t(node.getAttribute('data-i18n-ph'));
  }
}

/* ---------------- state ---------------- */

const els = {
  subtitle: document.getElementById('subtitle'),
  stats: document.getElementById('stats'),
  minMoney: document.getElementById('minMoney'),
  maxMinutes: document.getElementById('maxMinutes'),
  days: document.getElementById('days'),
  sort: document.getElementById('sort'),
  lang: document.getElementById('lang'),
  rescan: document.getElementById('rescan'),
  note: document.getElementById('note'),
  list: document.getElementById('list'),
  debug: document.getElementById('debug')
};

const store = { items: {}, ignored: {}, lastScanAt: 0, lastDebug: null, lastScanned: [] };

const SIGN = { HKD: 'HK$', CNY: '¥', USD: '$', TWD: 'NT$', EUR: '€' };

const EXT_VERSION = (() => {
  try { return api.runtime.getManifest().version; } catch (e) { return '?'; }
})();
const BUILD_VERSION = '0.4.0';
const CONTENT_VERSION = 13;

const SECTIONS = [
  { kind: 'cash', title: 'section.cash', hint: 'hint.cash' },
  { kind: 'voucher', title: 'section.voucher', hint: 'hint.voucher' },
  { kind: 'vague', title: 'section.vague', hint: 'hint.vague' },
  { kind: 'lottery', title: 'section.lottery', hint: 'hint.lottery' }
];

/* ---------------- helpers ---------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function fmtMoney(item) {
  if (item.money == null) {
    return item.kind === 'voucher' ? t('money.voucherUnknown') : t('money.unknown');
  }
  return (SIGN[item.currency] || '¥') + item.money.toLocaleString();
}

function fmtMinutes(minutes) {
  if (minutes == null) return t('time.unknown');
  if (minutes < 60) return t('time.minutes', { n: Math.round(minutes) });
  return t('time.hours', { n: Math.round((minutes / 60) * 10) / 10 });
}

function fmtWhen(ts) {
  if (!ts) return t('when.unknown');
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(ts);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 864e5);
  if (diff === 0) return t('when.today');
  if (diff === 1) return t('when.yesterday');
  if (diff === 2) return t('when.dayBefore');
  return t('note.monthDay', { m: d.getMonth() + 1, d: d.getDate() });
}

function stars(item) {
  if (item.kind === 'lottery') return 1;
  if (item.kind === 'vague') return 2;
  if (item.kind === 'voucher') {
    if (item.money == null) return 1;
    return item.money >= 300 ? 3 : item.money >= 100 ? 2 : 1;
  }
  if (item.hourly != null) {
    if (item.hourly >= 600) return 5;
    if (item.hourly >= 400) return 4;
    if (item.hourly >= 250) return 3;
    if (item.hourly >= 120) return 2;
    return 1;
  }
  if (item.money != null) return item.money >= 500 ? 4 : item.money >= 200 ? 3 : 2;
  return 1;
}

function starEl(item) {
  const n = stars(item);
  const wrap = el('div', 'stars');
  wrap.title = n + '/5';
  for (let i = 1; i <= 5; i += 1) {
    wrap.appendChild(el('span', i <= n ? 'on' : 'off', i <= n ? '★' : '☆'));
  }
  return wrap;
}

function passes(item) {
  const minMoney = Number(els.minMoney.value) || 0;
  const maxMinutes = Number(els.maxMinutes.value) || 0;
  if (minMoney > 0 && item.money != null && item.money < minMoney) return false;
  if (maxMinutes > 0 && item.minutes != null && item.minutes > maxMinutes) return false;
  return true;
}

function sortFor(list) {
  const mode = els.sort.value;
  if (mode === 'money') return list.sort((a, b) => (b.money ?? -1) - (a.money ?? -1));
  if (mode === 'minutes') {
    return list.sort((a, b) => {
      const am = a.minutes ?? Infinity;
      const bm = b.minutes ?? Infinity;
      return am - bm || (b.money ?? 0) - (a.money ?? 0);
    });
  }
  if (mode === 'hourly') {
    return list.sort((a, b) => (b.hourly ?? -1) - (a.hourly ?? -1) || (b.money ?? 0) - (a.money ?? 0));
  }
  return list.sort(
    (a, b) => stars(b) - stars(a) || (b.hourly ?? -1) - (a.hourly ?? -1) || (b.money ?? 0) - (a.money ?? 0)
  );
}

/* ---------------- render ---------------- */

function isLegacy() {
  const d = store.lastDebug;
  return !!d && !Array.isArray(d.tabs) && d.rowCount != null;
}

function render() {
  const all = Object.values(store.items || {}).filter((it) => it && !store.ignored[it.id]);
  const kept = [];
  const dropped = [];
  for (const item of all) (passes(item) ? kept : dropped).push(item);

  els.list.textContent = '';

  if (all.length === 0) {
    const n = (store.lastScanned || []).length;
    els.list.appendChild(el('p', 'empty', n > 0 ? t('note.scannedNone', { n }) : t('note.empty')));
  }

  for (const section of SECTIONS) {
    const bucket = sortFor(kept.filter((it) => it.kind === section.kind));
    if (bucket.length === 0) continue;

    const head = el('h2', 'section-title');
    head.appendChild(el('span', 'section-name', t(section.title)));
    head.appendChild(el('span', 'section-count', String(bucket.length)));
    head.appendChild(el('span', 'section-hint', t(section.hint)));
    els.list.appendChild(head);

    bucket.forEach((item) => els.list.appendChild(card(item)));
  }

  renderScanned();
  renderStats(kept);
  renderNote(kept, dropped, all);
}

function renderStats(kept) {
  const parts = [t('stats.hits', { n: kept.length })];
  const withHourly = kept.filter((it) => it.hourly != null).sort((a, b) => b.hourly - a.hourly);
  if (withHourly.length > 0) {
    const best = withHourly[0];
    parts.push(t('stats.best', { v: (SIGN[best.currency] || '') + Math.round(best.hourly) }));
  }
  const days = store.lastDebug?.tabs?.[0]?.days;
  if (days) parts.push(t('stats.window', { n: days }));
  els.stats.textContent = parts.join(' · ');

  const scriptVersions = Array.isArray(store.lastDebug?.tabs)
    ? Array.from(new Set(store.lastDebug.tabs.map((x) => x.v ?? '?'))).join('/')
    : null;
  const stamp = store.lastScanAt
    ? new Date(store.lastScanAt).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : '—';
  els.subtitle.textContent = stamp
    + ' · ' + t('sub.ext', { v: EXT_VERSION })
    + (scriptVersions ? ' · ' + t('sub.script', { v: scriptVersions }) : '');
}

function renderNote(kept, dropped, all) {
  if (EXT_VERSION !== BUILD_VERSION) {
    els.note.textContent = t('note.versionMismatch', { ext: EXT_VERSION, build: BUILD_VERSION });
    return;
  }
  if (isLegacy()) {
    els.note.textContent = t('note.legacy');
    return;
  }
  const parts = [];
  if (dropped.length > 0) parts.push(t('note.filtered', { n: dropped.length }));
  if (all.length > 0 && kept.length === 0) parts.push(t('note.tooTight'));
  els.note.textContent = parts.join(' · ');
}

function card(item) {
  const level = stars(item);
  const wrap = el('article', level >= 4 ? 'row row-strong' : 'row');
  wrap.appendChild(starEl(item));

  const main = el('div', 'row-main');
  main.appendChild(el('h3', 'row-title', item.subject || t('subject.none')));

  const meta = el('div', 'row-meta');
  meta.appendChild(el('span', 'who', item.sender || t('sender.unknown')));
  meta.appendChild(el('span', 'when', fmtWhen(item.when)));
  if (item.kind) meta.appendChild(el('span', 'kind', t('kind.' + item.kind)));
  main.appendChild(meta);
  wrap.appendChild(main);

  const money = el('div', 'row-money');
  const figure = el('div', 'figure');
  let sub = '';
  if (item.hourly != null) {
    figure.appendChild(document.createTextNode(String(Math.round(item.hourly))));
    figure.appendChild(el('span', 'figure-unit', t('figure.perHour')));
    sub = fmtMoney(item) + (item.minutes != null ? ' · ' + fmtMinutes(item.minutes) : '');
  } else if (item.money != null) {
    figure.textContent = fmtMoney(item);
    sub = item.minutes != null ? fmtMinutes(item.minutes) : '';
  } else {
    figure.textContent = '—';
    sub = item.minutes != null ? fmtMinutes(item.minutes) : t('money.none');
  }
  money.appendChild(figure);
  money.appendChild(el('div', 'figure-sub', sub));
  wrap.appendChild(money);

  const act = el('div', 'row-act');
  const open = el('button', 'open', t('card.open'));
  open.addEventListener('click', async () => {
    open.disabled = true;
    open.textContent = '…';
    const res = await api.runtime.sendMessage({ type: 'bounty:openItem', id: item.id });
    if (res && res.ok) {
      const self = await api.tabs.getCurrent();
      if (self) api.tabs.remove(self.id);
      return;
    }
    open.disabled = false;
    open.textContent = t('card.open');
    try { await navigator.clipboard.writeText(item.subject || ''); } catch (e) { /* ignore */ }
    els.note.textContent = t('note.openFailed');
  });
  act.appendChild(open);

  const skip = el('button', 'skip', t('card.skip'));
  skip.addEventListener('click', async () => {
    store.ignored[item.id] = true;
    await api.storage.local.set({ ignored: store.ignored });
    render();
  });
  act.appendChild(skip);

  wrap.appendChild(act);
  return wrap;
}

function renderScanned() {
  const rows = store.lastScanned || [];
  if (rows.length === 0) return;

  const head = el('h2', 'section-title');
  head.appendChild(el('span', 'section-name', t('scanned.title')));
  head.appendChild(el('span', 'section-count', t('scanned.count', { n: rows.length })));
  els.list.appendChild(head);

  const shown = rows.slice(0, 120);
  for (const row of shown) {
    const line = el('div', 'mail-row');
    line.appendChild(el('span', 'mail-when', fmtWhen(row.when)));
    line.appendChild(el('span', 'mail-who', row.sender || '—'));
    line.appendChild(el('span', 'mail-subject', row.subject || t('subject.none')));
    line.appendChild(el(
      'span',
      row.matched ? 'mail-tag hit' : 'mail-tag',
      row.matched ? t('tags.hit') : t('tags.miss')
    ));
    els.list.appendChild(line);
  }
  if (rows.length > shown.length) {
    els.list.appendChild(el('p', 'note', t('scanned.more', { a: shown.length, b: rows.length })));
  }
}

/* ---------------- data ---------------- */

async function load() {
  const got = await api.storage.local.get([
    'items', 'ignored', 'lastScanAt', 'lastDebug', 'lastScanned',
    'minMoney', 'maxMinutes', 'scanDays', 'sort', 'lang'
  ]);
  store.items = got.items || {};
  store.ignored = got.ignored || {};
  store.lastScanAt = got.lastScanAt || 0;
  store.lastDebug = got.lastDebug || null;
  store.lastScanned = got.lastScanned || [];
  els.minMoney.value = got.minMoney ? String(got.minMoney) : '';
  els.maxMinutes.value = got.maxMinutes ? String(got.maxMinutes) : '';
  els.days.value = String(typeof got.scanDays === 'number' ? got.scanDays : 7);
  els.sort.value = got.sort || 'priority';
  LANG = got.lang === 'zh' ? 'zh' : 'en';
  els.lang.value = LANG;
}

els.minMoney.addEventListener('change', async () => {
  await api.storage.local.set({ minMoney: Number(els.minMoney.value) || 0 });
  render();
});

els.maxMinutes.addEventListener('change', async () => {
  await api.storage.local.set({ maxMinutes: Number(els.maxMinutes.value) || 0 });
  render();
});

els.days.addEventListener('change', async () => {
  await api.storage.local.set({ scanDays: Number(els.days.value) || 7 });
  render();
});

els.sort.addEventListener('change', async () => {
  await api.storage.local.set({ sort: els.sort.value });
  render();
});

els.lang.addEventListener('change', async () => {
  LANG = els.lang.value === 'zh' ? 'zh' : 'en';
  await api.storage.local.set({ lang: LANG });
  applyStatic();
  render();
});

els.rescan.addEventListener('click', () => doScan());

async function doScan() {
  const days = Number(els.days.value) || 7;
  els.rescan.disabled = true;
  els.note.textContent = t('note.scanning');
  const res = await api.runtime.sendMessage({
    type: 'bounty:scanNow',
    override: { days, budgetMs: 55000 }
  });
  els.rescan.disabled = false;
  if (res && res.ok) {
    await load();
    render();
  } else {
    els.note.textContent = t('note.scanFailed', { err: res?.error || '?' });
  }
}

// 版本对不上就自己把扩展重载到磁盘上的新版，然后刷新
async function selfUpdate() {
  const now = Date.now();
  const got = await api.storage.local.get('autoReloadAt');

  if (now - (got.autoReloadAt || 0) < 5 * 60 * 1000) {
    if (!sessionStorage.getItem('bb-self-refreshed')) {
      sessionStorage.setItem('bb-self-refreshed', '1');
      els.note.textContent = t('note.waiting', { v: BUILD_VERSION });
      setTimeout(() => location.reload(), 1500);
    } else {
      els.note.textContent = t('note.reloadManual', { ext: EXT_VERSION });
    }
    return;
  }

  await api.storage.local.set({ autoReloadAt: now });
  els.note.textContent = t('note.reloading');
  setTimeout(() => {
    try { api.runtime.reload(); } catch (e) { /* context dies */ }
    setTimeout(() => location.reload(), 1200);
  }, 200);
}

document.getElementById('diag').addEventListener('click', async () => {
  els.note.textContent = t('note.diagRunning');
  const res = await api.runtime.sendMessage({ type: 'bounty:diagNow' });
  if (!res || !res.ok) {
    els.note.textContent = t('note.diagFailed', { err: res?.message || res?.error || '?' });
    return;
  }
  els.debug.textContent = JSON.stringify(res.diag, null, 2);
  els.debug.parentElement.open = true;
  els.note.textContent = t('note.diagDone');
});

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.debug.textContent || '');
    els.note.textContent = t('note.copied');
  } catch (e) {
    els.note.textContent = t('note.copyFailed');
  }
});

document.getElementById('reload').addEventListener('click', () => {
  els.note.textContent = t('note.reloading');
  setTimeout(() => {
    try { api.runtime.reload(); } catch (e) { /* context dies */ }
    setTimeout(() => location.reload(), 1200);
  }, 200);
});

(async () => {
  await load();
  applyStatic();
  render();

  if (EXT_VERSION !== BUILD_VERSION) {
    selfUpdate();
    return;
  }

  const dataV = store.lastDebug?.tabs?.[0]?.v;
  if (dataV !== CONTENT_VERSION) {
    const got = await api.storage.local.get('autoScanAt');
    if (Date.now() - (got.autoScanAt || 0) > 2 * 60 * 1000) {
      await api.storage.local.set({ autoScanAt: Date.now() });
      doScan();
    }
  }
})();
