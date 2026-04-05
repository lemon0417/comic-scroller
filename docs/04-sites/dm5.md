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

RSS XML 沒有 cover，因此會再抓一次作品頁 HTML，只解析：
- `.banner_detail .cover > img` 的 `src`

封面屬於次要資訊，只有 repository 內尚未有既有 `cover` 時才會補抓作品頁 HTML；背景更新檢查若已有封面，會只抓 RSS，不再重抓 HTML cover。

reader 流程若需要補抓 cover，會採兩段式 hydration：
- 先發出只有 `title + chapterList + chapters` 的最小 metadata，讓 header / 章節列表 / 訂閱狀態先完成初始化
- cover 抓到後再補一筆帶 `cover` 的 metadata

背景更新檢查不走兩段式；若需要 cover，會等待完整 metadata 後再比對更新。

若 RSS request 失敗，或 RSS 雖成功但沒有任何可用章節連結，會 fallback 回舊 HTML parser 流程，避免 RSS 成為單點故障。

若作品頁 URL 不是 `manhua-*` 形狀，則 fallback 回舊 HTML parser 流程，避免非標準 URL 直接失效。

## 3) 章節頁抓取
來源：
- `src/epics/sites/dm5.ts`：負責 ajax 與 action orchestration
- `src/sites/dm5/chapter.ts`：負責章節頁 HTML parser、packer 解包、圖片 URL resolver

DM5 reader 流程裡，章節身分和作品身分必須分開看：
- `chapterID`：`m1753397` 這種章節頁 ID，來自 `app.html?site=dm5&chapter=m1753397`
- `seriesSlug`：`manhua-bailianchengshen` 這種作品 slug，從章節頁作品連結或 `DM5_CURL` 解析出來

parser 對外回傳 `chapterID + seriesSlug + imgList`，epic 只在寫入通用 reducer/repository 時，才把 `seriesSlug` 映射到既有 `comicsID` 欄位；不要在 DM5 parser/epic 內把兩者都叫 `comicsID`

從章節 HTML 解析：
- `DM5_IMAGE_COUNT`
- `DM5_CID` / `DM5_CURL`
- `DM5_MID`
- `DM5_VIEWSIGN_DT` / `DM5_VIEWSIGN`
- `DM5_KEY`（可為空）

若章節頁沒有 `DM5_IMAGE_COUNT`，但存在 `#view-chapterpay-btn` / `.view-pay-btn`，會視為付費章節：
- 產生一張 `type: "paywall"` placeholder
- 不自動預載上一章，避免付費卡片後面繼續串出其他章節
- 原站連結會加上 `?cs_open_native=1`，background 收到這個 marker 時不再重導回 `app.html`

若 DOM parser 與字串 fallback parser 都無法產出有效的 `chapterID + seriesSlug + imgList`，parser 會直接拋錯並中止後續流程；不允許帶著空的 `seriesSlug` 或壞的 `comicUrl` 繼續寫入 state / repository。

## 4) chapterfun.ashx（中介）
```
https://www.dm5.com/<DM5_CURL>/chapterfun.ashx
  ?cid=<DM5_CID>
  &page=<page>
  &key=<DM5_KEY>
  &language=1
  &gtk=6
  &_cid=<DM5_CID>
  &_mid=<DM5_MID>
  &_dt=<DM5_VIEWSIGN_DT>
  &_sign=<DM5_VIEWSIGN>
```
回應為 obfuscated script（packer 格式）。

reader 只會對目前可視範圍與 overscan 範圍內、且尚未解析完成的頁面請求 `chapterfun.ashx`。同一張圖在 request 尚未完成前，會做 in-flight dedupe，避免快速捲動時重複打同一頁。

## 5) 解包與解析
來源：`src/sites/dm5/chapter.ts`

解出：
- `pix`：CDN base URL
- `pvalue` / `d` / `hd_c`：圖片路徑
- 可能包含 `cid` / `key`

取第一張圖片路徑作為該頁 URL 來源。

## 6) 最終圖片 URL
```
<pix>/<image-path>?cid=<cid>&key=<key>
```
若 script 未提供 `cid/key`，則回退到章節頁解析的值。

## 7) Header 規則
CDN 需要 Referer 與成人 Cookie，由 `public/rules.json` 注入：
- `Referer: https://www.dm5.com/m`
- `Cookie: isAdult=1`
