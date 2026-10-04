# 漫畫櫃（Manhuagui）

## 入口與識別

- 支援 `https://www.manhuagui.com/comic/<seriesID>/` 作品頁，以及 `/comic/<seriesID>/<chapterNumber>.html` 章節頁。
- 作品 ID 為原生數字字串，seriesKey 如 `manhuagui:49169`；chapterID 如 `comic/49169/910633.html`。
- 只有 HTTPS 主站章節頁會自動轉入閱讀器；作品頁保留在原站。`cs_open_native=1` 可返回原站閱讀器。

## Metadata 與章節順序

Metadata 由作品 HTML 解析，純字串 parser 在 reader 與 MV3 service worker 使用同一路徑。標題取自 `book-title` 的 h1，封面取自 `book-cover`，只收錄 `chapter-list` 區塊內、屬於當前作品的章節連結。

原站各分組保留其畫面順序，每組的 ul 分頁區塊反轉後串接，頁內維持由新到舊。不得按 opaque chapter ID 排序：部分舊卷後來重新上架，ID 順序不等於原站閱讀順序。章節標題優先使用 anchor title，不含圖片頁數。

原站會重複使用 `chapter-list-*` HTML ID，因此分組使用 h4 文字（例如 `单话`、`单行本`、`番外篇`）作為穩定 key。Metadata 提供完整平面 `chapterList` 及 `chapterGroups`；現有章節選單維持平面呈現。

當作品 HTML 只有 `__VIEWSTATE` 時，以 LZ Base64 解壓出章節 HTML；此格式對應原站 main script 的 audit placeholder 替換流程。未知或沒有可用章節的頁面會失敗，不寫入空快取。

## 圖片解析與 DNR

章節頁的 `SMH.imgData({...}).preInit()` 被 packer 包裹，字典透過原站自訂 `String.prototype.splic` 壓縮。擴充功能只解析字串、以本地 `lz-string` 解壓字典、替換 base 2–62 tokens，再對 JSON 資料使用 `JSON.parse`；不執行 packer、載入外站程式或修改 prototype。

解析必須驗證 bid/cid 與請求相符，檔案列表非空、數量等於 len、路徑與檔名有效，並包含 sl.e/sl.m 簽章。圖片 URL 使用 `https://i.hamreus.com` 加上原站 path/files 與簽章 query，保留原始 WebP 檔名。

Production/dev manifest 覆蓋主站、`cf.mhgui.com` 封面與 `i.hamreus.com` 圖片。DNR rule 7 僅對圖片 CDN 的 image/xmlhttprequest 設定 `Referer: https://www.manhuagui.com/`。實測未設定 Referer 回傳 403，設定後回傳 200；封面不需要此規則。

## 更新與失敗處理

- 每個分組各自記錄最新章節 checkpoint，偵測位於其前方的新章；提醒依平面章節列表順序排列。作品 latest 摘要仍使用首組的第一章。
- 第一次取得分組、分組新增或 checkpoint 不在列表時，只建立該組基準。Checkpoint 後方的補章只更新快取；分組重排不產生提醒。
- `latestChapterIDsByGroup` 是 IndexedDB series row 的本機可重建欄位，與章節快取一同更新。閱讀進度與 sync merge 保留它；備份匯入及新裝置首次輪詢重新建立基準，不更改 DB 或 dump 版本。
- Metadata 和章節請求使用 30 秒 timeout；背景輪詢仍受既有 15 秒總期限限制。Unsubscribe 會 abort request。
- 初始章節錯誤進入既有可重試失敗狀態，預載錯誤清除 gate，不提前推進 frontier；圖片沿用共用重試流程。
- Chrome Sync v2 追加站點代碼 3，既有 0–2 不變。接收含漫畫櫃作品的裝置需使用支援此 provider 的版本。

## 測試

離線 fixtures 擷取自 2026-10-04 的作品 49169、28004，依站點共用規範精簡並使用 `readSiteFixture("manhuagui", filename)` 讀取。每個章節 ul 保留首尾代表章節，保留所有分組、隱藏分頁、重複 HTML ID 與排序案例。Metadata fixtures 分別有 13、23 個章節；圖片 packer 完整保留，分別有 18、196 頁。來源與精簡範圍見 `src/sites/manhuagui/fixtures/README.md`；簽章僅為離線解析資料。

Focused tests：metadata、manhuagui parser/reader epics、background service、library integration 與 sync model。實機驗收重新抓取即時章節頁，確認 DNR、連續閱讀、跳章、追蹤與 popup 繼續閱讀。
