# 測試指南

## 測試框架
- Jest
- React Testing Library

## 測試位置與命名
- 測試與元件/模組同層，例如：`src/ui/components/Loading/Loading.test.tsx`

## 優先測試範圍
- Epics 的章節/圖片流程
- Reducer 的核心狀態更新
- `library.ts` 的 migration / canonical key / IndexedDB query / mutation 流程
- popup / manage 的 hydrate 與 `storage.onChanged` 同步
- background 在 MV3 限制下的更新檢查流程

## 重構後的測試原則
- 新測試優先 mock 對應的場景 facade：
  - reader：`@infra/services/library/reader`
  - popup：`@infra/services/library/popup`
  - background：`@infra/services/library/background`
- 不要再預設 mock `@infra/services/library` 整包 barrel
- 若測的是底層 storage wrapper 或 signal，同步 mock `chrome.storage.local`
- 若測的是 repository 實作，優先直接測 `queries.ts`、`mutations.ts`、`signal.ts`、`compat.ts` 的公開函式，不要只停在 barrel mock
- repository 模組測試可以 mock `shared.ts` 的 IndexedDB primitive，重點驗證 query / mutation 語意與 signal payload
- `queries.ts` 測試應優先驗證最終 query model，例如 popup feed，不要再用 `LibrarySnapshotV2` 當預期值
- reader 測試若只是同步作品存在與追蹤狀態，優先 mock `getReaderSeriesSyncState()`
- reader 測試若真的需要完整 chapter list / read state，再 mock `getReaderSeriesState()`
- 不要再分別 mock `getSeriesSnapshot()` 和 `isSeriesSubscribedByKey()`
- 若測試需要 schema constants / row types，直接從 `@infra/services/library/schema` 匯入，不要再要求 facade 重新暴露 internal detail
- 若測試需要 popup feed / reader query result 型別，直接從 `@infra/services/library/models` 匯入，不要再把 query model 放回 schema
- background 測試優先直接測 `@infra/services/background` 的 service 函式；`src/background.ts` 應維持薄 wiring，不必堆大量 listener 細節測試
- 真實 IndexedDB integration tests 目前使用 `fake-indexeddb`
- repository integration tests 直接使用 `src/infra/services/library/shared.ts` 的 `resetLibraryPersistenceForTests()` 重置 DB connection cache、刪除測試 DB、清空 `chrome.storage.local`
- `fake-indexeddb` 依賴 `structuredClone`；若測試環境缺少，需在測試檔中補 polyfill
- popup / manage 測試優先 mock `getPopupFeedSnapshot`，並驗證 reducer 保存的是 popup feed state，而不是 `LibrarySnapshotV2`
- reader / background 測試優先 mock 系列級 mutation API
- reducer 測試不得依賴 `document` / `window.history` side effects
