# 資料流與模組邊界

## 核心資料流
- `chrome.storage.local` 是唯一持久化資料來源（source of truth）
- UI 觸發 action
- reducers 同步更新頁面內 state（session / view state）
- epics 處理非同步（網路 / storage / location sync）並回寫 action
- UI 根據 store 更新
- popup / manage / reader 之間的持久化同步，統一透過 `chrome.storage.onChanged`

簡寫：
UI → Actions → Reducers → State → UI
副作用：
UI → Actions → Epics → Services → Storage/Network → Actions

## 持久化模型
- 共享持久化模型位於 `src/infra/services/library.ts`
- 目前使用 `LibrarySnapshotV2`
- 核心欄位：
  - `seriesByKey`
  - `subscriptions`
  - `history`
  - `updates`
- `SeriesKey` 格式為 `${site}:${comicsID}`
- `comicsID` 使用站點原生 canonical 格式：
  - DM5 一律使用 `m123`
  - SF / ComicBus 維持原站點 ID
- 舊版 storage schema 會在載入時自動 migration 到 V2

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
- 不得在 component、reducer、background 中直接拼接舊 schema 讀寫
- 所有持久化更新優先走 `library.ts`
- Reader store 與 Popup store 只保存頁面需要的 state，不作為跨頁面持久化真實來源
