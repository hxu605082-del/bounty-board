const api = globalThis.browser ?? globalThis.chrome;
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

document.getElementById('scan').addEventListener('click', async () => {
  setStatus('抓取中：会自动往下滚列表，最多 40 秒，别关这个弹窗…');
  const stored = await api.storage.local.get('scanDays');
  const res = await api.runtime.sendMessage({
    type: 'bounty:scanNow',
    override: { days: Number(stored.scanDays) || 7, budgetMs: 40000 }
  });
  if (!res || !res.ok) {
    setStatus('失败了：' + (res?.error || '未知错误'));
    return;
  }
  if (res.tabs === 0) {
    setStatus('没找到 Outlook 标签页，先打开一个再试。');
    return;
  }
  const debugs = Array.isArray(res.debug) ? res.debug : [];
  const rows = debugs.reduce((n, d) => n + (d.rowCount || 0), 0);
  const versions = debugs.map((d) => d.v ?? '旧').join(', ');
  setStatus('扫了 ' + res.tabs + ' 个标签页，' + rows + ' 行，新增 ' + res.added + ' 条，共 ' + res.total + ' 条。\n内容脚本版本：' + (versions || '?'));
});

document.getElementById('board').addEventListener('click', () => {
  api.tabs.create({ url: api.runtime.getURL('board.html') });
});
