// 自动生成，勿直接改：源文件是 src/parser.js + src/content.core.js
// parser.js —— 纯函数：从一段邮件文字里抽出金额、耗时、时间、类型。
// 不依赖 DOM，方便单独测试（见 test/parser.test.mjs）。
// 作为经典脚本在内容脚本之前加载，挂在 globalThis.BountyParser 上。

(() => {
  const DAY = 864e5;

  // 货币：长写法（港幣 / HKD / 港币）优先于裸符号，避免把 港幣$100 认成美元
  const MONEY_RES = [
    { re: /(?:HK\$|HKD|港幣|港币)\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'HKD' },
    { re: /(?:NT\$|TWD|新台幣|新台币)\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'TWD' },
    { re: /(?:US\$|USD|美元|美金)\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'USD' },
    { re: /(?:RMB|CNY|人民幣|人民币)\s*¥?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'CNY' },
    { re: /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:港幣|港币|HKD)/gi, cur: 'HKD' },
    { re: /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:新台幣|新台币|TWD)/gi, cur: 'TWD' },
    { re: /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:美元|美金|USD)/gi, cur: 'USD' },
    { re: /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:元|块|塊|人民币|人民幣|CNY|RMB)/gi, cur: 'CNY' },
    { re: /(?<![A-Za-z])\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'USD' },
    { re: /(?:¥|￥)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'CNY' },
    { re: /€\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi, cur: 'EUR' }
  ];

  const TIME_RE = /([0-9]+(?:\.[0-9]+)?)\s*(?:[-~—到至]\s*([0-9]+(?:\.[0-9]+)?)\s*)?(分鐘|分钟|分(?![钟鐘])|小時|小时|個?鐘頭|个?钟头|hours?|hrs?|h(?![a-z])|minutes?|mins?)/gi;
  const PER_HOUR_RE = /每\s*(?:小)?[時时]|時薪|时薪|hourly|per\s*hour/i;

  const LOTTERY_RE = /抽奖|抽獎|赢取|贏取|赢得|贏得|有机会赢|有機會贏|win\s+an?\s|win\s+a\s|giveaway|raffle|sweepstake|lucky\s?draw|抽選/i;
  const VOUCHER_RE = /代金券|礼品卡|禮品卡|礼券|禮券|购物卡|購物卡|京东卡|京東卡|亚马逊卡|亞馬遜卡|gift\s?card|voucher|e-?gift|store\s?credit|積分|积分/i;
  const VAGUE_RE = /丰厚|豐厚|报酬|報酬|酬劳|酬勞|奖励|獎勵|有酬|感谢费|感謝費|礼金|禮金|compensat|incentive|honorarium|reimburse|津貼|津贴/i;

  // 列表行里没用的东西：国家码、头像首字母（1–2 个字）、已读标记、纯时间
  const NOISE_RE = /^([A-Z]{1,3}|[\u4e00-\u9fa5]{1,2}|.{0,2}|已读|已讀|未读|未讀|今天|昨天|前天|周[一二三四五六日]|週[一二三四五六日]|\d{1,2}:\d{2})$/;

  const WEEKDAY = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  const EN_WEEKDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  const toNumber = (s) => {
    const n = Number(String(s || '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const startOfDay = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  function parseWhen(text, now = new Date()) {
    const t = String(text || '').replace(/\s+/g, ' ');
    let m;

    if ((m = /(\d{4})[\/年.\-](\d{1,2})[\/月.\-](\d{1,2})/.exec(t))) {
      return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    }
    if ((m = /(?:^|[^\d])(\d{1,2})[\/月](\d{1,2})日?/.exec(t))) {
      const d = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
      if (d.getTime() > now.getTime() + DAY) d.setFullYear(d.getFullYear() - 1);
      return d.getTime();
    }
    if (/刚刚|剛才|刚才|just now/i.test(t)) return now.getTime();
    if ((m = /(\d+)\s*(?:分钟前|分鐘前|min(?:ute)?s?\s+ago)/i.exec(t))) {
      return now.getTime() - Number(m[1]) * 60000;
    }
    if ((m = /(\d+)\s*(?:小时前|小時前|hours?\s+ago)/i.exec(t))) {
      return now.getTime() - Number(m[1]) * 3600000;
    }
    if (/今天|today/i.test(t)) return startOfDay(now.getTime());
    if (/昨天|yesterday/i.test(t)) return startOfDay(now.getTime()) - DAY;
    if (/前天/i.test(t)) return startOfDay(now.getTime()) - 2 * DAY;

    if ((m = /(?:周|週|星期)([一二三四五六日天])/.exec(t))) {
      const target = WEEKDAY[m[1]];
      const d = new Date(now.getTime());
      const diff = (d.getDay() - target + 7) % 7;
      return startOfDay(d.getTime()) - diff * DAY;
    }
    if ((m = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/i.exec(t))) {
      const target = EN_WEEKDAY[m[1].slice(0, 3).toLowerCase()];
      const d = new Date(now.getTime());
      const diff = (d.getDay() - target + 7) % 7;
      return startOfDay(d.getTime()) - diff * DAY;
    }
    return null;
  }

  function pickMoney(text) {
    let best = null;
    for (const { re, cur } of MONEY_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const value = toNumber(m[1]);
        if (value == null || value <= 0) continue;
        if (!best || value > best.money) best = { money: value, currency: cur };
      }
    }
    return best;
  }

  function pickMinutes(text) {
    let best = null;
    TIME_RE.lastIndex = 0;
    let m;
    while ((m = TIME_RE.exec(text)) !== null) {
      const a = toNumber(m[1]);
      const b = m[2] ? toNumber(m[2]) : null;
      if (a == null) continue;
      const unit = m[3].toLowerCase();
      const isHour = /^(h|hour|hr)/.test(unit) || /[時时]|鐘頭|钟头/.test(unit);
      const value = (b != null ? (a + b) / 2 : a) * (isHour ? 60 : 1);
      if (!best || value > best) best = value;
    }
    return best;
  }

  function splitFields(raw) {
    const lines = String(raw || '')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !NOISE_RE.test(s));
    // 头像字母/单字通常是行首，跳过它们
    while (lines.length > 1 && lines[0].length <= 2) lines.shift();
    const sender = lines[0] || '';
    const subject = lines[1] || lines[0] || '';
    const snippet = lines.slice(2).join(' ');
    return { sender, subject, snippet, lines };
  }

  function classify(hay, money) {
    if (LOTTERY_RE.test(hay)) return 'lottery';
    if (VOUCHER_RE.test(hay)) return 'voucher';
    if (money != null) return 'cash';
    if (VAGUE_RE.test(hay)) return 'vague';
    return null;
  }

  globalThis.BountyParser = {
    DAY,
    MONEY_RES,
    TIME_RE,
    PER_HOUR_RE,
    LOTTERY_RE,
    VOUCHER_RE,
    VAGUE_RE,
    NOISE_RE,
    toNumber,
    startOfDay,
    parseWhen,
    pickMoney,
    pickMinutes,
    splitFields,
    classify
  };
})();

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
