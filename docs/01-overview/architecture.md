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
- `library.ts` 是最小公開 facade；場景型呼叫面拆為：
  - `library/reader.ts`
  - `library/popup.ts`
  - `library/background.ts`
- 內部實作拆為：
  - `library/schema.ts`
  - `library/models.ts`
  - `library/shared.ts`
  - `library/queries.ts`
  - `library/mutations.ts`
  - `library/compat.ts`
  - `library/signal.ts`
- `library.ts` 只保留通用 config / import-export / signal 類 API
- reader、popup、background 應優先從各自的場景 facade 取用 repository 函式，不要再全部從單一 barrel 匯入
- ESLint 會用 `no-restricted-imports` 守住這條邊界，避免新程式碼回頭依賴主 barrel 或 internal module
- schema constants、row types、normalize helper 屬於 internal detail；若測試或底層模組需要，直接從 `library/schema.ts` 取用
- query / view model 型別（例如 popup feed、reader query result）集中在 `library/models.ts`
- `LibrarySnapshotV2` 目前只保留給 `compat.ts` 內部流程、匯入匯出與 migration
- 底層以 IndexedDB 結構化 stores 持久化：
  - `series`
  - `chapters`
  - `subscriptions`
  - `history`
  - `updates`
- `subscriptions` row 保留 UI 顯示排序 `position`，並額外記錄背景輪詢用的 `checkedAt`
- `chrome.storage.local.librarySignal` 用於跨 context 通知資料已變更
- repository 目前分成兩層 API：
  - config / import-export：`resetLibrary`、`exportLibraryDump`、`importLibraryDump`、`setLibraryVersion`
  - query / mutation：`getPopupFeedSnapshot`、`getSeriesSnapshot`、`listSubscriptionKeys`、`applyReaderSeriesState`、`applyReadProgress`、`setSeriesSubscription*`、`dismissSeriesUpdate`、`removeSeriesFromHistory`、`removeSeriesCascade`
- `getPopupFeedSnapshot()` 直接由 IndexedDB rows 組出 popup feed model，不再先組整包 `LibrarySnapshotV2`
- popup / manage 的刪除語意分三層：
  - `history -> 移除`：只刪 `history` row，不刪作品、章節、追蹤或更新
  - `subscribe -> 棄坑`：預設只取消追蹤並清除該作品的更新提醒
  - `subscribe -> 棄坑 + 清除資料`：才使用 `removeSeriesCascade` 刪除作品資料、章節快取、追蹤、紀錄與更新
- 核心欄位：
  - `seriesByKey`
  - `subscriptions`
  - `history`
  - `updates`
- `SeriesKey` 格式為 `${site}:${comicsID}`
- `comicsID` 使用站點原生 canonical 格式：
  - DM5 作品系列可使用 `manhua-*` slug
  - DM5 若傳入純數字或 `m123` 章節型 ID，才 canonical 成 `m123`
  - SF / ComicBus 維持原站點 ID
- 舊版 storage schema 會在載入時自動 migration 到 IndexedDB
- 匯出格式改為 DB dump JSON；匯入同時支援新 dump 與舊版 JSON
- 目前 `read` 仍保留在 `series` row 內；尚未拆成獨立 table

## 模組位置
- Actions：`src/domain/actions/`
- Reducers：`src/domain/reducers/`
- Epics：`src/epics/`、`src/epics/sites/`、`src/epics/popup/`
- Sites：`src/sites/`（`registry.ts`、`*/adapter.ts`、`*/meta.ts`、站點純 parser/resolver）
- Site reader orchestration：`src/epics/sites/readerFlow.ts` 提供共用 `fetchChapter / fetchImgList / updateRead` 模板，各站點 epic 只保留章節圖片抓取與站點特例 hook
- Services：`src/infra/services/`（`storage.ts`、`library.ts`、`library/*.ts`、`background.ts`）
- Store：`src/domain/store/`
- Popup / Manage view state：
  - popup reducer 只保存 popup feed 與 UI 狀態
  - destructive action 的確認流程由 `ManageApp` 內的 custom dialog 控制，不使用原生 `confirm()`
  - `getPopupFeedSnapshot()` 直接回傳 UI 所需的 feed model，不再把 `LibrarySnapshotV2` 放進 popup store
- Reader view state：
  - `comics` state 保存 canonical `seriesKey`
  - 圖片閱讀列表使用 `react-window` 虛擬化；`ImageContainer` 透過 `onRowsRendered` 回報目前可視 row 範圍，再由 `scrollEpic` 觸發圖片載入、已讀更新與前章預載
  - 是否允許向前預載章節，由 `canPreloadPreviousChapter` 顯式控制，不使用 sentinel index 表示流程狀態
  - reader UI 同步 library 狀態時，優先使用單一 query `getReaderSeriesState()`，不要拆成多次查詢再自行拼裝
- Background：
  - `src/background.ts` 只保留 MV3 listener wiring
  - 更新檢查、安裝處理、通知點擊、ping 回應、reader redirect 解析集中在 `src/infra/services/background.ts`
  - 訂閱更新檢查會依 `subscriptions.checkedAt` 由舊到新取批次輪詢
  - 每輪 background refresh 使用固定上限並發與單筆 metadata fetch timeout，避免某個慢站拖住整輪 service worker 工作
- Repository 測試基礎：
  - 真實 IndexedDB integration tests 使用 `fake-indexeddb`
  - 測試用 DB reset 與 module cache reset 集中在 `library/shared.ts` 的 test-only helper

## UI 元件命名
- `ds-*` 只保留共享 primitive，例如 button、tab、notice、empty state、panel、content
- 頁面殼層使用 `popup-*`、`manage-*`、`reader-*`，只負責 layout 與 page shell
- 共用業務元件使用 component-owned class，例如 `series-row`、`series-row__title`
- 頁面差異優先透過元件顯式 `variant` 處理，例如 `series-row--popup`，不要用 ancestor selector 從 `popup-panel` / `manage-*` 去覆寫元件內部節點
- 若舊元件體系已不再被 runtime 使用，應移除，不保留平行的 class vocabulary

## 重構原則
- Reducer 必須純函式
- Side effects 一律放 epics 或 services
- 站點 metadata 差異由 `src/sites/*/adapter.ts` 吃掉；`fetchMeta` 對外回傳 `Observable<SiteMeta>`，background 不應保留站點特例分支
- 站點純 parser / resolver 優先放在 `src/sites/*`，`src/epics/sites/*` 只負責 ajax/action/repository orchestration
- 若 orchestration 在多個站點重複，優先抽到 `src/epics/sites/readerFlow.ts`，不要在每個站點 epic 複製 `FETCH_CHAPTER / FETCH_IMG_LIST / UPDATE_READ` 樣板
- 不得在 component、reducer、background 中直接讀寫 IndexedDB 或拼接舊 schema
- 所有持久化更新優先走 library repository facade；依場景選 `library/reader`、`library/popup`、`library/background`
- 新增業務流程時，優先使用 query / mutation API，不要新增 `loadLibrary → mutate snapshot → saveLibrary`
- `compat.ts` 是過渡層，不應成為新功能的預設入口，也不應透過主 facade 再向外擴張
- Reader store 與 Popup store 只保存頁面需要的 state，不作為跨頁面持久化真實來源
