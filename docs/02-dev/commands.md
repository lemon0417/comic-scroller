# 開發指令

## 基本
- `yarn install`：安裝依賴
- `yarn start`：dev build（watch），輸出至 `dist/`
- `yarn build`：production build

## 品質檢查
- `yarn lint` / `yarn lint:fix`
- `yarn test`
- `yarn typecheck`

## 事件追蹤（Debug Logger）
- `localStorage.setItem("CS_DEBUG", "1")` 後重新整理即可啟用
- `localStorage.removeItem("CS_DEBUG")` 後重新整理即可關閉

## 發佈與版本
- `yarn version:bump <major|minor|patch|x.y.z>`：同步更新 `package.json` + 兩份 manifest
- `yarn verify:release`：檢查版本一致
- `yarn zip`：產出 `comic-scroller-<version>.zip`（內容為 `dist/`，不含目錄層）
- `yarn release`：verify → lint → test → build → zip

## 必要前置
- 使用 Yarn 4（Corepack）：
  - `corepack enable`
  - `corepack prepare yarn@4.0.2 --activate`
