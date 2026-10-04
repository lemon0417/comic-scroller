# DM5 解析流程

本文件保留核心解析鏈路，供維護與除錯使用。

## 1) 入口
使用者進入章節頁（例：`https://www.dm5.com/m1753397/`），背景會導向：
```
chrome-extension://<ext-id>/app.html?site=dm5&chapter=m1753397
```

僅以下 URL 會被重導：
- `https://www.dm5.com/m\d+/`
- `https://tel.dm5.com/m\d+/`

若章節頁 URL 帶有 `?cs_open_native=1`，則視為刻意回原站閱讀，background 不會重導。

## 2) 作品 metadata 抓取
來源：`src/sites/dm5/meta.ts`（`fetchMeta$`）

章節列表與章節標題優先改由 RSS XML 取得。作品頁 URL 若符合：
```
https://www.dm5.com/manhua-<slug>/
```
會轉成：
```
https://www.dm5.com/rss-<slug>/
```

RSS XML 使用 `fast-xml-parser` 轉成 object tree 後，從 `<channel>` / `<item>` 解析出：
- `title`
- `chapterList`：由 `<item><link>` 的 `/m\d+/` 萃取 chapter ID
- `chapters[chapterID] = { title, href }`

RSS XML 沒有 cover；前景 metadata 流程需要封面時，會再抓一次作品頁 HTML，只解析：
- `.banner_detail .cover > img` 的 `src`

封面屬於次要資訊，只有 reader／前景 metadata 流程需要補齊封面時才抓作品頁 HTML。

reader 流程若需要補抓 cover，會採兩段式 hydration：
- 先發出只有 `title + chapterList + chapters` 的最小 metadata，讓 header / 章節列表 / 訂閱狀態先完成初始化
- cover 抓到後再補一筆帶 `cover` 的 metadata

背景更新固定使用 chapter snapshot：RSS 成功時只送出一個 RSS request，不抓封面或等待 cover hydration。以下情況仍使用既有作品 HTML parser，但背景只接收 `chapterList + chapters`：
- RSS request 失敗
- RSS 沒有任何可用章節連結
- 作品 URL 不是 `manhua-*`，無法推導 RSS URL（相容已儲存的 legacy URL）

RSS 與作品 HTML 會在前景 metadata 流程併發取得。RSS 需要 fallback 時會重用該次作品 HTML request；若該 request 也失敗，不會立刻對同一 URL 發出第三次無退避請求。封面解析或請求失敗時，RSS 的最小 metadata 仍可使用。

## 3) 章節頁抓取
來源：
- `src/epics/sites/dm5.ts`：負責 ajax 與 action orchestration
- `src/sites/dm5/chapter.ts`：負責章節頁 HTML parser
- `src/sites/dm5/imageResolver.ts`：負責 packer 解包與圖片 URL resolver

DM5 reader 流程裡，章節身分和作品身分必須分開看：
- `chapterID`：`m1753397` 這種章節頁 ID，來自 `app.html?site=dm5&chapter=m1753397`
- `seriesSlug`：`manhua-bailianchengshen` 這種作品 slug，從章節頁作品連結或 `DM5_CURL` 解析出來

parser 對外回傳 `chapterID + seriesSlug + imgList`，epic 只在寫入通用 reducer/repository 時，才把 `seriesSlug` 映射到既有 `comicsID` 欄位；不要在 DM5 parser/epic 內把兩者都叫 `comicsID`

從章節 HTML 解析：
- `DM5_IMAGE_COUNT`
- `DM5_CID` / `DM5_CURL`
- `DM5_MID`
- `DM5_VIEWSIGN_DT` / `DM5_VIEWSIGN`
- `DM5_KEY`（可為空；只保留作最終圖片 URL 的 fallback）

若章節頁沒有 `DM5_IMAGE_COUNT`，但存在 `#view-chapterpay-btn` / `.view-pay-btn`，會視為付費章節：
- 產生一張 `type: "paywall"` placeholder
- 不自動預載上一章，避免付費卡片後面繼續串出其他章節
- 原站連結會加上 `?cs_open_native=1`，background 收到這個 marker 時不再重導回 `app.html`

章節 HTML 統一使用不依賴 DOM 的字串 parser，讓 reader 與 MV3 runtime 共用同一套行為。若無法產出有效的 `chapterID + seriesSlug + imgList`，parser 會直接拋錯並中止後續流程；不允許帶著空的 `seriesSlug` 或壞的 `comicUrl` 繼續寫入 state / repository。

## 4) chapterfun.ashx（中介）
```
https://www.dm5.com/<DM5_CURL>/chapterfun.ashx
  ?cid=<DM5_CID>
  &page=<page>
  &key=
  &language=1
  &gtk=6
  &_cid=<DM5_CID>
  &_mid=<DM5_MID>
  &_dt=<DM5_VIEWSIGN_DT>
  &_sign=<DM5_VIEWSIGN>
```
回應為 obfuscated script（packer 格式）。

`chapterfun.ashx` 的 `key` query 目前固定保留空值，不帶入章節頁的 `DM5_KEY`。實際圖片 key 通常由 packer response 提供；只有 response 沒有 key 時，才回退使用章節頁解析值。

reader 只會對目前可視範圍與 overscan 範圍內、且尚未解析完成的頁面請求 `chapterfun.ashx`。同一張圖在 request 尚未完成前，會做 in-flight dedupe，避免快速捲動時重複打同一頁。
章節頁 request 與 `chapterfun.ashx` request 都有 timeout 保護。若章節頁 request timeout，reader 會維持空白頁面並顯示全頁 `重試`；若 `chapterfun.ashx` request timeout、解包失敗，或後續圖片載入失敗，reader 會先自動重試 2 次；仍失敗時，該頁改顯示單張 `重試` 按鈕，不需要整頁重新整理。
下一章 prefetch 抓到 payload 後，不會立刻插進 reader list；只有當前章節首張可閱讀圖片 ready 後，queued 章節才會 append，避免 placeholder 高度讓更後面的章節提早進入可視範圍。

## 5) 解包與解析
來源：`src/sites/dm5/imageResolver.ts`

解出：
- `pix`：CDN base URL
- `pvalue` / `d` / `hd_c`：圖片路徑
- 可能包含 `cid` / `key`

resolver 只接受 `pvalue`、`d`、`hd_c` 這三種已知命名陣列，取第一張圖片路徑作為該頁 URL 來源。未知陣列或 response 中偶然出現的 URL 不會被當成圖片；解析失敗會交給既有 reader retry／錯誤狀態。

## 6) 最終圖片 URL
```
<pix>/<image-path>?cid=<cid>&key=<key>
```
`cid/key` 優先採用 chapterfun response；response 未提供時，才回退到章節頁的 `DM5_CID` 與 `DM5_KEY`／`#dm5_key`。`DM5_KEY` 仍是程式保留的最終 fallback，不會取代 response 已提供的圖片 key。

## 7) Header 規則
CDN 需要 Referer 與成人 Cookie，由 `public/rules.json` 注入：
- `Referer: https://www.dm5.com/m`
- `Cookie: isAdult=1`

## 8) 離線回歸樣本

Fixtures 位於 `src/sites/dm5/fixtures/`，來源與精簡方式見該目錄 README。測試共同使用 `readSiteFixture("dm5", filename)`，所有 HTTP 回應 mock，不載入 fixture 圖片或執行 packer。

電鋸人與百煉成神各保留三個 RSS item 與作品 HTML 代表章節，驗證 RSS 順序、封面 hydration、背景 RSS-only、RSS 失敗／空清單後的 HTML fallback，以及 DOM／無 DOM 解析。HTML 保留原站的順序與 VIP lock 標記，不要求與 RSS 順序相同。

免費章節 `m1768478` 保留 30 頁的變數宣告與第一頁完整 chapterfun response，驗證空請求 key 及 response 圖片 key。VIP 章節 `m462489` 保留實際購買按鈕，驗證 placeholder、關閉預載、不請求圖片及 `cs_open_native=1` 連結。兩份舊 packer 常數移入獨立 `.js` fixtures，原有 fallback/schema 測試仍保留。
