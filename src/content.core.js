// content.js —— 在 Outlook 网页里滚动采集邮件行；解析逻辑在 parser.js。
(() => {
  const VERSION = 13;
  if (window.__bountyVer === VERSION) return;
  window.__bountyVer = VERSION;

  const api = globalThis.browser ?? globalThis.chrome;
  const P = globalThis.BountyParser;
  if (!P) return; // parser.js 没加载就先别动

  const DAY = P.DAY;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function findRows() {
    const selectors = [
      '[role="listbox"] [role="option"]',
      '[role="option"][data-convid]',
      '[data-convid]',
      '[role="listbox"] [role="group"]',
      '[role="option"]'
    ];
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel))
        .filter((n) => n.getClientRects().length > 0);
      if (nodes.length >= 2) return nodes;
    }
    return [];
  }

  function findScrollContainer(fromEl) {
    let node = fromEl;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const scrollable = /(auto|scroll)/.test(style.overflowY);
      if (scrollable && node.scrollHeight > node.clientHeight + 40) return node;
      node = node.parentElement;
    }
    return null;
  }

  const WHEN_LINE_RE = /^(?:周[一二三四五六日天]|週[一二三四五六日天]|星期[一二三四五六日天]|今天|昨天|前天|刚刚|剛才|\d{1,2}[\/月]\d{1,2}|\d{4}[\/年]|[A-Z][a-z]{2}\s+\d{1,2}|\d{1,2}:\d{2})/;

  // 尽量构造出「直接打开这封邮件」的链接，而不是只把用户丢回收件箱
  function rowLink(el, convid) {
    const anchor = el.querySelector('a[href*="/mail/"]');
    if (anchor && anchor.href) return anchor.href;
    if (convid) return location.origin + '/mail/inbox/id/' + encodeURIComponent(convid);
    const fallbackId = el.id || el.getAttribute('data-item-id') || '';
    if (fallbackId && fallbackId.length > 16) {
      return location.origin + '/mail/inbox/id/' + encodeURIComponent(fallbackId);
    }
    return null;
  }

  function parseRow(el) {
    const convid =
      el.getAttribute('data-convid') ||
      el.closest?.('[data-convid]')?.getAttribute('data-convid') ||
      el.querySelector('[data-convid]')?.getAttribute('data-convid') ||
      '';
    const aria = el.getAttribute('aria-label') || '';
    const raw = (el.innerText || el.textContent || '').trim();
    if (!raw && !aria) return null;

    const { sender, subject, snippet, lines } = P.splitFields(raw);
    const hay = [subject, snippet, aria, raw].filter(Boolean).join(' \n ');

    const moneyHit = P.pickMoney(hay);
    const kind = P.classify(hay, moneyHit ? moneyHit.money : null);

    const minutes = P.pickMinutes(hay);
    const money = moneyHit ? moneyHit.money : null;
    const isRate = P.PER_HOUR_RE.test(hay);
    let hourly = null;
    if (money != null) {
      if (isRate) hourly = money;
      else if (minutes) hourly = Math.round((money / (minutes / 60)) * 10) / 10;
    }

    const whenLine = lines.find((l) => WHEN_LINE_RE.test(l)) || '';
    const when = whenLine ? P.parseWhen(whenLine, new Date()) : null;
    const id = convid || 'h:' + hash(subject + '|' + sender + '|' + (when || ''));

    return {
      id,
      kind,
      matched: !!kind,
      subject: (subject || '(无主题)').slice(0, 160),
      sender: sender.slice(0, 80),
      snippet: snippet.slice(0, 240),
      money,
      currency: moneyHit ? moneyHit.currency : null,
      minutes,
      hourly,
      rateFromText: isRate && money != null,
      when,
      link: rowLink(el, convid),
      folder: currentFolder()
    };
  }

  async function harvest(options) {
    const days = Math.max(1, Number(options?.days) || 7);
    const budget = Math.max(5000, Number(options?.budgetMs) || 35000);
    const now = Date.now();
    const cutoff = P.startOfDay(now) - (days - 1) * DAY;
    const deadline = now + budget;

    const firstRows = findRows();
    if (firstRows.length === 0) {
      return {
        ok: true,
        items: [],
        scanned: [],
        debug: { v: VERSION, rowCount: 0, matched: 0, note: '没找到任何邮件行' }
      };
    }

    const container = findScrollContainer(firstRows[0]);
    const startTop = container ? container.scrollTop : window.scrollY;
    const pageSize = container ? container.clientHeight : window.innerHeight;

    const items = new Map();
    const scanned = new Map();
    let scrolls = 0;
    let stagnant = 0;
    let reachedCutoff = false;
    let rowsSeen = 0;

    const collect = () => {
      let added = 0;
      const rows = findRows();
      rowsSeen = Math.max(rowsSeen, rows.length);
      for (const row of rows) {
        const item = parseRow(row);
        if (!item) continue;
        if (item.when != null && item.when < cutoff) {
          reachedCutoff = true;
          continue;
        }
        if (!scanned.has(item.id)) {
          scanned.set(item.id, {
            id: item.id,
            subject: item.subject,
            sender: item.sender,
            when: item.when,
            kind: item.kind,
            matched: item.matched,
            money: item.money,
            currency: item.currency,
            minutes: item.minutes,
            link: item.link
          });
        }
        if (item.matched && !items.has(item.id)) {
          items.set(item.id, item);
          added += 1;
        }
      }
      return added;
    };

    collect();

    while (Date.now() < deadline && scrolls < 80) {
      if (reachedCutoff && items.size > 0 && stagnant >= 1) break;

      const step = Math.max(200, Math.floor(pageSize * 0.85));
      if (container) {
        container.scrollTop += step;
      } else {
        // 这版 Outlook 的列表没有滚动容器，靠键盘翻页
        const rows = findRows();
        const last = rows[rows.length - 1];
        if (last) {
          last.focus?.();
          for (const type of ['keydown', 'keyup']) {
            last.dispatchEvent(new KeyboardEvent(type, {
              key: 'PageDown', code: 'PageDown', keyCode: 34, which: 34, bubbles: true
            }));
          }
        }
      }

      await sleep(520 + Math.random() * 220);
      const added = collect();
      scrolls += 1;

      if (added === 0) {
        stagnant += 1;
        if (stagnant >= 4) break;
      } else {
        stagnant = 0;
      }
    }

    if (container) container.scrollTop = startTop;
    else window.scrollTo(0, startTop);

    const list = Array.from(items.values()).sort((a, b) => (b.when ?? 0) - (a.when ?? 0));

    return {
      ok: true,
      items: list,
      scanned: Array.from(scanned.values()).sort((a, b) => (b.when ?? 0) - (a.when ?? 0)),
      debug: {
        v: VERSION,
        days,
        rowCount: rowsSeen,
        matched: list.length,
        scannedCount: scanned.size,
        scrolls,
        reachedCutoff,
        cutoff: new Date(cutoff).toISOString(),
        url: location.href
      }
    };
  }

  // ---- 分段采集：background 用可信滚轮推进，内容脚本只负责收集 ----
  let H = null;

  function listCenter() {
    const lb = document.querySelector('[role="listbox"]');
    const r = (lb || document.body).getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }

  function collectInto(H) {
    let added = 0;
    const rows = findRows();
    H.rowsSeen = Math.max(H.rowsSeen, rows.length);
    for (const row of rows) {
      const item = parseRow(row);
      if (!item) continue;
      if (item.when != null && item.when < H.cutoff) {
        H.reachedCutoff = true;
        continue;
      }
      if (!H.scanned.has(item.id)) {
        H.scanned.set(item.id, {
          id: item.id, subject: item.subject, sender: item.sender, when: item.when,
          kind: item.kind, matched: item.matched, money: item.money,
          currency: item.currency, minutes: item.minutes, link: item.link,
          folder: item.folder
        });
      }
      if (item.matched && !H.items.has(item.id)) {
        H.items.set(item.id, item);
        added += 1;
      }
    }
    return added;
  }

  function beginHarvest(options) {
    const days = Math.max(1, Number(options?.days) || 7);
    const now = Date.now();
    H = {
      cutoff: P.startOfDay(now) - (days - 1) * DAY,
      days,
      deadline: now + (Number(options?.budgetMs) || 40000),
      items: new Map(),
      scanned: new Map(),
      rowsSeen: 0,
      reachedCutoff: false,
      steps: 0
    };
    const added = collectInto(H);
    return { ok: true, added, rows: H.rowsSeen, center: listCenter() };
  }

  function stepHarvest() {
    if (!H) return { ok: false, error: 'not-started' };
    H.steps += 1;
    const before = H.scanned.size;
    const added = collectInto(H);
    const scannedAdded = H.scanned.size - before;
    const done = H.reachedCutoff || Date.now() > H.deadline;
    return {
      ok: true,
      added,
      scannedAdded,
      rows: H.rowsSeen,
      done,
      steps: H.steps,
      center: listCenter()
    };
  }

  function endHarvest() {
    if (!H) return { ok: false, error: 'not-started' };
    const list = Array.from(H.items.values()).sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
    const scanned = Array.from(H.scanned.values()).sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
    const debug = {
      v: VERSION,
      days: H.days,
      rowCount: H.rowsSeen,
      matched: list.length,
      scannedCount: scanned.size,
      scrolls: H.steps,
      reachedCutoff: H.reachedCutoff,
      cutoff: new Date(H.cutoff).toISOString(),
      url: location.href
    };
    H = null;
    return { ok: true, items: list, scanned, debug };
  }

  function currentFolder() {
    const m = String(location.pathname || '').match(/^\/mail\/[^/]+/);
    return m ? m[0] : '/mail/inbox';
  }

  function paneInfo() {
    // 阅读窗里的文字（列表 + 正文都在页面里，正文里的"约30分钟"才算数）
    const text = (document.body.innerText || '').slice(0, 5000);
    const moneyHit = P.pickMoney(text);
    const minutes = P.pickMinutes(text);
    const money = moneyHit ? moneyHit.money : null;
    const isRate = P.PER_HOUR_RE.test(text);
    let hourly = null;
    if (money != null) {
      if (isRate) hourly = money;
      else if (minutes) hourly = Math.round((money / (minutes / 60)) * 10) / 10;
    }
    return { ok: true, minutes, money, currency: moneyHit ? moneyHit.currency : null, hourly };
  }

  function convidOf(row) {
    return row.getAttribute('data-convid') ||
      row.closest?.('[data-convid]')?.getAttribute('data-convid') || '';
  }

  // 在当前列表里找那一行（先按 id，再按标题），找到就点开
  function openById(payload) {
    const rows = findRows();
    const needle = String(payload?.subject || '').slice(0, 20);
    let target = null;

    for (const row of rows) {
      if (payload?.id && convidOf(row) === payload.id) { target = row; break; }
    }
    if (!target && needle) {
      for (const row of rows) {
        if ((row.innerText || '').includes(needle)) { target = row; break; }
      }
    }
    if (!target) {
      return { ok: false, rows: rows.length, center: listCenter() };
    }
    target.scrollIntoView({ block: 'center' });
    target.click();
    return { ok: true, center: listCenter() };
  }

  function diag() {
    const probes = ['[data-convid]', '[role="option"]', '[role="listbox"] [role="option"]', '[role="row"]', '[role="listitem"]'];
    const counts = {};
    for (const sel of probes) counts[sel] = document.querySelectorAll(sel).length;

    const rows = findRows();
    const container = rows.length ? findScrollContainer(rows[0]) : null;

    const hits = Array.from(document.querySelectorAll('a[href*="/mail/"]')).slice(0, 5).map((a) => a.href.slice(0, 120));
    return {
      v: VERSION,
      parser: !!P,
      url: location.href,
      counts,
      mailAnchors: hits,
      container: container
        ? { tag: container.tagName, scrollHeight: container.scrollHeight, clientHeight: container.clientHeight }
        : null,
      samples: rows.slice(0, 5).map((row) => ({
        aria: (row.getAttribute('aria-label') || '').slice(0, 140),
        text: (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140)
      }))
    };
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'bb:ping') {
      sendResponse({ ok: true, v: VERSION, parser: !!P });
      return false;
    }
    if (msg?.type === 'bb:diag') {
      sendResponse({ ok: true, diag: diag() });
      return false;
    }
    if (msg?.type === 'bb:openById') {
      sendResponse(openById(msg));
      return false;
    }
    if (msg?.type === 'bb:paneInfo') {
      sendResponse(paneInfo());
      return false;
    }
    if (msg?.type === 'bb:harvestStart') {
      sendResponse(beginHarvest(msg.options));
      return false;
    }
    if (msg?.type === 'bb:harvestStep') {
      sendResponse(stepHarvest());
      return false;
    }
    if (msg?.type === 'bb:harvestEnd') {
      sendResponse(endHarvest());
      return false;
    }
    if (msg?.type === 'bb:scan') {
      harvest(msg.options || {})
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    if (msg?.type === 'bb:open') {
      const el = document.querySelector('[data-convid="' + CSS.escape(msg.id) + '"]');
      if (!el) {
        sendResponse({ ok: false, reason: 'not-found' });
        return false;
      }
      el.scrollIntoView({ block: 'center' });
      el.click();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
})();
