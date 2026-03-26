# 測試指南

## 測試框架
- Jest
- React Testing Library

## 測試位置與命名
- 測試與元件/模組同層，例如：`src/ui/components/Loading/Loading.test.tsx`

## 優先測試範圍
- Epics 的章節/圖片流程
- Reducer 的核心狀態更新
- `library.ts` 的 migration / canonical key / IndexedDB 持久化更新流程
- popup / manage 的 hydrate 與 `storage.onChanged` 同步
- background 在 MV3 限制下的更新檢查流程

## 重構後的測試原則
- 新測試優先 mock `@infra/services/library`，不要再綁死舊版 storage schema callback 細節
- 若測的是底層 storage wrapper 或 signal，同步 mock `chrome.storage.local`
- 若測的是 repository 實作，優先驗證公開 API，不直接耦合 object store 細節
- reducer 測試不得依賴 `document` / `window.history` side effects
