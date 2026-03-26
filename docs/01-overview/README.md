# 專案概覽

## 核心定位
- 純前端 Chrome Extension（MV3），不依賴後端服務。
- 主要包含：閱讀頁（app）、彈窗（popup）、背景服務（service worker）。
- 持久化主資料由 `IndexedDB` 管理，`chrome.storage.local` 僅負責同步 signal 與小型設定，頁面 store 只承擔 UI / session state。

## 入口與核心模組
- Reader：`src/app.tsx` → `src/ui/containers/App`
- Popup：`src/popup.tsx` → `src/ui/containers/PopupApp`
- Background：`src/background.ts`

## 目錄結構（重點）
- `src/ui/`：UI 組件與容器
- `src/domain/`：actions / reducers / selectors / store
- `src/epics/`：副作用與資料流
- `src/sites/`：站點 adapter / registry / meta（reader + background 共用）
- `src/infra/`：storage / library repository / chrome 等 I/O
- `src/styles/`：樣式（`tailwind.css` 為入口）
- `src/assets/`：靜態資產（`imgs/`）
- `src/manifest/`：`manifest.json` / `manifest.dev.json`
- `public/`：靜態資產與 `rules.json`
- `dist/`：建置輸出（禁止手改）
- `docs/`：文件

## 目前架構重點
- 共享持久化模型：`src/infra/services/library.ts`
- popup / manage / reader 的持久化同步：`chrome.storage.onChanged` + `librarySignal`
- library repository 對外維持 `LibrarySnapshotV2`，底層改為 IndexedDB stores
- reducer 不負責 DOM / URL side effects，這類行為放在 epics
- background 保持 MV3 service worker 限制下可用，不依賴 DOM API
