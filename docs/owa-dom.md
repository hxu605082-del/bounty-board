# 这版 Outlook（outlook.cloud.microsoft）的实测事实

2026-11 在真实账号上验证。改采集逻辑前先读这一页，能省一天的试错。

## 列表结构

- 邮件行：`[role="listbox"] [role="group"]`
- **没有 `role="option"`，也没有行级 `data-convid`**
- id 在行的祖先上：`row.closest('[data-convid]')`
- 行文本顺序：`头像首字母 / 发件人 / 主题 / 预览 / 时间`，中间夹空行
- 列表一次只渲染约 9–11 行（虚拟列表）

## 深链

```
https://outlook.cloud.microsoft/mail/inbox/id/<encodeURIComponent(data-convid)>
```

实测：这样打开的就是那封邮件。注意 `data-convid` **就是** URL 里那段 id，
不是 conversation id 的另一种编码——两者恰好相同（都以 `AAQk` 开头）。

## 滚动（关键）

- 列表没有可 `scrollTop` 的容器：`scrollHeight === clientHeight`（约 619）
- 合成 `WheelEvent` / `KeyboardEvent` **被忽略**
- 只有可信输入有效：`chrome.debugger` + `Input.dispatchMouseEvent`（type: mouseWheel）
- 每滚一次加载约 8–10 行；连续 4 次没有新行即到底

## 页面左侧

`nav [role="treeitem"]` 是文件夹树，不要拿来当邮件行。

## 文件夹

- URL 形如 `/mail/<folder>`（inbox / sentitems / drafts / deleteditems / archive）
- 「重点 / 其他」是过滤器不是文件夹，URL 不变
- 邮件不在当前文件夹时，先切 URL 再找行

## 时间

- 今天/昨天显示「昨天」「周三 17:46」，更早显示「11/5」
- 时间是行内单独一行，用行首正则匹配，别整段匹配（正文里全是日期）

## 踩过的坑

1. 以为有 `role="option"` → 抓到 0 行
2. 以为 `data-convid` 在行上 → 拼出空 id
3. 用 `scrollTop` 翻页 → 一动不动
4. 用 `element.dispatchEvent(new WheelEvent(...))` → 被忽略
5. 用回收件箱的 tab 打开邮件 → 冲掉用户滚到的位置，改成新开 tab
6. `runtime.reload()` 之后页面上下文会失效，需要 1.5s 后再 `location.reload()`
