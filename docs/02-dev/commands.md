# 開發指令

## 基本
- `yarn install`：安裝依賴
- `yarn start`：dev build（watch），輸出至 `dist/`
- `yarn build`：production build
- `yarn site:dev`：啟動 `site/` 的 Astro 開發伺服器
- `yarn site:build`：建置 GitHub Pages 網站
- `yarn site:preview`：預覽 `site/` build 結果
- `yarn site:check`：執行 Astro 檢查

## 品質檢查
- `yarn lint` / `yarn lint:fix`
- `yarn test`
- `yarn typecheck`

## 事件追蹤（Debug Logger）
- 開啟 `manage.html` → `選項` → `開發者功能` → `除錯記錄`
- 也可手動設定：
  - `localStorage.setItem("CS_DEBUG", "1")`
  - `localStorage.removeItem("CS_DEBUG")`

## 發佈與版本
- `yarn version:bump <major|minor|patch|x.y.z>`：同步更新 `package.json` + 兩份 manifest
- `yarn verify:release`：檢查版本一致
- `yarn crx`：以 `CHROME_EXTENSION_PRIVATE_KEY_B64` 產出 `comic-scroller-<version>.crx`
- `yarn zip`：產出 `comic-scroller-<version>.zip`（內容為 `dist/`，不含目錄層）
- `yarn release`：verify → lint → test → build → zip → crx

## 必要前置
- 使用 Yarn 4（Corepack）：
  - `corepack enable`
  - `corepack prepare yarn@4.0.2 --activate`
- 產出 CRX 前需設定 `CHROME_EXTENSION_PRIVATE_KEY_B64`
- 若 `build / release` 時有提供 `CHROME_EXTENSION_PRIVATE_KEY_B64` 或 `CHROME_EXTENSION_PUBLIC_KEY`，輸出的 `dist/manifest.json` 會自動注入 `key`，讓 unpacked 版本也能維持固定 extension ID
- GitHub Pages 網站原始碼位於 `site/`，與 extension 分開建置
