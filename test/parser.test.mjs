import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'src', 'parser.js'), 'utf8');
new Function(src)();
const P = globalThis.BountyParser;

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed += 1;
    console.log('  ok   ' + label);
  } else {
    failed += 1;
    console.log('  FAIL ' + label + '\n       got ' + a + '\n       exp ' + b);
  }
}

// 真实邮件（香港研究招募）当基准
const HK_EMAIL = [
  '招募香港學童參與特殊學習障礙研究',
  '*詳情請參閱項目手冊* 實驗及評估內容：',
  '1.行為與認知測評實驗：分3-4節，共約6小時',
  '2.腦成像掃描（fMRI）實驗：分2節，共約3小時',
  '計劃亮點：1.參與實驗，每小時可獲港幣$100交通津貼'
].join('\n');

console.log('\n[真实邮件]');
eq('金额', P.pickMoney(HK_EMAIL), { money: 100, currency: 'HKD' });
eq('时长（分钟）', P.pickMinutes(HK_EMAIL), 360);
eq('“每小時”写法', P.PER_HOUR_RE.test(HK_EMAIL), true);
eq('分类', P.classify(HK_EMAIL, 100), 'cash');

console.log('\n[金额]');
eq('美元符号', P.pickMoney('You get $50 for this study'), { money: 50, currency: 'USD' });
eq('区间取上限', P.pickMoney('报酬 50-100 美元'), { money: 100, currency: 'USD' });
eq('人民币', P.pickMoney('完成可得 80 元'), { money: 80, currency: 'CNY' });
eq('港币长写法', P.pickMoney('HKD 200 per session'), { money: 200, currency: 'HKD' });
eq('无金额', P.pickMoney('报酬丰厚，欢迎参加'), null);

console.log('\n[时长]');
eq('中英混写区间', P.pickMinutes('30-45 分钟'), 37.5);
eq('英文小时', P.pickMinutes('2 hours'), 120);
eq('英文分钟', P.pickMinutes('45 mins'), 45);
eq('繁体小时', P.pickMinutes('共約3小時'), 180);
eq('无时长', P.pickMinutes('每小時可獲港幣$100'), null);

console.log('\n[分类]');
eq('抽奖优先于现金', P.classify('Win an iPad - Take the User Survey', null), 'lottery');
eq('抽奖带金额仍是抽奖', P.classify('赢取 500 元购物卡', 500), 'lottery');
eq('代金券', P.classify('完成后赠送 100 元京东卡', 100), 'voucher');
eq('现金', P.classify('报酬 100 元', 100), 'cash');
eq('模糊奖励', P.classify('报酬丰厚，欢迎参加', null), 'vague');
eq('都不是', P.classify('本周校园新闻', null), null);

console.log('\n[时间解析]');
const now = new Date(2026, 10, 18, 20, 0, 0);
const d = (ts) => (ts == null ? null : new Date(ts).toDateString());
eq('昨天', d(P.parseWhen('昨天', now)), new Date(2026, 10, 17).toDateString());
eq('前天', d(P.parseWhen('前天', now)), new Date(2026, 10, 16).toDateString());
eq('周二', d(P.parseWhen('周二 15:49', now)), new Date(2026, 10, 17).toDateString());
eq('11/5', d(P.parseWhen('11/5', now)), new Date(2026, 10, 5).toDateString());
eq('完整日期', d(P.parseWhen('2026/11/05', now)), new Date(2026, 10, 5).toDateString());
eq('认不出返回 null', P.parseWhen('随便一段文字', now), null);

console.log('\n[字段拆分]');
const f = P.splitFields('CN\nCUS Notice\nWin an iPad - Take the User Survey\n周二 15:49');
eq('跳过国家码后的发件人', f.sender, 'CUS Notice');
eq('主题', f.subject, 'Win an iPad - Take the User Survey');

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed === 0 ? 0 : 1);
