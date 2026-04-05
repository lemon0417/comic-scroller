# Release 流程

## 版本更新
- 使用 `yarn version:bump <major|minor|patch|x.y.z>`
- 會同步更新 `package.json` + `manifest.json` + `manifest.dev.json`

## 產出
- `yarn release` 會產出 `comic-scroller-<version>.zip`

## Release 前檢查
### 自動化
- `yarn verify:release`
- `yarn lint`
- `yarn typecheck`
- `yarn test --runInBand`
- `yarn build`

### 手動 Smoke
- `popup.html`
  - 可看到更新數量與列表
  - `繼續` / `閱讀` 會開到正確 reader 頁
  - `管理` 可開啟 `manage.html`
- `manage.html`
  - `更新 / 追蹤 / 歷史 / 選項` 分頁可切換
  - 長列表可正常捲動，不出現雙重捲軸
  - `棄坑`、`移除`、`略過`、匯入匯出可正常操作
  - `除錯記錄` 開關可切換
- `app.html`
  - header 的上一章 / 下一章 / 追蹤 / 章節按鈕可操作
  - 章節彈窗可開啟、關閉、定位到目前章節，且不出現水平捲軸
  - 圖片列表可正常捲動與載入
- DM5
  - 一般章節可正常載入圖片
  - 付費章節顯示付費提示，不會卡住 loading
  - `前往 DM5 章節頁` 會回原站，不會再被重導回 reader

## GitHub Actions
- `Release` workflow 會：
  - 執行 `yarn release`
  - 產生 Release Notes（Conventional Commits / Angular preset）
  - 上傳 zip 檔與建立 GitHub Release

## Tag 規範
- 支援 `v4.0.52` 或 `4.0.52`
- Release Notes 會取「前一個同 prefix tag」到「當前 tag」的 commits
