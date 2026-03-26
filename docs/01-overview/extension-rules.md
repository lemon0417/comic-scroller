# 擴充功能規範（硬性）

## 基本原則
- **純前端**：不得引入後端服務或外部執行環境。
- **不手改 dist/**：一律用建置流程產出。
- **維持資料流**：UI → actions → reducers → epics / services → persistence / network → actions。
- **持久化唯一來源**：跨頁面主資料以 `IndexedDB` 為準，Redux 僅管理頁面內 state。
- **同步訊號**：`chrome.storage.local` 僅可用於小型設定與 cross-context signal，不承載主 library 資料。

## Manifest 與權限
- 使用 **MV3** service worker：`js/background.js`
- Header 修改使用 `declarativeNetRequest`（`public/rules.json`）
- 如需新增站點，必須更新 `src/manifest/manifest.json` 的 `host_permissions`
- 不得未經評估新增 `webRequest`、`scripting`、`offscreen`、content scripts 等額外能力
- 跨站請求只能打到既有 `host_permissions` 已覆蓋的來源

## CSP 與安全
- extension pages 嚴禁 `unsafe-eval`
- 解析流程避免動態執行 script，改用字串解析/解碼
- 不得引入 remote hosted code

## MV3 Service Worker 限制
- background 必須是事件驅動，不得依賴常駐記憶體
- background 不可依賴 `window`、`document`、`localStorage`
- background 與 extension pages 的資料同步優先使用 `chrome.storage.onChanged`
- service worker 必須可在每次喚醒時重新開啟 IndexedDB 並完成操作，不得假設先前記憶體狀態仍存在
- 站點 meta parser 必須支援無 DOM fallback，避免 service worker 環境失效
