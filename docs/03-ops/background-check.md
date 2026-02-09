# Background Check（僅 dev）

## 用途
驗證背景更新流程：模擬訂閱掃描並回報新增更新數。

## 使用方式
1. `yarn start` 建置 dev 版本
2. 重新載入 extension（dist/）
3. Popup 右上角選單 → `Background Check`

## 輸出
會以 Chrome notification 顯示：
- checked / new / added / errors

## 注意
- 僅 dev 模式顯示
- 需要在 `chrome://extensions` 查看 service worker log
