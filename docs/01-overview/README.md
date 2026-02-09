# 專案概覽

## 核心定位
- 純前端 Chrome Extension（MV3），不依賴後端服務。
- 主要包含：閱讀頁（app）、彈窗（popup）、背景服務（service worker）。

## 入口與核心模組
- Reader：`src/app.tsx` → `src/ui/containers/App`
- Popup：`src/popup.tsx` → `src/ui/containers/PopupApp`
- Background：`src/background.ts`

## 目錄結構（重點）
- `src/ui/`：UI 組件與容器
- `src/domain/`：reducers / store
- `src/epics/`：副作用與資料流
- `src/sites/`：站點 adapter / registry / meta（reader + background 共用）
- `src/infra/`：storage / chrome 等 I/O
- `src/styles/`：樣式（`tailwind.css` 為入口）
- `src/assets/`：靜態資產（`imgs/`）
- `src/manifest/`：`manifest.json` / `manifest.dev.json`
- `public/`：靜態資產與 `rules.json`
- `dist/`：建置輸出（禁止手改）
- `docs/`：文件
