## Bounty Board v0.4.0

Bilingual interface: English by default, 中文 switchable in the toolbar.

**What's new since v0.3.0**

- Every string in the board and popup moved into `en` / `zh` dictionaries; the language choice persists in `chrome.storage`
- Extension renamed from 悬赏令 Demo to **Bounty Board**, English description in the manifest
- README rewritten in English with a Chinese section at the end
- Fresh screenshots for both languages

**Install**

Download `bounty-board-0.4.0.zip`, unzip it anywhere, then:

1. `chrome://extensions` → turn on **Developer mode**
2. **Load unpacked** → pick the unzipped folder (the one containing `manifest.json`)
3. Sign in to Outlook on the web, open your inbox
4. Visit `chrome-extension://<extension-id>/board.html` → **Rescan**

**Requires** the `chrome.debugger` permission: this Outlook build renders a virtualized list that ignores synthetic events, so paging needs real wheel input. Chrome shows a debugging banner while a scan runs and the extension detaches afterwards.

**Known limits** — Chrome Web Store will not accept this permission set; load it unpacked. Only tested against `outlook.cloud.microsoft`. See `docs/owa-dom.md` for the measured DOM facts.
