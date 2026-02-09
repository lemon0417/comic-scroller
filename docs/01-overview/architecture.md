# 資料流與模組邊界

## 核心資料流
- UI 觸發 action
- reducers 同步更新 state
- epics 處理非同步（網路 / storage）並回寫 action
- UI 根據 store 更新

簡寫：
UI → Actions → Reducers → State → UI
副作用：
UI/Reducers → Epics → Services → Storage/Network → Actions

## 模組位置
- Actions：`src/domain/actions/`
- Reducers：`src/domain/reducers/`、`src/ui/containers/*/reducers/`
- Epics：`src/epics/`、`src/epics/sites/`、`src/epics/popup/`
- Sites：`src/sites/`（`registry.ts`、`*/adapter.ts`、`*/meta.ts`）
- Services：`src/infra/services/`
- Store：`src/domain/store/`

## 重構原則
- Reducer 必須純函式
- Side effects 一律放 epics 或 services
- 站點解析邏輯集中在 `src/epics/sites/`
