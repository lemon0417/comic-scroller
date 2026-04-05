# 書庫管理頁行為

這份文件定義 `popup/manage` 內「更新 / 追蹤 / 紀錄 / 選項」四個分頁的資料語意，特別是刪除與清理流程。

## 管理頁定位
- `ManageApp` 是書庫管理入口，不是站點解析邏輯的一部分
- 資料來源統一來自 `getPopupFeedSnapshot()`
- UI 只表達目前 repository 狀態，不直接拼接舊 snapshot schema
- 任何 destructive action 都要先經過 custom dialog 確認，不使用原生 `confirm()`

## 分頁語意

### 更新
- `閱讀`：打開更新章節
- `略過`：只移除該筆 update card
- repository 對應：`dismissSeriesUpdate(site, comicsID, chapterID)`

### 追蹤
- `繼續`：打開最近可續讀章節
- `棄坑`：先開確認 dialog
- 預設行為：
  - 取消追蹤
  - 清除該作品的更新提醒
  - 保留作品資料、章節快取與閱讀紀錄
- 若勾選「一併清除閱讀紀錄與作品資料」：
  - 再額外執行作品級清理
  - 刪除 `series`
  - 刪除 `chapters`
  - 刪除 `subscriptions`
  - 刪除 `history`
  - 刪除 `updates`

### 紀錄
- `繼續`：從最後閱讀章節繼續
- `移除`：只移除該作品的閱讀紀錄
- 不會取消追蹤
- 不會刪除更新提醒
- 不會刪除作品或章節快取
- repository 對應：`removeSeriesFromHistory(site, comicsID)`

### 選項
- `匯入設定`：匯入設定與資料 dump
- `匯出設定`：匯出目前資料
- `重置資料`：清空整個 library，需經過確認 dialog

## 確認 dialog 規則
- `紀錄 -> 移除`
  - 文案必須明確說明只會移除閱讀紀錄
  - 不得暗示會清除追蹤、更新或快取
- `追蹤 -> 棄坑`
  - 預設不勾「清除資料」
  - 預設行為必須是 unsubscribe-only
  - 只有使用者明確勾選時，才允許作品級 cascade delete
- `重置資料`
  - 文案必須明確說明會刪除更新、追蹤、紀錄與作品快取

## Repository 對應
- history-only remove：`removeSeriesFromHistory(site, comicsID)`
- unsubscribe-only：`setSeriesSubscription(site, comicsID, false)` + `dismissSeriesUpdate(site, comicsID)`
- series-level cleanup：`removeSeriesCascade(site, comicsID)`
- full reset：`resetLibrary()`

## 實作約束
- 維持既有資料流：UI → reducers → epics → store
- `ManageApp` 只 dispatch action，不直接操作 IndexedDB
- popup reducer 只保存 feed 與 view state
- 真正的資料清理由 epics 呼叫 repository mutation 完成
- UI 文案必須反映實際資料語意，避免把 history remove 誤導成作品刪除
