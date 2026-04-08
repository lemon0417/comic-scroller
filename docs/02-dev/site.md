# Site 與 Pages

## 目標
- `site/` 是 GitHub Pages 的原始碼。
- extension 與網站共用同一個 repo，但分開建置與部署。
- 不再維護舊的 `gh-pages` branch 內容。

## Workspace 結構
- repo root：Chrome Extension 專案
- `site/`：Astro + Starlight 網站

## 常用指令
- `yarn site:dev`：啟動網站開發伺服器
- `yarn site:build`：建置網站
- `yarn site:preview`：預覽網站 build
- `yarn site:check`：執行 Astro 型別與內容檢查

## 部署
- GitHub Pages 來源應設為 `GitHub Actions`
- `.github/workflows/pages.yml` 會從 `master` push 自動部署 `site/`
- extension 的 `yarn build` 與網站的 `yarn site:build` 分開處理

## 維護原則
- 不要把 extension 的 `dist/` 當成 Pages 輸出
- 不要在 `gh-pages` branch 直接手改內容
- 官網內容以 `site/src/content/docs/` 為主
