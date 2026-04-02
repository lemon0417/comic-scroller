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
- `library.ts` 是公開 facade；內部實作拆為：
  - `library/schema.ts`
  - `library/shared.ts`
  - `library/queries.ts`
  - `library/mutations.ts`
  - `library/compat.ts`
  - `library/signal.ts`
- facade 只暴露業務 API 與少量 shared helper（例如 `buildSeriesKey` / `parseSeriesKey`）
- schema constants、row types、normalize helper 屬於 internal detail；若測試或底層模組需要，直接從 `library/schema.ts` 取用
- `LibrarySnapshotV2` 目前只保留給 `compat.ts` 內部流程、匯入匯出與 migration
- 底層以 IndexedDB 結構化 stores 持久化：
  - `series`
  - `chapters`
  - `subscriptions`
  - `history`
  - `updates`
- `chrome.storage.local.librarySignal` 用於跨 context 通知資料已變更
- repository 目前分成兩層 API：
  - config / import-export：`resetLibrary`、`exportLibraryDump`、`importLibraryDump`、`setLibraryVersion`
  - query / mutation：`getPopupFeedSnapshot`、`getSeriesSnapshot`、`listSubscriptionKeys`、`applyReaderSeriesState`、`applyReadProgress`、`setSeriesSubscription*`、`dismissSeriesUpdate`、`removeSeriesCascade`
- `getPopupFeedSnapshot()` 直接由 IndexedDB rows 組出 popup feed model，不再先組整包 `LibrarySnapshotV2`
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
- Services：`src/infra/services/`（`storage.ts`、`library.ts`、`background.ts`）
- Store：`src/domain/store/`
- Popup / Manage view state：
  - popup reducer 只保存 popup feed 與 UI 狀態
  - `getPopupFeedSnapshot()` 直接回傳 UI 所需的 feed model，不再把 `LibrarySnapshotV2` 放進 popup store
- Reader view state：
  - `comics` state 保存 canonical `seriesKey`
  - reader UI 同步 library 狀態時，優先使用單一 query `getReaderSeriesState()`，不要拆成多次查詢再自行拼裝
- Background：
  - `src/background.ts` 只保留 MV3 listener wiring
  - 更新檢查、安裝處理、通知點擊、ping 回應、reader redirect 解析集中在 `src/infra/services/background.ts`
- Repository 測試基礎：
  - 真實 IndexedDB integration tests 使用 `fake-indexeddb`
  - 測試用 DB reset 與 module cache reset 集中在 `library/shared.ts` 的 test-only helper

## 重構原則
- Reducer 必須純函式
- Side effects 一律放 epics 或 services
- 站點解析邏輯集中在 `src/epics/sites/`
- 不得在 component、reducer、background 中直接讀寫 IndexedDB 或拼接舊 schema
- 所有持久化更新優先走 `library.ts`
- 新增業務流程時，優先使用 query / mutation API，不要新增 `loadLibrary → mutate snapshot → saveLibrary`
- `compat.ts` 是過渡層，不應成為新功能的預設入口，也不應透過 `library.ts` 再向外擴張
- Reader store 與 Popup store 只保存頁面需要的 state，不作為跨頁面持久化真實來源
