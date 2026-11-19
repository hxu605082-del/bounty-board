const api = globalThis.browser ?? globalThis.chrome;

// background.js —— 扫描调度、结果合并、点击回原邮件。
const OUTLOOK_PATTERNS = [
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.live.com/*',
  'https://outlook.cloud.microsoft/*'
];
const SCAN_ALARM = 'bounty-scan';
const SCAN_VERSION = 13;
const TWELVE_HOURS = 12 * 60;
const DAILY_HOURS = [12, 0]; // 正午 12:00 和午夜 24:00
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 每天固定两个时间点扫一次；不弹窗、不抢焦点，只在图标上留个数字。
function scheduleDaily() {
  for (const hour of DAILY_HOURS) {
    const name = 'bounty-daily-' + hour;
    api.alarms.get(name).then((existing) => {
      if (existing) return;
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      api.alarms.create(name, { when: next.getTime(), periodInMinutes: 24 * 60 });
    });
  }
}

api.runtime.onInstalled.addListener(() => {
  scheduleDaily();
});

api.runtime.onStartup.addListener(() => {
  scheduleDaily();
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('bounty-daily-') || alarm.name === SCAN_ALARM) {
    scanAllTabs();
  }
});

async function findOutlookTabs() {
  return api.tabs.query({ url: OUTLOOK_PATTERNS });
}

async function pingTab(tabId) {
  try {
    const res = await api.tabs.sendMessage(tabId, { type: 'bb:ping' });
    return res?.v ?? 0;
  } catch (e) {
    return 0;
  }
}

// 每次都主动把当前版本注入一遍，页面里残留多老的脚本都不影响。
async function ensureContent(tabId) {
  if ((await pingTab(tabId)) >= SCAN_VERSION) return true;

  try {
    await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    return false;
  }

  for (let i = 0; i < 12; i += 1) {
    await sleep(300);
    if ((await pingTab(tabId)) >= SCAN_VERSION) return true;
  }
  return false;
}

async function scanTab(tabId, options) {
  if (!(await ensureContent(tabId))) return null;

  const start = await api.tabs.sendMessage(tabId, { type: 'bb:harvestStart', options })
    .catch(() => null);
  if (!start || !start.ok) return null;

  // Outlook 这一版的列表不吃合成事件，必须用 chrome.debugger 发可信滚轮
  let attached = false;
  try {
    await api.debugger.attach({ tabId }, '1.3');
    attached = true;
  } catch (e) {
    attached = false;
  }

  try {
    if (attached) {
      let idle = 0;
      const deadline = Date.now() + (Number(options?.budgetMs) || 40000);
      while (Date.now() < deadline && idle < 4) {
        try {
          await api.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: start.center?.x ?? 400,
            y: start.center?.y ?? 400,
            deltaX: 0,
            deltaY: 700,
            modifiers: 0
          });
        } catch (e) {
          break;
        }

        await sleep(750);
        const step = await api.tabs.sendMessage(tabId, { type: 'bb:harvestStep' })
          .catch(() => null);
        if (!step || !step.ok) break;
        idle = (step.scannedAdded || 0) > 0 || step.added > 0 ? 0 : idle + 1;
        if (step.done) break;
      }
    }
  } finally {
    if (attached) {
      try { await api.debugger.detach({ tabId }); } catch (e) { /* 已断开 */ }
    }
  }

  return api.tabs.sendMessage(tabId, { type: 'bb:harvestEnd' }).catch(() => null);
}

function mergeItem(existing, incoming, now) {
  const merged = { ...(existing || {}), ...incoming };
  merged.id = incoming.id;
  merged.capturedAt = existing?.capturedAt || now;
  merged.lastSeen = now;
  merged.seenCount = (existing?.seenCount || 0) + 1;
  if (merged.money == null && existing?.money != null) merged.money = existing.money;
  if (merged.minutes == null && existing?.minutes != null) merged.minutes = existing.minutes;
  if (merged.hourly == null && existing?.hourly != null) merged.hourly = existing.hourly;
  return merged;
}

function prune(items, now) {
  const entries = Object.entries(items)
    .filter(([, it]) => it && now - (it.lastSeen || 0) < MAX_AGE_MS)
    .sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0))
    .slice(0, MAX_ITEMS);
  return Object.fromEntries(entries);
}

async function scanAllTabs(override) {
  const tabs = await findOutlookTabs();
  const store = await api.storage.local.get(['items', 'scanDays']);
  const items = store.items || {};
  const days = Math.max(1, Number(override?.days) || Number(store.scanDays) || 7);
  const options = { days, budgetMs: Number(override?.budgetMs) || 40000 };
  const now = Date.now();
  let added = 0;
  const debugs = [];
  const scanned = new Map();

  for (const tab of tabs) {
    const res = await scanTab(tab.id, options);
    if (!res || !res.ok) {
      debugs.push({ tabId: tab.id, url: tab.url, error: 'no-response' });
      continue;
    }
    debugs.push({ tabId: tab.id, url: tab.url, ...res.debug });
    for (const row of res.scanned || []) {
      if (!scanned.has(row.id)) scanned.set(row.id, row);
    }
    for (const item of res.items || []) {
      const existed = Object.prototype.hasOwnProperty.call(items, item.id);
      items[item.id] = mergeItem(existed ? items[item.id] : null, item, now);
      if (!existed) added += 1;
    }
  }

  const pruned = prune(items, now);
  await api.storage.local.set({
    items: pruned,
    lastScanAt: now,
    lastDebug: { at: now, tabs: debugs },
    lastScanned: Array.from(scanned.values()).slice(0, 400),
    lastScanTabs: tabs.length
  });

  // 图标角标：命中的悬赏条数。安静，不打扰。
  try {
    const hit = Object.keys(pruned).length;
    api.action.setBadgeBackgroundColor({ color: '#B4342A' });
    api.action.setBadgeText({ text: hit === 0 ? '' : hit > 9 ? '9+' : String(hit) });
  } catch (e) {
    // 角标失败不影响主流程
  }

  return { ok: true, tabs: tabs.length, added, total: Object.keys(pruned).length, debug: debugs, scanned: scanned.size };
}

// 打开邮件后读正文，把缺失的金额/耗时补全
async function enrichFromPane(tabId, id) {
  try {
    const info = await api.tabs.sendMessage(tabId, { type: 'bb:paneInfo' });
    if (!info || !info.ok) return;

    const store = await api.storage.local.get(['items']);
    const items = store.items || {};
    const target = items[id];
    if (!target) return;

    let changed = false;
    if (target.minutes == null && info.minutes != null) {
      target.minutes = info.minutes;
      changed = true;
    }
    if (target.money == null && info.money != null) {
      target.money = info.money;
      target.currency = info.currency;
      changed = true;
    }
    if (target.hourly == null) {
      if (info.hourly != null) {
        target.hourly = info.hourly;
        changed = true;
      } else if (target.money != null && target.minutes != null) {
        target.hourly = Math.round((target.money / (target.minutes / 60)) * 10) / 10;
        changed = true;
      }
    }
    if (changed) await api.storage.local.set({ items });
  } catch (e) {
    // 补全失败不影响打开
  }
}

async function openItem(id) {
  const store = await api.storage.local.get(['items']);
  const item = (store.items || {})[id] || {};
  const tabs = await findOutlookTabs();

  if (tabs.length === 0) {
    await api.tabs.create({ url: 'https://outlook.office.com/mail/inbox' });
    return { ok: false, reason: 'no-tab', message: '先打开 Outlook 收件箱，再点一次。' };
  }

  const tab = tabs.find((t) => t.active) || tabs[0];
  await api.tabs.update(tab.id, { active: true });
  await api.windows.update(tab.windowId, { focused: true });

  // 邮件可能在别的文件夹里，先切到扫描时记下的 folder
  try {
    const u = new URL(tab.url);
    const want = item.folder || '/mail/inbox';
    const cur = u.pathname.replace(/\/id\/.*$/, '');
    if (cur !== want) {
      await api.tabs.update(tab.id, { url: u.origin + want });
      await sleep(2500);
    }
  } catch (e) {
    // 拿不到 tab.url 时留在当前页
  }

  if (!(await ensureContent(tab.id))) {
    return { ok: false, message: '页面脚本没就绪，刷新一下 Outlook 再试。' };
  }

  let attached = false;
  try {
    await api.debugger.attach({ tabId: tab.id }, '1.3');
    attached = true;
  } catch (e) {
    attached = false;
  }

  try {
    // 先滚回顶部，再逐屏往下找那一行
    if (attached) {
      for (let i = 0; i < 6; i += 1) {
        await api.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', {
          type: 'mouseWheel', x: 400, y: 400, deltaX: 0, deltaY: -900, modifiers: 0
        }).catch(() => {});
        await sleep(120);
      }
      await sleep(500);
    }

    for (let i = 0; i < 30; i += 1) {
      const res = await api.tabs.sendMessage(tab.id, {
        type: 'bb:openById',
        id: item.id || id,
        subject: item.subject || ''
      }).catch(() => null);

      if (res && res.ok) {
        // 打开后顺手读一下正文，把缺的耗时/金额补进数据里
        await sleep(900);
        await enrichFromPane(tab.id, item.id || id);
        return { ok: true, via: 'click' };
      }
      if (!attached) break;

      await api.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: res?.center?.x ?? 400,
        y: res?.center?.y ?? 400,
        deltaX: 0,
        deltaY: 600,
        modifiers: 0
      }).catch(() => {});
      await sleep(650);
    }
  } finally {
    if (attached) {
      try { await api.debugger.detach({ tabId: tab.id }); } catch (e) { /* 已断开 */ }
    }
  }

  // 兜底：有直链就新开一个标签
  if (item.link) {
    await api.tabs.create({ url: item.link, active: true });
    return { ok: true, via: 'link' };
  }
  return { ok: false, message: '没找到这封邮件，可能不在当前文件夹里。' };
}

async function scanTabOpen(tabId, id) {
  try {
    return await api.tabs.sendMessage(tabId, { type: 'bb:open', id });
  } catch (e) {
    return null;
  }
}

async function runDiag() {
  const tabs = await findOutlookTabs();
  if (tabs.length === 0) {
    return { ok: false, reason: 'no-tab', message: '没有 Outlook 标签页。' };
  }
  const out = [];
  for (const tab of tabs) {
    try {
      const res = await api.tabs.sendMessage(tab.id, { type: 'bb:diag' });
      out.push(res?.diag || { tabId: tab.id, url: tab.url, error: 'empty' });
    } catch (e) {
      out.push({ tabId: tab.id, url: tab.url, error: 'no-response' });
    }
  }
  return { ok: true, diag: out };
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'bounty:diagNow') {
    runDiag().then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg?.type === 'bounty:scanNow') {
    scanAllTabs(msg.override)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg?.type === 'bounty:openItem') {
    openItem(msg.id).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});
