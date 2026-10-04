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
  - 欄位：`seriesKey / position / checkedAt`
  - runtime `checkedAt` 必為有限數字；尚未輪詢時使用 `0`
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
  - `subscriptions` 保存 `seriesKey + checkedAt?`，匯入後維持背景輪詢順序
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
  - `dm5 / 8comic / manhuagui`
- 匯入時會先 migration 成 current snapshot，再寫入 IndexedDB
- SF 與 ComicBus 支援已移除；初始化會以單一 transaction 清除停用站點在 series、chapters、reads、subscriptions、history、updates 的紀錄，並記錄目前支援站點。其他站點的 row、輪詢時間與分組 checkpoint 保持原值。
- 舊 storage、dump v1 / v2 與同步 v1 / v2 中的 SF／ComicBus 作品及關聯參照會略過，不會重新加入書庫；legacy `sf`／`comicbus` bucket 僅保留作為清理 key。8comic 使用獨立站點身分，不遷移舊 ComicBus 資料。

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

## Chrome Sync v2
- runtime source of truth 仍是 IndexedDB；Chrome Sync 只是一層跨裝置同步輔助，不取代 repository
- 啟用狀態與本機同步 metadata 存在 `chrome.storage.local.librarySyncState`
- 遠端資料存在 `chrome.storage.sync`：
  - `librarySyncManifest`
  - `librarySyncChunk:*`
- 同步 payload 使用 `comic-scroller-library-sync` v2，`encoding: indexed-json-gzip-base64`；先將精簡資料轉為索引 JSON，再以瀏覽器原生 gzip 壓縮並編碼成 base64
- payload 只同步精簡書庫資料：
  - 作品主資料：`site / comicsID / title / cover / url / lastRead`
  - `subscriptions`
  - `history`：最近 50 筆
  - `updates`：全部待讀更新
  - `read`：僅最後閱讀章節 ID，不攜帶完整已讀清單
  - latest / lastRead / update 需要的章節摘要
- 作品只保留追蹤、最近 50 筆閱讀紀錄或更新提醒引用的項目；純快取作品不進入 payload
- 不同步完整已讀明細、完整章節快取、背景輪詢 `checkedAt`、debug 設定或 reader UI state
- sync projection 不讀 `reads` store，只查引用作品與 latest / lastRead / update 涉及的章節 row
- repository 內部使用獨立的 `LibrarySyncStateV1`，明確保存 `latestChapterID / lastReadChapterID / readChapterIDs / chapterSummaries`
- `syncModel.ts` 集中負責 v1 JSON 與 v2 索引 wire adapter；`syncCodec.ts` 負責 gzip / base64，不借用完整 backup dump 或 runtime snapshot 型別
- v2 索引 JSON 的資料列：
  - root：`[seriesRows, subscriptionRefs, historyRefs, updateRefs]`
  - series：`[siteCode, comicsID, title, cover, url, latestRef, lastReadRef, chapterRows]`
  - chapter：`[chapterID, title, href]`
  - update：`[seriesRef, chapterRef]`
  - site code 固定為 `0: dm5 / 3: manhuagui / 4: 8comic`（代碼 `1`（SF）與 `2`（ComicBus）永久停用，讀取舊資料時略過其作品與參照）；參照從 1 起算，latest / lastRead 的 `0` 表示缺少 checkpoint
  - 作品與章節 ID 各存一次；保留清單排序及全部追蹤、更新
- 新版讀取 v1 / v2，寫入僅使用 v2；v1 遠端 payload 先精簡再合併，合併後再次精簡，不需要 DB migration
- 使用同步的所有裝置都必須升級；舊客戶端不能讀取 v2，且可能再次寫回 v1
- manifest 保留 `updatedAt / deviceId / chunkCount / payloadBytes`；v2 新增 `encoding / encodedBytes`，分別記錄編碼方式與 base64 字串 bytes
- pull merge 以增量方式 upsert series、章節摘要與最後閱讀 ID，不刪除本機完整已讀明細或章節快取
- `checkedAt` 不進入遠端 payload；既有 subscription merge 時保留本機值，遠端新增項目從 `0` 開始
- 安全上限 `90 KiB`（92,160 bytes）按壓縮後的 manifest + 分片實際儲存占用（key + JSON 序列化 value）檢查；超額不寫遠端，不自動裁掉追蹤或更新提醒
- 分片按 UTF-8 計費大小（key + JSON 序列化 value）切割，每片最多 6,000 bytes；寫入前也檢查總儲存量不超過 102,400 bytes，包含 manifest、尚未移除的舊分片與其他既有 key
- 本機 metadata 的 `payloadBytes / pendingPayloadBytes` 分別是成功 / 失敗當次的原始 JSON UTF-8 bytes；`storageBytes / pendingStorageBytes` 是成功 / 失敗當次壓縮後的 manifest + 分片儲存占用；尚未完成壓縮的錯誤不提供失敗儲存大小
- 成功後清除 `lastError / pendingPayloadBytes / pendingStorageBytes`
- 原始 JSON 與串流解壓結果上限都是 `8 MiB`；逐片檢查完整性與長度，驗證 v2 tuple、站點代碼及所有索引範圍；不支援的版本、編碼或損壞資料會中止同步，手動同步與自動 push 都不得覆寫
- 瀏覽器缺少原生 CompressionStream / DecompressionStream 時顯示更新 Chrome 的錯誤，不降級寫入 v1；gzip 備份仍維持原有相容行為
- 同步錯誤保留原始原因；即使本機錯誤 metadata 寫入失敗，也透過服務回傳值提供 UI 顯示
- 同步 merge 是 best-effort：
  - 遠端 manifest 較新時，作品 title / cover / url / lastRead 優先採遠端
  - 本機與遠端的引用作品、追蹤、紀錄、更新合併去重；閱讀 checkpoint 按原有新舊優先規則選擇
  - 同步不維護 tombstone，因此跨裝置刪除可能被另一端舊資料合併回來
- 完整備份仍應使用匯出 `.json.gz`；Chrome Sync 只處理「無腦同步」的輕量場景
- 新裝置僅還原最後閱讀位置，不還原完整已讀明細

## 快取與回收
- `chapters` 是 cache，不是每部作品都必須永久保存
- background 以 `series.latestChapterID` 作為更新 checkpoint，不把 sync 的部分章節摘要誤認為完整章節基線
- checkpoint 不存在或已不在站點列表時，下一次背景 refresh 只建立完整 baseline，不產生舊章節更新提醒
- background 每次成功輪詢都以完整章節快照刷新 `chapters` 與 latest summary；title、cover、作品 URL、lastRead 與 reads 維持原值
- 背景候選由 subscriptions 與 series 在同一個 readonly transaction 組成，避免逐訂閱的 series point query
- `reads` 是 runtime query 用的結構化資料，不是 dump-only 欄位
- `lastRead` 是查詢摘要 checkpoint，同時必須存在於 `reads`；匯入、sync apply 與 DB upgrade 都會修復此不變量
- `subscriptions.seriesKey` 必須指向既有 `series`；subscribe mutation 會在同一 transaction 驗證，unsubscribe 可清除歷史 dangling row
- 若作品不再被 `subscriptions / history / updates` 任一列表引用，repository 會回收 orphaned：
  - `series`
  - `chapters`
  - `reads`
- 上述回收在取消追蹤、移除紀錄或略過更新時觸發，沒有時間到期或定期全庫掃描；超出閱讀紀錄上限而被擠出的作品仍可能留下快取
- manage 的「清理未追蹤作品」可在單一 transaction 手動清除全部未追蹤資料與孤兒附屬列；已追蹤作品的資料與排序維持原值
- 已刪除作品的閱讀進度與既有 reader 的延遲 metadata 不會建立作品；背景 refresh 寫入前會在同一 transaction 驗證作品存在且仍有追蹤

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
- DB v7 未改變 stores / keys / indexes，只正規化既有 `lastRead -> reads` 與 `subscriptions.checkedAt`
