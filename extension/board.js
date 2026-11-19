const api = globalThis.browser ?? globalThis.chrome;

const els = {
  subtitle: document.getElementById('subtitle'),
  stats: document.getElementById('stats'),
  minMoney: document.getElementById('minMoney'),
  maxMinutes: document.getElementById('maxMinutes'),
  days: document.getElementById('days'),
  sort: document.getElementById('sort'),
  rescan: document.getElementById('rescan'),
  note: document.getElementById('note'),
  list: document.getElementById('list'),
  debug: document.getElementById('debug')
};

const store = { items: {}, ignored: {}, lastScanAt: 0, lastDebug: null, lastScanned: [] };

const SIGN = { HKD: 'HK$', CNY: '¥', USD: '$', TWD: 'NT$', EUR: '€' };
const KIND_LABEL = { cash: '现金', voucher: '代金券', vague: '待确认', lottery: '抽奖' };

const EXT_VERSION = (() => {
  try { return api.runtime.getManifest().version; } catch (e) { return '?'; }
})();
const BUILD_VERSION = '0.3.0';
const CONTENT_VERSION = 13;

const SECTIONS = [
  { kind: 'cash', title: '现金', hint: '金额和耗时都有，时薪可算' },
  { kind: 'voucher', title: '代金券', hint: '按面额排，不算时薪' },
  { kind: 'vague', title: '待确认', hint: '只说了有奖励，没写数字' },
  { kind: 'lottery', title: '抽奖', hint: '不一定有回报' }
];

/* ---------- 小工具 ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function fmtMoney(item) {
  if (item.money == null) return item.kind === 'voucher' ? '面额未知' : '—';
  return (SIGN[item.currency] || '¥') + item.money.toLocaleString('zh-CN');
}

function fmtMinutes(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return Math.round(minutes) + ' 分钟';
  return (Math.round((minutes / 60) * 10) / 10) + ' 小时';
}

function fmtWhen(ts) {
  if (!ts) return '时间未知';
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(ts);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 864e5);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return (d.getMonth() + 1) + '/' + d.getDate();
}

// 星级 = 优先级。钱多、耗时短、形式确定 → 星多
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
  wrap.title = '优先级 ' + n + '/5';
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

/* ---------- 渲染 ---------- */

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
    const scannedCount = (store.lastScanned || []).length;
    els.list.appendChild(el('p', 'empty', scannedCount > 0
      ? '扫到 ' + scannedCount + ' 封邮件，但没有一封被认成悬赏。\n下面「本次扫到的邮件」里能看到全部。'
      : '还没有抓到东西。\n在 Outlook 里打开收件箱，然后点「重新抓取」。'));
  }

  for (const section of SECTIONS) {
    const bucket = sortFor(kept.filter((it) => it.kind === section.kind));
    if (bucket.length === 0) continue;

    const head = el('h2', 'section-title');
    head.appendChild(el('span', 'section-name', section.title));
    head.appendChild(el('span', 'section-count', bucket.length + ' 条'));
    head.appendChild(el('span', 'section-hint', section.hint));
    els.list.appendChild(head);

    bucket.forEach((item) => els.list.appendChild(card(item)));
  }

  renderScanned();
  renderStats(kept);
  renderNote(kept, dropped, all);
}

function renderStats(kept) {
  const parts = [kept.length + ' 条命中'];
  const withHourly = kept.filter((it) => it.hourly != null).sort((a, b) => b.hourly - a.hourly);
  if (withHourly.length > 0) {
    const best = withHourly[0];
    parts.push('最高 ' + (SIGN[best.currency] || '') + Math.round(best.hourly) + '/时');
  }
  const days = store.lastDebug?.tabs?.[0]?.days;
  if (days) parts.push('扫描 ' + days + ' 天');
  els.stats.textContent = parts.join(' · ');

  const scriptVersions = Array.isArray(store.lastDebug?.tabs)
    ? Array.from(new Set(store.lastDebug.tabs.map((t) => t.v ?? '旧'))).join('/')
    : null;
  const stamp = store.lastScanAt
    ? new Date(store.lastScanAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '还没抓取过';
  els.subtitle.textContent = stamp + ' · 扩展 v' + EXT_VERSION + (scriptVersions ? ' · 脚本 v' + scriptVersions : '');
}

function renderNote(kept, dropped, all) {
  if (EXT_VERSION !== BUILD_VERSION) {
    els.note.textContent = '扩展 v' + EXT_VERSION + ' · 页面 v' + BUILD_VERSION + '（有空点一下「重载扩展」，不急）';
    return;
  }
  if (isLegacy()) {
    els.note.textContent = '这批数据是旧脚本产出的，点「重新抓取」即可。';
    return;
  }
  const parts = [];
  if (dropped.length > 0) parts.push('已按条件滤掉 ' + dropped.length + ' 条');
  if (all.length > 0 && kept.length === 0) parts.push('条件太紧了，放宽试试');
  els.note.textContent = parts.join(' · ');
}

function card(item) {
  const level = stars(item);
  const wrap = el('article', level >= 4 ? 'row row-strong' : 'row');
  wrap.appendChild(starEl(item));

  const main = el('div', 'row-main');
  main.appendChild(el('h3', 'row-title', item.subject || '(无主题)'));

  const meta = el('div', 'row-meta');
  meta.appendChild(el('span', 'who', item.sender || '未知发件人'));
  meta.appendChild(el('span', 'when', fmtWhen(item.when)));
  if (KIND_LABEL[item.kind]) meta.appendChild(el('span', 'kind', KIND_LABEL[item.kind]));
  main.appendChild(meta);
  wrap.appendChild(main);

  const money = el('div', 'row-money');
  const figure = el('div', 'figure');
  let sub = '';
  if (item.hourly != null) {
    figure.appendChild(document.createTextNode(String(Math.round(item.hourly))));
    figure.appendChild(el('span', 'figure-unit', ' / 时'));
    sub = fmtMoney(item) + (item.minutes != null ? ' · ' + fmtMinutes(item.minutes) : '');
  } else if (item.money != null) {
    figure.textContent = fmtMoney(item);
    sub = item.minutes != null ? fmtMinutes(item.minutes) : '面额';
  } else {
    figure.textContent = '—';
    sub = item.minutes != null ? fmtMinutes(item.minutes) : '金额未知';
  }
  money.appendChild(figure);
  money.appendChild(el('div', 'figure-sub', sub));
  wrap.appendChild(money);

  const act = el('div', 'row-act');
  const open = el('button', 'open', '打开');
  open.title = '在新标签打开这封邮件';
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
    open.textContent = '打开';
    try { await navigator.clipboard.writeText(item.subject || ''); } catch (e) { /* 忽略 */ }
    els.note.textContent = '没能直接跳转。标题已复制，去 Outlook 搜索框粘贴即可。';
  });
  act.appendChild(open);

  const skip = el('button', 'skip', '忽略');
  skip.title = '不再显示这条';
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
  head.appendChild(el('span', 'section-name', '本次扫到的邮件'));
  head.appendChild(el('span', 'section-count', rows.length + ' 封'));
  els.list.appendChild(head);

  const shown = rows.slice(0, 120);
  for (const row of shown) {
    const line = el('div', 'mail-row');
    line.appendChild(el('span', 'mail-when', fmtWhen(row.when)));
    line.appendChild(el('span', 'mail-who', row.sender || '—'));
    line.appendChild(el('span', 'mail-subject', row.subject || '(无主题)'));
    const tag = el('span', row.matched ? 'mail-tag hit' : 'mail-tag',
      row.matched ? (KIND_LABEL[row.kind] || '命中') : '未命中');
    line.appendChild(tag);
    els.list.appendChild(line);
  }
  if (rows.length > shown.length) {
    els.list.appendChild(el('p', 'note', '只列前 ' + shown.length + ' 封，共 ' + rows.length + ' 封。'));
  }
}

/* ---------- 数据 ---------- */

async function load() {
  const got = await api.storage.local.get([
    'items', 'ignored', 'lastScanAt', 'lastDebug', 'lastScanned',
    'minMoney', 'maxMinutes', 'scanDays', 'sort'
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

els.rescan.addEventListener('click', () => doScan());

async function doScan() {
  const days = Number(els.days.value) || 7;
  els.rescan.disabled = true;
  els.note.textContent = days + ' 天范围扫描中：会自动翻页，最多 60 秒（Chrome 顶部会出现调试提示，正常）…';
  const res = await api.runtime.sendMessage({
    type: 'bounty:scanNow',
    override: { days, budgetMs: 55000 }
  });
  els.rescan.disabled = false;
  if (res && res.ok) {
    await load();
    render();
  } else {
    els.note.textContent = '抓取失败：' + (res?.error || '未知错误');
  }
}

// 版本对不上就自己把扩展重载到磁盘上的新版，然后开一个新页面
async function selfUpdate() {
  const now = Date.now();
  const got = await api.storage.local.get('autoReloadAt');

  if (now - (got.autoReloadAt || 0) < 5 * 60 * 1000) {
    // 刚重载过：等新版本就位后自己再刷一次
    if (!sessionStorage.getItem('bb-self-refreshed')) {
      sessionStorage.setItem('bb-self-refreshed', '1');
      els.note.textContent = '扩展正在更新到 v' + BUILD_VERSION + '，稍等…';
      setTimeout(() => location.reload(), 1500);
    } else {
      els.note.textContent = '扩展仍是 v' + EXT_VERSION + '，自动重载没生效。请到 chrome://extensions 手动点重载。';
    }
    return;
  }

  await api.storage.local.set({ autoReloadAt: now });
  els.note.textContent = '正在把扩展更新到 v' + BUILD_VERSION + '…';
  setTimeout(() => {
    try { api.runtime.reload(); } catch (e) { /* 页面上下文会失效 */ }
    setTimeout(() => location.reload(), 1200);
  }, 200);
}

document.getElementById('diag').addEventListener('click', async () => {
  els.note.textContent = '诊断中…';
  const res = await api.runtime.sendMessage({ type: 'bounty:diagNow' });
  if (!res || !res.ok) {
    els.note.textContent = res?.message || '诊断失败：' + (res?.error || '未知错误');
    return;
  }
  els.debug.textContent = JSON.stringify(res.diag, null, 2);
  els.debug.parentElement.open = true;
  els.note.textContent = '诊断结果在下面。';
});

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.debug.textContent || '');
    els.note.textContent = '已复制。';
  } catch (e) {
    els.note.textContent = '复制失败，手动选一下。';
  }
});

document.getElementById('reload').addEventListener('click', () => {
  els.note.textContent = '正在让 Chrome 重新读取扩展…页面会失效，然后按 Ctrl+R。';
  setTimeout(() => {
    try { api.runtime.reload(); } catch (e) { /* 页面上下文失效属正常 */ }
  }, 300);
});

(async () => {
  await load();
  render();

  if (EXT_VERSION !== BUILD_VERSION) {
    selfUpdate();
    return;
  }

  // 代码是新的，但数据还是旧脚本采的 → 自动补一次扫描
  const dataV = store.lastDebug?.tabs?.[0]?.v;
  if (dataV !== CONTENT_VERSION) {
    const got = await api.storage.local.get('autoScanAt');
    if (Date.now() - (got.autoScanAt || 0) > 2 * 60 * 1000) {
      await api.storage.local.set({ autoScanAt: Date.now() });
      doScan();
    }
  }
})();
