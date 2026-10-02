# 開發指令

## 基本
- `yarn install`：安裝依賴
- `yarn start`：dev build（watch），輸出至 `dist/`
- `yarn build`：production build
- `yarn verify`：CI 等價檢查（lint → typecheck → test → build → site check/build）
- `yarn site:dev`：啟動 `site/` 的 Astro 開發伺服器
- `yarn site:build`：建置 GitHub Pages 網站
- `yarn site:preview`：預覽 `site/` build 結果
- `yarn site:check`：執行 Astro 檢查
- `yarn release:metadata`：生成 `latest-release.json` release metadata asset

## 品質檢查
- `yarn lint` / `yarn lint:fix`
- `yarn test`
- `yarn typecheck`

## 事件追蹤（Debug Logger）
- 先用 `yarn start` 建置 development 版本，再開啟 `manage.html` → `開發者` → `除錯記錄`
- `開發者` 頁籤也提供「執行背景檢查」，結果直接顯示於頁籤內。
- `yarn build` / `yarn release` 不包含開發者面板、除錯 logger 或手動背景檢查入口；建置時會自動驗證隔離。
- development 版本也可手動設定：
  - `localStorage.setItem("CS_DEBUG", "1")`
  - `localStorage.removeItem("CS_DEBUG")`

## 發佈與版本
- `yarn version:bump <major|minor|patch|x.y.z>`：同步更新 `package.json` + 兩份 manifest
- `yarn verify:release`：檢查 `package.json`、兩份 manifest 與 release tag 版本一致
- `yarn crx`：以 `CHROME_EXTENSION_PRIVATE_KEY_B64` 產出 `comic-scroller-<version>.crx`
- `yarn zip`：產出 `comic-scroller-<version>.zip`（內容為 `dist/`，不含目錄層）
- `yarn release:notes`：產生 `release-notes.txt`
- `yarn release`：verify:release → lint → typecheck → test → build → zip → crx

## 必要前置
- 使用 `.nvmrc` 指定的 Node 與 `package.json#packageManager` 指定的 Yarn（Corepack）：
  - `corepack enable`
- 不要用 npm / npx 安裝或執行專案工具
- 產出 CRX 前需設定 `CHROME_EXTENSION_PRIVATE_KEY_B64`
- 若 `build / release` 時有提供 `CHROME_EXTENSION_PRIVATE_KEY_B64` 或 `CHROME_EXTENSION_PUBLIC_KEY`，輸出的 `dist/manifest.json` 會自動注入 `key`，讓 unpacked 版本也能維持固定 extension ID
- GitHub Pages 網站原始碼位於 `site/`，與 extension 分開建置
