const api = globalThis.browser ?? globalThis.chrome;
const statusEl = document.getElementById('status');

const STR = {
  en: {
    title: 'Bounty Board',
    hint: 'Open your Outlook inbox first, then rescan.',
    scan: 'Scan current Outlook',
    board: 'Open the board',
    scanning: 'Scanning: paging through the list, up to 60s…',
    failed: 'Failed: ',
    noTab: 'No Outlook tab found. Open one first.',
    done: (tabs, rows, added, total, v) =>
      'Scanned ' + tabs + ' tab(s), ' + rows + ' rows, ' + added + ' new, ' + total + ' total.\nscript v' + v
  },
  zh: {
    title: '悬赏令',
    hint: '先在 Outlook 里打开收件箱，再点抓取。',
    scan: '抓取当前 Outlook',
    board: '打开悬赏令',
    scanning: '抓取中：会自动翻页，最多 60 秒…',
    failed: '失败了：',
    noTab: '没找到 Outlook 标签页，先打开一个再试。',
    done: (tabs, rows, added, total, v) =>
      '扫了 ' + tabs + ' 个标签页，' + rows + ' 行，新增 ' + added + ' 条，共 ' + total + ' 条。\n内容脚本版本：v' + v
  }
};

let LANG = 'en';
const t = (k) => (STR[LANG] || STR.en)[k];

function setStatus(text) {
  statusEl.textContent = text;
}

async function applyLang() {
  const got = await api.storage.local.get('lang');
  LANG = got.lang === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('title').textContent = t('title');
  document.getElementById('hint').textContent = t('hint');
  document.getElementById('scan').textContent = t('scan');
  document.getElementById('board').textContent = t('board');
}

document.getElementById('scan').addEventListener('click', async () => {
  setStatus(t('scanning'));
  const stored = await api.storage.local.get('scanDays');
  const res = await api.runtime.sendMessage({
    type: 'bounty:scanNow',
    override: { days: Number(stored.scanDays) || 7, budgetMs: 55000 }
  });
  if (!res || !res.ok) {
    setStatus(t('failed') + (res?.error || '?'));
    return;
  }
  if (res.tabs === 0) {
    setStatus(t('noTab'));
    return;
  }
  const debugs = Array.isArray(res.debug) ? res.debug : [];
  const rows = debugs.reduce((n, d) => n + (d.rowCount || 0), 0);
  const versions = debugs.map((d) => d.v ?? '?').join(', ');
  setStatus(t('done')(res.tabs, rows, res.added, res.total, versions || '?'));
});

document.getElementById('board').addEventListener('click', () => {
  api.tabs.create({ url: api.runtime.getURL('board.html') });
});

applyLang();
