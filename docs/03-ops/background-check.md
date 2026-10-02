# Background Check（僅 dev）

## 用途
驗證背景更新流程：實際掃描已追蹤作品，刷新章節快取、更新提醒與 badge。

## 使用方式
1. `yarn start` 建置 dev 版本
2. 重新載入 extension（dist/）
3. 開啟 `manage.html` → `開發者` → `執行背景檢查`
4. 也可直接開啟 `manage.html?tab=developer`

## 輸出
結果直接顯示在頁籤內，不額外建立 Chrome notification：
- 完成時間、檢查作品數、有更新作品數、新增提醒數、錯誤數
- 沒有追蹤作品時正常顯示零筆；部分作品失敗仍顯示本輪結果
- 執行中禁止重複送出，並停用同一 manage 頁面的書庫寫入操作
- 等待回應超過 120 秒會顯示可重試錯誤；背景工作可能仍在執行

## 更新語意
- 每輪最多處理 20 本，站點 HTTP concurrency 固定為 4，單筆 request 有 timeout
- DM5 使用 RSS-first 章節來源；SF／ComicBus 目前由作品 HTML 投影章節快照
- 背景只刷新完整章節快照與 updates，不更動 title、cover、作品 URL 或閱讀進度
- 同一輪 repository invalidation 會合併成一個 library signal

## 注意
- 僅 `development` 模式提供入口；正式版與其他 mode 都不提供
- 多次請求或定時掃描撞期時共用既有執行中工作
- 需要在 `chrome://extensions` 查看 service worker log
