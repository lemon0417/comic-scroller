# 擴充功能規範（硬性）

## 基本原則
- **純前端**：不得引入後端服務或外部執行環境。
- **不手改 dist/**：一律用建置流程產出。
- **維持資料流**：UI → reducers → epics → store。

## Manifest 與權限
- 使用 **MV3** service worker：`js/background.js`
- Header 修改使用 `declarativeNetRequest`（`public/rules.json`）
- 如需新增站點，必須更新 `src/manifest/manifest.json` 的 `host_permissions`

## CSP 與安全
- extension pages 嚴禁 `unsafe-eval`
- 解析流程避免動態執行 script，改用字串解析/解碼
