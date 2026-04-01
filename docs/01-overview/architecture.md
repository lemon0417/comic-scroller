# 資料流與模組邊界

## 核心資料流
- `IndexedDB` 是主要持久化資料來源（source of truth）
- `chrome.storage.local` 只承擔跨 context 同步 signal 與小型設定
- UI 觸發 action
- reducers 同步更新頁面內 state（session / view state）
- epics 處理非同步（網路 / storage / location sync）並回寫 action
- UI 根據 store 更新
- popup / manage / reader 之間的持久化同步，統一透過 `chrome.storage.onChanged` 監聽 `librarySignal`
- signal 只做 invalidation，不直接攜帶主資料；收到後由各入口依需求重新 query repository

簡寫：
UI → Actions → Reducers → State → UI
副作用：
UI → Actions → Epics → Services → IndexedDB/Network → Actions

## 持久化模型
- 共享持久化模型位於 `src/infra/services/library.ts`
- 對外仍使用 `LibrarySnapshotV2` 作為 repository 載入後的快照格式
- 底層以 IndexedDB 結構化 stores 持久化：
  - `series`
  - `chapters`
  - `subscriptions`
  - `history`
  - `updates`
- `chrome.storage.local.librarySignal` 用於跨 context 通知資料已變更
- repository 目前分成兩層 API：
  - compatibility：`loadLibrary`、`saveLibrary`、`exportLibraryDump`、`importLibraryDump`
  - query / mutation：`getPopupFeedSnapshot`、`getSeriesSnapshot`、`listSubscriptionKeys`、`applyReaderSeriesState`、`applyReadProgress`、`setSeriesSubscription*`、`dismissSeriesUpdate`、`removeSeriesCascade`
- 核心欄位：
  - `seriesByKey`
  - `subscriptions`
  - `history`
  - `updates`
- `SeriesKey` 格式為 `${site}:${comicsID}`
- `comicsID` 使用站點原生 canonical 格式：
  - DM5 一律使用 `m123`
  - SF / ComicBus 維持原站點 ID
- 舊版 storage schema 會在載入時自動 migration 到 IndexedDB
- 匯出格式改為 DB dump JSON；匯入同時支援新 dump 與舊版 JSON
- 目前 `read` 仍保留在 `series` row 內；尚未拆成獨立 table

## 模組位置
- Actions：`src/domain/actions/`
- Reducers：`src/domain/reducers/`
- Epics：`src/epics/`、`src/epics/sites/`、`src/epics/popup/`
- Sites：`src/sites/`（`registry.ts`、`*/adapter.ts`、`*/meta.ts`）
- Services：`src/infra/services/`（`storage.ts`、`library.ts`）
- Store：`src/domain/store/`

## 重構原則
- Reducer 必須純函式
- Side effects 一律放 epics 或 services
- 站點解析邏輯集中在 `src/epics/sites/`
- 不得在 component、reducer、background 中直接讀寫 IndexedDB 或拼接舊 schema
- 所有持久化更新優先走 `library.ts`
- 新增業務流程時，優先使用 query / mutation API，不要新增 `loadLibrary → mutate snapshot → saveLibrary`
- Reader store 與 Popup store 只保存頁面需要的 state，不作為跨頁面持久化真實來源
