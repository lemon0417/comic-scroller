# 站點變更 Checklist

Codex 處理站點 / parser / manifest / DNR / redirect 類任務時，優先使用 `$comic-scroller-site-adapter`。本文件是人類與 skill 共同引用的 canonical checklist。

新增或調整站點時，先確認變更屬於 metadata、背景章節快照、reader 圖片解析、redirect、manifest 權限或 DNR header 規則。

## 必查位置
- Metadata adapter：`src/sites/<site>/adapter.ts`、`src/sites/<site>/meta.ts`
- 背景章節來源：registry 呼叫 `fetchMeta(url, { includeCover: false })`，再投影成 `chapterList + chapters` 快照，保留可選 `chapterGroups`；各站仍可在 metadata fetcher 內選擇 RSS、API 或作品 HTML
- Metadata registry：`src/sites/registry.ts`
- Reader epic：`src/epics/sites/<site>.ts`
- Reader epic registry：`src/epics/sites/registry.ts`
- Pure parser / resolver：`src/sites/<site>/`
- Manifest host permissions：`src/manifest/manifest.json`、`src/manifest/manifest.dev.json`
- Background redirect：`src/infra/services/background.ts`
- DNR header 規則：`public/rules.json`

## 規則
- `src/sites/**` 不得 import `src/epics/**`
- 會在 MV3 background 執行的站點 parser 不得依賴 DOM；若同一 parser 也提供 DOM 路徑，兩種 runtime 行為都必須有測試
- metadata fetcher 在 Observable unsubscribe 時必須中止尚未完成的 HTTP request，讓 background timeout 能釋放實際網路資源
- background 消費 `chapterList + chapters` 與可選分組資訊；站點可使用 RSS、API 或作品 HTML，但不得藉此覆寫既有 title、cover、作品 URL 或閱讀狀態
- 分組必須唯一、非空且完整對應平面章節順序；分組 key 不可依賴畫面位置。背景分組 checkpoint 是本機可重建資訊，應在同一 transaction 更新並在 progress / sync mutation 保留。
- 新增跨站來源時，同步評估 production/dev manifest 的 `host_permissions`
- 需要 Referer / Cookie / header 修改時，優先用 DNR，不新增 content script 或 webRequest
- 付費、失敗、timeout 與 retry 狀態要明確回到 reader 流程，不讓 UI 永久卡在 loading

## Fallback 保留政策
- 只保留有明確來源差異的相容分支，例如站點提供的替代資料源、已持久化的 legacy URL、MV3 no-DOM runtime、已觀察到的 response schema，以及付費／timeout／retry 狀態
- primary 與 fallback 路徑都要有 focused test；外站 response 以不連網的 fixture 固定格式，並在測試名稱或站點文件說明對應 schema
- 同一份 HTML 不維護功能重疊的 DOM 與字串 parser；除非兩者服務不同 runtime 或可證明的格式差異
- 不以任意陣列、任意 URL 或空值補齊未知 response；無法辨識時應進入既有 error／retry 流程
- 網路 retry 必須有 timeout、backoff 或明確的重新觸發時機；已有相同 URL request 失敗時，不立即無退避重送

## 測試
- Metadata：`src/sites/__tests__/<site>.meta.test.ts`
- Reader parser / resolver：`src/epics/sites/<site>*.test.ts`
- 共用 reader orchestration：`src/epics/sites/readerFlow.test.ts`
- Background redirect 或通知：`src/infra/services/background.test.ts`
