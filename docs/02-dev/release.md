# Release 流程

## 版本更新
- 使用 `yarn version:bump <major|minor|patch|x.y.z>`
- 會同步更新 `package.json` + `manifest.json` + `manifest.dev.json`

## 產出
- `yarn release` 會產出 `comic-scroller-<version>.zip`

## GitHub Actions
- `Release` workflow 會：
  - 執行 `yarn release`
  - 產生 Release Notes（Conventional Commits / Angular preset）
  - 上傳 zip 檔與建立 GitHub Release

## Tag 規範
- 支援 `v4.0.52` 或 `4.0.52`
- Release Notes 會取「前一個同 prefix tag」到「當前 tag」的 commits
