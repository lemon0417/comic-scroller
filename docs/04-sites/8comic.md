# 8comic / 無限動漫

## 入口與識別

- 作品 URL：`https://www.8comic.com/html/<seriesID>.html`；seriesKey 如 `8comic:105`，使用原生數字 ID。
- 支援公開閱讀入口 `https://articles.onemoreplace.tw/online/new-<seriesID>.html?ch=<chapter>`，包含原站公開試看內容。CKVP 會員 `/view/` 不在支援範圍。
- chapterID 如 `online/new-105.html?ch=420`；保留小寫分篇字母，例如 `400a`。原站頁碼後綴 `704-2` 正規化成 `704`。
- 只有白名單公開閱讀頁自動轉入擴充功能。作品頁與會員頁留在原站，`cs_open_native=1` 可開啟原站閱讀器。

## Metadata 與分組

純字串 parser 使用 id/name/pic meta 驗證作品身分與取得標題／封面；只收錄 chapters 容器內、同作品的 cview anchor，排除動漫、推薦與腳本內容。

Ch 對應 `single`（話），Vol 對應 `volume`（卷）。話排在卷前，每組反轉成由新到舊；分組提供給既有背景 checkpoint 流程，章節選單維持平面列表。重複 chapterID 只收錄一次，未知或空列表回傳錯誤。

## 圖片解析與網路

公開章節頁內包含 47 字元一筆的編碼圖片表。欄位順序與變數名稱均會改變；parser 從章節比較、ps 指派及圖片 URL 組合辨識 chapter/pages/part/server/seed，再驗證欄位覆蓋、stride 與記錄數。

僅接受已觀察到的數字綁定與加減表達式，使用本地 base52 與 seed substring 演算法產生 JPG URL。不使用 eval、Function、原站解碼器或 remote hosted code。表尾的六個 hex 片段必須符合已知 host／副檔名。

圖片限制為 HTTPS `img1`–`img9.8comic.com`，驗證作品 ID、章節 ID、分篇、頁數、seed 與表長度；找不到請求章節時報錯，不採用原站迴圈最後一筆資料。未指定分篇時沿用原站第一個匹配記錄的分篇。

Production/dev manifest 覆蓋 HTTPS `*.8comic.com` 與 `articles.onemoreplace.tw`。DNR rule 8 只對公開 `/online/new-<id>.html` 的 main_frame/xmlhttprequest 設定 `Referer: https://www.8comic.com/`，同時支援 fetch 與原站 bypass。公開頁缺少 Referer 可能被轉到其他首頁；圖片實測無 Referer 也可回傳 200，因此沒有圖片 header 規則。

Metadata／章節請求 timeout 為 30 秒，unsubscribe 會 abort；背景輪詢仍受共用 15 秒期限限制。初始失敗、預載 gate、圖片重試沿用共用 reader flow。閱讀器標題連結使用解析得到的實際作品 URL。

## 舊資料與同步

ComicBus provider、reader、註冊、跳轉及 HTTP 權限已移除，不做資料遷移。啟動時由既有 supportedSiteKeys 清理機制移除 ComicBus 的作品、章節快取、已讀、訂閱、歷史與提醒。Legacy storage、snapshot、dump 與 sync 匯入同樣略過停用站點；其他站點資料保留。

Chrome Sync v2 代碼固定為 `0: dm5`、`3: manhuagui`、`4: 8comic`、`5: baozimh`；`1: SF` 與 `2: ComicBus` 永久停用。解析舊 wire rows 保留原始參照索引並驗證格式，略過停用列與參照，不將 code 2 解讀成 8comic。不變更 DB、dump 或 sync format 版本。

## 測試

真實作品與章節樣本見 `src/sites/8comic/fixtures/README.md`。Focused tests 涵蓋 no-DOM metadata、兩種圖片表欄位順序、分篇與頁碼、資料驗證、取消／timeout、reader hydration／gate、跳轉／DNR、啟動清理、匯入與同步參照。

實機驗收需重新載入建置後的擴充功能，從作品頁點開公開章節，確認 DNR、連續閱讀、跳章、追蹤、popup 繼續閱讀與原站 bypass。
