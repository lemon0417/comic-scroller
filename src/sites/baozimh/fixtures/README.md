# Baozimh fixtures

擷取日期：2026-10-05。資料來自公開 twmanga SSR 頁面，不含登入 cookie、驗證票證或帳號資料。

## 作品來源

- `series-zhongjiedechitianshi-jiyingshe.html`：https://www.twmanga.com/comic/zhongjiedechitianshi-jiyingshe
- `series-yongfenshenzidongshouxi-mongseekmrchaopal.html`：https://www.twmanga.com/comic/yongfenshenzidongshouxi-mongseekmrchaopal

保留實際 metadata、作品標題、最新章節的前兩筆，以及 `chapter-items`／`chapters_other_list` 各自前兩筆與最後兩筆。保留 anchor 內實際 div／span 巢狀結構、HTML entities 與 hidden 屬性；移除其餘章節、外層排版、推薦、廣告及腳本。

精簡目錄明確預期由新到舊：

- 終結的熾天使：section 0 的 slot `[158, 157, 25, 24, 23, 22, 1, 0]`。
- 用分身自動狩獵：section 0 的 slot `[175, 174, 25, 24, 23, 22, 1, 0]`。

## 章節來源

- `chapter-zhongjiedechitianshi-jiyingshe-0_0.html`：https://www.twmanga.com/comic/chapter/zhongjiedechitianshi-jiyingshe/0_0.html
- `chapter-zhongjiedechitianshi-jiyingshe-0_0_2.html`：https://www.twmanga.com/comic/chapter/zhongjiedechitianshi-jiyingshe/0_0_2.html
- `chapter-yongfenshenzidongshouxi-mongseekmrchaopal-0_175.html`：https://www.twmanga.com/comic/chapter/yongfenshenzidongshouxi-mongseekmrchaopal/0_175.html
- `chapter-yongfenshenzidongshouxi-mongseekmrchaopal-0_175_2.html`：https://www.twmanga.com/comic/chapter/yongfenshenzidongshouxi-mongseekmrchaopal/0_175_2.html
- `chapter-yongfenshenzidongshouxi-mongseekmrchaopal-0_175_3.html`：https://www.twmanga.com/comic/chapter/yongfenshenzidongshouxi-mongseekmrchaopal/0_175_3.html
- `chapter-yongfenshenzidongshouxi-mongseekmrchaopal-0_0.html`：https://www.twmanga.com/comic/chapter/yongfenshenzidongshouxi-mongseekmrchaopal/0_0.html

保留 title、目錄及前後頁／章節導航，以及每張完整 `amp-img`（含 noscript fallback）。合併成最小 HTML 外框，移除廣告、推薦、追蹤和所有腳本；不改寫圖片網址或分頁內容。

固定預期：終結的熾天使第 1 話第一頁 1–50、第二頁 47–80，共 80 張；用分身自動狩獵第 176 話三頁分別 1–50、47–100、97–131，共 131 張；第 1 話單頁共 40 張。測試明確建立這些預期，不使用受測 parser 產生答案。

第二 section、惡意網址、缺頁、重複目錄及腳本干擾等人工加工情境在測試內註明為合成資料。HTTP 一律 mock，測試不下載圖片或執行任何 fixture 腳本；runtime 不得 import fixtures。
