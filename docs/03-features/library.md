# Library 資料模型

這份文件描述書庫的持久化分層，目的是把 runtime IndexedDB 結構、備份 dump 格式、以及 legacy 匯入相容性分開看待。

## 分層原則
- runtime source of truth 是 IndexedDB
- backup / restore 走 `compat.ts` 的 dump 格式，不等同於 runtime rows
- legacy `chrome.storage` JSON 只作為匯入相容來源，不再作為主資料結構

## Runtime IndexedDB
- `meta`
  - 儲存初始化狀態、extension version、schema version、db version
- `series`
  - 儲存作品主資料與摘要欄位
  - 主要欄位：`title / cover / url / lastRead`
  - popup / manage 用的摘要欄位也放在這裡：
    - `lastReadTitle`
    - `lastReadHref`
    - `latestChapterID`
    - `latestChapterTitle`
    - `latestChapterHref`
- `chapters`
  - 儲存章節快取與順序
  - 欄位：`seriesKey / chapterID / title / href / orderIndex`
  - 定位是 cache，不是永久核心資料
- `reads`
  - 儲存已讀章節 key
  - 欄位：`seriesKey / chapterID`
  - `series` row 不再保存 `read[]`
- `subscriptions`
  - 儲存追蹤清單排序與背景輪詢狀態
  - 欄位：`seriesKey / position / checkedAt?`
- `history`
  - 儲存閱讀紀錄排序
  - 欄位：`seriesKey / position`
- `updates`
  - 儲存更新卡片排序
  - 欄位：`seriesKey / chapterID / position`
  - runtime 不再保存 `createdAt`

## Backup Dump

### Dump v2
- 目前預設匯出格式
- `formatVersion: 2`
- 特色：
  - 以作品分組保存章節，避免每章重複輸出 `seriesKey`
  - `history` 直接保存有序 `seriesKey[]`
  - `updates` 不再輸出 `position` 或 `createdAt`
  - `subscriptions` 只保存 `seriesKey + checkedAt?`
- 匯出檔預設下載為 `comic-scroller-library.json.gz`

### Dump v1
- 舊版正式 dump 格式
- 結構接近早期 runtime row 輸出：
  - `series[]`
  - `chapters[]`
  - `subscriptions[]`
  - `history[]`
  - `updates[]`
- 仍可匯入
- `updates[].createdAt` 若存在，匯入時會被忽略

## Legacy 匯入
- 舊版 `chrome.storage` JSON 仍可匯入
- 典型欄位：
  - `history`
  - `subscribe`
  - `update`
  - `dm5 / sf / comicbus`
- 匯入時會先 migration 成 current snapshot，再寫入 IndexedDB

## 匯入匯出相容性
- 匯入支援：
  - legacy `chrome.storage` JSON
  - dump v1
  - dump v2
  - plain JSON bytes
  - gzip archive bytes
- 匯出預設：
  - compact dump v2
  - gzip archive

## 快取與回收
- `chapters` 是 cache，不是每部作品都必須永久保存
- `reads` 是 runtime query 用的結構化資料，不是 dump-only 欄位
- 若作品不再被 `subscriptions / history / updates` 任一列表引用，repository 會回收 orphaned：
  - `series`
  - `chapters`
  - `reads`

## Reader UI State
- reader 頁面的 Redux `comics` state 不是 repository row 的鏡像
- `chapterList` 仍保存目前閱讀流程需要的章節順序
- `chapters` 只保留 title-only metadata，供：
  - `ChapterList`
  - `readerLocationEpic`
  - reader header 顯示
- `currentChapterTitle` 是 reducer 維護的衍生欄位，避免 header 與 location sync 每次都回頭查 `chapters` map
- mount / `librarySignal` sync 若只需要確認作品存在與追蹤狀態，應使用 `getReaderSeriesSyncState()`
- 只有需要完整 chapter list / read state 的 reader 查詢，才使用 `getReaderSeriesState()`

## 維護準則
- 新功能不要再把 dump row 當成 runtime row 使用
- 新功能若只需要 popup / manage 摘要，優先查 `series` summary，不要 hydrate 全量章節快取
- 若調整匯出格式，優先新增 `formatVersion`，不要破壞既有匯入相容
