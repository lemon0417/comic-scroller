# 包子漫畫（Baozimh）

## 身分與資料來源

- Site key：`baozimh`；顯示名稱：包子漫畫。
- Series ID 為作品 slug，例如 `zhongjiedechitianshi-jiyingshe`。
- 作品連結維持 `https://www.baozimh.com/comic/<slug>`；作品與閱讀 HTML 固定從 `https://www.twmanga.com` 取得。原站的 `page_direct` 已觀察到轉址至這個閱讀站，其作品頁提供相同 SSR 格式。
- Chapter ID：`comic/chapter/<slug>/<section_slot>_<chapter_slot>.html`，slot 從 0 起算。原站分頁 `_2.html`、`_3.html` 等入口全部正規化成同一完整章節。
- 接受 baozimh／twmanga 的作品網址、章節網址及 `user/page_direct?comic_id=...&section_slot=...&chapter_slot=...`。章節入口會自動開啟 extension reader；`cs_open_native=1` 保留原站瀏覽。

## Metadata

使用無 DOM 字串 parser，從 `og:novel:book_name`、`og:url` 與 `og:image` 讀取標題、作品身分、封面。封面限定 `static-tw.baozimh.com/cover/<slug>.jpg`。

只讀完整目錄 `chapter-items` 與其後的隱藏目錄 `chapters_other_list`，忽略最新章節重複區塊、推薦、廣告與腳本。依 `section_slot` 分組，group ID 固定為 `section:<slot>`；保留網站分組順序，各組將原站由舊到新的順序反轉。相同章節去重，缺少已宣告的最新章節時拒絕不完整快照。

背景檢查沿用 `fetchMeta({ includeCover: false })`，只投影章節／分組快照，不覆寫標題、封面、作品連結或閱讀進度。

## Reader 與失敗行為

只擷取 `amp-img` 的 `chapter-img-N-M` 圖片，以 `data-src`（存在時）或 `src` 取得已解析網址。圖片限定 HTTPS 的 `s<number>.bzcdn.net/scomic/<slug>/...`；不下載或執行外站腳本。

從第一頁開始，依標題分頁資訊與「下一頁」連結循序讀取同作品、同章節的下一頁。分頁間有重複圖片，合併時依完整 URL 去重並保留第一次出現的順序；「下一話」不屬於本次取得。分頁必須連續且總頁數一致，最多 100 頁。

全部分頁成功後才交給共用 reader flow。單頁失敗、缺頁、空圖片、格式不明、驗證頁或分頁不連續都會令整章失敗，不保存部分結果。初始失敗顯示既有重試狀態，預載失敗解除 pending gate 且不推進 frontier。

Metadata 與完整章節各有 30 秒逾時；背景仍使用既有背景逾時。所有請求支援 unsubscribe abort，請求禁止 HTTP 轉址，避免被引導到未支援的來源。遇到 HTTP 403 或瀏覽器驗證頁時走失敗／重試，不執行驗證程式或立即重送。

## 權限與持久化

Production／development manifest 同步涵蓋 `www.baozimh.com`、`www.twmanga.com`、`static-tw.baozimh.com` 與 `*.bzcdn.net`。已觀察圖片／封面可直接取得，不新增 Referer／Cookie DNR 規則、cookies permission 或 content script。

沿用 IndexedDB、dump 與同步格式。Sync v2 使用新增代碼 `5: baozimh`，不重用停用代碼 1／2，不改動其他站點代碼。

## 測試資料

`src/sites/baozimh/fixtures/README.md` 記錄實際來源及精簡策略。離線測試涵蓋兩個作品目錄、二頁與三頁章節、分頁間重複圖片、取消／逾時、原站轉址、分組 checkpoint、書庫備份與同步往返。
