# MYCOMIC fixtures

擷取日期：2026-10-05。資料由使用暫存設定檔的一般 Chrome 取得公開頁面的實際 HTTP 回應；未使用登入帳號。

| Fixture | 來源 URL | 涵蓋情境 |
| --- | --- | --- |
| `series-1759.html` | https://mycomic.com/comics/1759 | 獵人：單話 70、單行本 37、番外篇 5，共 112 章 |
| `series-31379.html` | https://mycomic.com/comics/31379 | 戰勇F5(Reload)：單話 125、番外篇 6，共 131 章 |
| `chapter-790421.html` | https://mycomic.com/chapters/790421 | 第410話，17 頁 |
| `chapter-15296.html` | https://mycomic.com/chapters/15296 | 第01卷，183 頁 |
| `chapter-818127.html` | https://mycomic.com/chapters/818127 | 第125話，8 頁 |
| `chapter-423621.html` | https://mycomic.com/chapters/423621 | 第01話，12 頁 |

## 精簡方式

- 擷取工具以 DOMParser 解析原始回應後序列化選取元素，未擷取 Alpine 執行後產生的章節連結，也未執行回應中的腳本。
- JSON-LD 保留 `@context`、`@type`、`itemListElement`、`name`、`url`、`image` 原始欄位值；省略介紹與其他無關欄位。
- 作品目錄保留完整 `x-data`（包含全章節 JSON、`decending` 及未執行的方法文字）與原站分組標題；移除排序按鈕、SVG 與重複的章節 template。
- 閱讀頁保留全部 `img.page` 的網址、尺寸、`x-ref`、lazy-loading 標記及最後一頁的 `reachedBottomCallback`。圖片清單未刪減。
- 移除廣告、推薦、樣式、無關腳本與 Livewire／CSRF／session 資料，不保存 cookie 或帳號資訊。
- 預期目錄順序、分組、頁數及首尾圖片網址在測試中明確列出。惡意 URL、驗證頁、缺頁、簡體標題與特殊字串等是註記過的加工／合成案例。
- 測試透過 `readSiteFixture` 共用 helper 讀取，不連網、不下載圖片、不執行 fixture 的 Alpine 方法。
