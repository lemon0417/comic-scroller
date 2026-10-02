# 書庫管理頁行為

這份文件定義 `popup/manage` 內「更新 / 追蹤 / 紀錄 / 選項」四個分頁的資料語意，以及 app 共用的取消追蹤與清理流程。

## 管理頁定位
- `ManageApp` 是書庫管理入口，不是站點解析邏輯的一部分
- 資料來源統一來自 `getPopupFeedSnapshot()`
- UI 只表達目前 repository 狀態，不直接拼接舊 snapshot schema
- 任何 destructive action 都要先經過 custom dialog 確認，不使用原生 `confirm()`

## 作品快取語意
- 作品的 `chapterList / chapters` 屬於章節快取，不是每部作品都必須永久保存的核心資料
- 章節快取主要用於：
  - reader 章節列表
  - popup/manage 的章節標題摘要
  - background 更新比對
- `紀錄 -> 移除`、未勾選清除資料的 `棄坑`、以及 `更新 -> 略過` 都不會直接做作品級 cascade delete
- 「清除資料」、「清理未追蹤作品」或全量 `重置資料` 會保證刪掉指定範圍的作品快取
- 取消追蹤、移除紀錄或略過更新時，若作品已不再被 `追蹤 / 紀錄 / 更新` 任一列表引用，repository 會回收殘留的 `series / chapters / reads`
- 沒有時間到期或全庫定期 GC；仍有閱讀紀錄或更新提醒的未追蹤漫畫可能長期保留資料
- 閱讀紀錄超出 50 筆後被擠出的作品，也可能留下孤兒快取，可用「清理未追蹤作品」手動回收

## 分頁語意

### 更新
- `閱讀`：打開更新章節
- `略過`：只移除該筆 update card
- repository 對應：`dismissSeriesUpdate(site, comicsID, chapterID)`

### 追蹤
- `繼續`：打開最近可續讀章節
- `棄坑`：與 app 的「取消追蹤」共用確認 dialog
- 預設行為：
  - 取消追蹤
  - 清除該作品的更新提醒
  - 預設勾選「一併清除閱讀紀錄與作品資料」，完整刪除 `series / chapters / reads / subscriptions / history / updates`
  - 關閉此作品已開啟的閱讀分頁；app 發起時先更新 badge 並完成同步嘗試，再關閉自身分頁
- 取消勾選時只取消追蹤與清除全部更新提醒，保留閱讀紀錄、已讀狀態與仍被引用的快取；失去所有列表引用的快取仍會回收

### 紀錄
- `繼續`：從最後閱讀章節繼續
- `移除`：只移除該作品的閱讀紀錄
- 不會取消追蹤
- 不會刪除更新提醒
- 不會直接做作品級刪除
- 若移除後該作品已沒有任何追蹤、更新或紀錄引用，殘留快取會被 repository 自動 GC
- repository 對應：`removeSeriesFromHistory(site, comicsID)`

### 選項
- `匯入設定`：支援 legacy JSON、dump v1、dump v2、plain JSON bytes、`.json.gz`
- `匯出設定`：匯出 compact dump v2，預設下載為 `.json.gz`
- `清理未追蹤作品`：先經過確認 dialog，在執行當下清除所有未追蹤作品的資料、閱讀紀錄、已讀狀態、更新提醒與章節快取；包含從未追蹤的漫畫和孤兒附屬資料，保留所有已追蹤作品
  - 成功後顯示實際清理數量；零筆時顯示沒有需要清理的作品
  - 關閉已刪除作品的閱讀分頁；既有未追蹤資料不會在升級時自動刪除
- `重置資料`：清空整個 library，需經過確認 dialog
- `同步精簡書庫`：
  - 使用 `chrome.storage.sync` 同步追蹤、閱讀紀錄、更新狀態與必要章節摘要
  - 不同步完整章節快取；IndexedDB 仍是本機 source of truth
  - 啟用時會先 pull / merge 遠端，再 push 合併結果
  - 匯入、重置、移除、取消追蹤、批次清理、略過更新後，若同步已啟用，會嘗試 push 最新精簡資料
  - 同步大小、上次同步、遠端更新時間與錯誤顯示在選項頁
  - 超過 Chrome Sync 配額時顯示錯誤，使用者仍可改用完整匯出備份
  - 同步失敗不回滾本機清理；v1 沒有刪除標記，其他裝置的舊資料仍可能在合併後重新出現

## 確認 dialog 規則
- `紀錄 -> 移除`
  - 文案必須明確說明只會移除閱讀紀錄
  - 不得暗示會清除追蹤、更新或快取
- `追蹤 -> 棄坑`
  - 共用標題「取消追蹤作品」與按鈕「確認取消追蹤」
  - 每次開啟皆預設勾選「清除資料」，不記住上次取消勾選的選擇
  - 文案明示清理無法復原，並會關閉相關閱讀分頁；取消勾選可保留閱讀紀錄
- `清理未追蹤作品`
  - 文案必須明示會清除從未追蹤、只有閱讀紀錄的作品，並保留已追蹤作品
- `重置資料`
  - 文案必須明確說明會刪除更新、追蹤、紀錄與作品快取

## Repository 對應
- history-only remove：`removeSeriesFromHistory(site, comicsID)`
- shared unsubscribe：`unsubscribeSeriesByKey(seriesKey, { clearSeriesData })`；清理選擇必須明確傳入，取消追蹤與移除提醒在同一 transaction 完成
- series-level cleanup：`removeSeriesCascade(site, comicsID)`
- batch cleanup：`cleanupUnsubscribedSeries()`；在同一 transaction 篩選與刪除，回傳清理數量與剩餘更新數，失敗則回滾
- full reset：`resetLibrary()`
- lightweight sync：`setLibrarySyncEnabled(enabled)`、`syncLibraryNow()`、`pushLibrarySyncIfEnabled()`

## 實作約束
- 維持既有資料流：UI → reducers → epics → store
- `ManageApp` 只 dispatch action，不直接操作 IndexedDB
- popup reducer 只保存 feed 與 view state
- 真正的資料清理由 epics 呼叫 repository mutation 完成
- UI 文案必須反映實際資料語意，避免把 history remove 誤導成作品刪除
