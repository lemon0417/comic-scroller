# Release 流程

## 版本更新
- 使用 `yarn version:bump <major|minor|patch|x.y.z>`
- 會同步更新 `package.json` + `manifest.json` + `manifest.dev.json`

## 產出
- `yarn release` 會產出：
  - `comic-scroller-<version>.zip`
  - `comic-scroller-<version>.crx`

## CRX 簽章金鑰
- CRX 使用固定 private key 簽章，確保 extension ID 穩定。
- CI / 本機都透過 `CHROME_EXTENSION_PRIVATE_KEY_B64` 提供金鑰。
- Secret 內容應為 PEM private key 的 base64 字串。
- build / release 若拿得到這把 key，輸出的 `dist/manifest.json` 也會自動注入對應的 `key` 欄位，讓 zip / unpacked build 維持同一個 extension ID。

### 產生 base64 Secret
```bash
base64 < release-key.pem | tr -d '\n'
```

### 本機執行
```bash
export CHROME_EXTENSION_PRIVATE_KEY_B64="$(base64 < release-key.pem | tr -d '\n')"
yarn release
```

### 只固定 unpacked ID
若你不需要在本機簽 CRX，也可以只提供 public key：
```bash
export CHROME_EXTENSION_PUBLIC_KEY="$(openssl rsa -in release-key.pem -pubout | sed '/BEGIN PUBLIC KEY/d;/END PUBLIC KEY/d' | tr -d '\n')"
yarn build
```

## 安裝限制
- GitHub Release 產出的 CRX 是自簽章附件，不是 Chrome Web Store 轉出的 CRX。
- 這類 CRX 主要用於：
  - 開發者模式 / 手動打包驗證
  - policy / 自架更新流程
- 一般使用者若只是要手動載入，仍以 zip / unpacked `dist/` 最穩定。

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
  - 以 `CHROME_EXTENSION_PRIVATE_KEY_B64` 簽出 CRX
  - 產生 Release Notes（Conventional Commits / Angular preset）
  - 上傳 zip / crx 並建立 GitHub Release

## Tag 規範
- 支援 `v4.0.52` 或 `4.0.52`
- Release Notes 會取「前一個同 prefix tag」到「當前 tag」的 commits
