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
