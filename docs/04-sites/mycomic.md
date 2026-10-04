# MYCOMIC（我的漫畫）

## 身分與來源

- Site key：`mycomic`；顯示名稱：`MYCOMIC`。
- Series ID 為原站數字字串，例如 `1759`；Chapter ID 為 `chapters/<id>`，例如 `chapters/790421`。
- 接受 `https://mycomic.com/comics/<id>`、`https://mycomic.com/chapters/<id>` 與簡體 `/cn/` 路徑，持久化及請求使用無語言前綴的繁體網址。
- 作品頁保留原站瀏覽；章節入口自動開啟 extension reader。`cs_open_native=1` 保留原站閱讀及驗證。

## Metadata 與分組

無 DOM parser 從 `application/ld+json` 的 `ComicSeries` 讀取 `name`、`url`、`image`，驗證作品身分。封面限定 HTTPS 的 `biccam.com/comics/<seriesID>-...`。

目錄完整存在於各組的 `x-data`；HTML 中的章節連結是 Alpine template，不能用全頁 anchor 清單代替目錄。Parser 只抽出 `chapters` JSON 陣列，不執行 `toggleSorting` 等方法，支援 JSON 引號、跳脫字元及 HTML entities。依 `decending` 將每組統一為新到舊，不以章節 ID 的數字大小重新排序。

`單話／单话`、`單行本／单行本`、`番外篇` 對應穩定 group ID `single`、`volume`、`extra`，保留原站分組順序並略過空組。未知分組、重複章節／分組、空目錄、無法辨識或不完整資料均拒絕產生快照。

背景檢查沿用 `fetchMeta({ includeCover: false })`，只投影完整目錄及分組，不覆寫既有標題、封面、作品網址或閱讀進度。

## Reader 與 HTTP

`ComicIssue` JSON-LD 的作品／章節麵包屑及 `url` 必須對應同一章節；不從隨機作品或推薦連結猜測作品 ID。圖片只讀 `img.page`，要求 `x-ref="page-N"` 依序完整、最後一頁保留 `x-intersect.once="reachedBottomCallback"`；使用 `data-src` 或 `src`，限定 HTTPS 的 `biccam.com/chapters/<chapterID>/...`。

完整圖片清單在單一閱讀 HTML 中，無須分頁 API 或執行外站腳本。整章通過驗證後交給共用 reader flow；metadata 失敗時已載入的圖片仍可閱讀。章節失敗會回到共用失敗畫面；預載失敗解除 pending gate 且不推進 frontier。

HTML 請求使用 `credentials: "include"`、`redirect: "error"` 及以下已驗證的 `Accept`：

```text
text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
```

Reader 與 metadata 各有 30 秒 timeout，unsubscribe 中止未完成的 HTTP；背景保留既有 15 秒 timeout。HTTP 403、Cloudflare 驗證頁或格式錯誤皆走失敗流程，不立即自動重送。正常導覽與 fetch 的驗證結果可能不同，即使已有標頭也可能被原站阻擋。

所有 provider 共用「重試／開啟原站」操作，首次章節請求失敗也會記錄站點身分，讓原站按鈕在 metadata 尚未載入時可用。原站連結由 adapter 建構並統一加入 `cs_open_native=1`，避免再次導回閱讀器。需要驗證時先在原站完成，再回 extension 手動重試；不保存或複製驗證 cookie。原站可正常開啟仍不保證 extension fetch 成功，手動重試也可能持續收到 403。

## 權限與持久化

Production／dev manifest 增加 `mycomic.com` 與 `biccam.com`。DNR rule 9 限定 `biccam.com` 的 image／XMLHttpRequest，設定 `Referer: https://mycomic.com/`，讓章節圖片及封面可載入。未增加 cookies permission、content script 或其他執行能力。

沿用 IndexedDB、dump 與 sync 格式。Sync v2 追加 `6: mycomic`，不重用停用代碼 1／2，不需要資料遷移。

## 測試

`src/sites/mycomic/fixtures/README.md` 記錄真實來源及精簡方式。離線測試涵蓋完整 112／131 章目錄、17／183／8／12 頁圖片、標頭、取消／逾時、驗證失敗、原站連結、分組更新、書庫備份與同步往返；正式 runtime 不讀取 fixtures。

Chrome 驗收以六份擷取 HTML 提供目錄／章節回應，圖片仍連線實際 CDN；已驗證四章閱讀、繁簡入口導轉、章節列表切換、兩部作品追蹤及 IndexedDB 分組 checkpoint。直接連線原站另確認首次失敗操作與原站 bypass，並成功載入一章 8 頁圖片；因章節及 metadata fetch 間歇回傳 Cloudflare 403，完整實站追蹤／切章流程尚未驗收通過。
