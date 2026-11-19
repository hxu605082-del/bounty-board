---
name: bounty-board
description: 维护「悬赏令」Outlook 采集扩展（从 Outlook 网页里收集给钱/给券的招募，排成按星级排序的清单）。当用户提到悬赏令、抓 Outlook 邮件、扩展不生效/版本对不上、Outlook 改版后抓不到时使用。
---

# 悬赏令扩展

仓库根目录就是这个扩展的源码。所有命令在仓库根目录执行。

## 装一次

1. `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `extension/`
2. 登录 Outlook 网页版，打开 `chrome-extension://<ID>/board.html`
3. 点「重新抓取」

## 改完代码

```
node tools/build.mjs        # src/ → extension/content.js + dist/firefox
node test/parser.test.mjs   # 29 项解析测试
```

然后**重载扩展**（`chrome://extensions` → ⟳）。Chrome 不会自动重读未打包扩展；
只改 `board.*` 的话刷新页面即可。

## 排障

| 现象 | 先看 | 处理 |
|---|---|---|
| 一直 0 条 | 调试信息里 `rowCount` | 选择器过时 → `docs/owa-dom.md` |
| 版本对不上 | 顶部「扩展 vX」vs `extension/manifest.json` | 重载扩展；必要时移除后重装 |
| 扫不到历史 | `scrolls` 很小 | `chrome.debugger` 被拦，或滚轮没打到列表上 |
| 点「打开」没反应 | 返回 `no-tab` / `not-found` | 确认 Outlook 标签页开着、邮件在当前文件夹 |
| 时薪空着 | 行里没耗时 | 点开一次，正文补全会写回 |

## 硬约束

- Chrome 136+ 禁止默认配置开调试端口，外部无法驱动浏览器；自动化必须发生在扩展内部
- 虚拟列表只认真实输入：必须 `chrome.debugger` + `Input.dispatchMouseEvent`
- 行 id 在祖先的 `data-convid` 上，深链 `…/mail/inbox/id/<encodeURIComponent(convid)>`
- 细节与踩坑记录：`docs/owa-dom.md`
