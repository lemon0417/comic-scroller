# DM5 離線 fixtures

所有檔案由測試透過 `readSiteFixture("dm5", filename)` 讀為 UTF-8 字串。HTML／JavaScript 只作為 parser 輸入，不執行腳本、不載入圖片。

## 來源

2026-10-05（Asia/Taipei；擷取開始時間 `2026-10-04T16:06:52.925Z`）匿名擷取，沒有登入 cookie 或帳號資料。

| 檔案 | 來源 | 保留內容 |
| --- | --- | --- |
| `dianjuren.series.html` | https://www.dm5.com/manhua-dianjuren/ | 標題、封面、兩個單話與一個單行本章節 |
| `dianjuren.rss.xml` | https://www.dm5.com/rss-dianjuren/ | 原始順序的 m1768478、m1764103、m1300155 三個 item |
| `bailianchengshen.series.html` | https://www.dm5.com/manhua-bailianchengshen/ | 標題、封面、免費 m225202、含 detail-lock 的 m462489／m1659652；保留原站正序 |
| `bailianchengshen.rss.xml` | https://www.dm5.com/rss-bailianchengshen/ | 原始順序的 m1659652、m462489、m225202 三個 item |
| `m1768478.chapter.html` | https://www.dm5.com/m1768478/ | 作品連結、空 dm5_key、30 頁的 DM5 變數與 view signature |
| `m1768478.page-1.js` | https://www.dm5.com/m1768478/chapterfun.ashx | 第一頁完整 packer response；請求參數依同批章節 HTML 組合，key 保留空字串 |
| `m462489.chapter.html` | https://www.dm5.com/m462489/ | 作品連結、CID／MID、購買按鈕；原始回應沒有 DM5_IMAGE_COUNT |
| `m1753397.page-1.js` | 既有 `dm5.parse.test.ts` 的 PACKER_SAMPLE | 舊 pvalue packer schema；原始 URL 與擷取日期未記錄 |
| `m1794602.page-1.js` | 既有 `dm5.parse.test.ts` 的 EMPTY_CHAPTERFUN_KEY_PACKER_SAMPLE | response 提供圖片 key 的歷史格式；原始 URL 與擷取日期未記錄 |

兩份歷史樣本於 2026-10-05 從測試常數搬移，內容未修改；不將搬移日期視為擷取日期。

## 精簡方式與驗證

- 作品 HTML 經不執行 script 的 HTML parser 擷取原有 title／cover／li 元素，再置於最小容器；保留內部巢狀標記與 VIP lock，不保留廣告、推薦或整部章節清單。
- RSS 保留 channel title 與選定的原始 item；不改 item 順序、章節 ID 或標題。RSS 與作品 HTML 的順序差異是樣本特徵。
- 章節 HTML 保留原始 DM5 變數宣告、作品連結、隱藏 key 與付費按鈕；packer 字串完整保留。
- metadata 測試涵蓋 RSS、cover hydration、背景 RSS-only、HTML fallback，以及 DOM／無 DOM runtime。
- reader 測試涵蓋免費圖片解析、VIP placeholder、停止預載與不發送圖片請求；VIP 原站連結帶 `cs_open_native=1`。
- 簽章／圖片 key 為固定解析資料，過期不影響離線測試。更新樣本時同步更新明確預期輸出，不以 parser 自身產生預期值。
