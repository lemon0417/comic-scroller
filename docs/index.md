# 文件索引

這份索引只保留「目前狀態」與「必須知道的規範」。細節分散在各分類目錄。

## 01 專案概覽
- `docs/01-overview/README.md`: 專案概覽與目錄結構
- `docs/01-overview/architecture.md`: 資料流與模組邊界
- `docs/01-overview/extension-rules.md`: 擴充功能硬性規範

## 02 開發與工具
- `docs/02-dev/commands.md`: 常用指令與開發流程
- `docs/02-dev/site.md`: GitHub Pages 網站與 workspace 結構
- `docs/02-dev/testing.md`: 測試框架與重點範圍
- `docs/02-dev/toolchain.md`: 目前工具鏈與版本基準
- `docs/02-dev/release.md`: 版本更新與 Release 流程

## 03 功能行為
- `docs/03-features/manage.md`: 書庫管理頁的資料語意與刪除規則
- `docs/03-features/library.md`: 書庫 runtime / dump / legacy 匯入資料模型

## 03-ops 營運與維護
- `docs/03-ops/background-check.md`: 背景更新檢查（僅 dev）

## 04 站點解析（商務邏輯）
- `docs/04-sites/README.md`: 站點 adapter / parser 變更 checklist
- `docs/04-sites/dm5.md`: DM5 解析流程（含 chapterfun.ashx）
- `docs/04-sites/8comic.md`: 8comic 公開閱讀、圖片解碼與 ComicBus 資料清理
- `docs/04-sites/manhuagui.md`: 漫畫櫃章節分組、圖片解碼與更新流程
- `docs/04-sites/baozimh.md`: 包子漫畫資料來源、目錄分組與多頁章節合併

## 任務入口
- Reader UI / 閱讀控制：`docs/01-overview/architecture.md`、`src/ui/containers/App/`、`src/ui/containers/ImageContainer/`
- Reader state / scroll / preload：`docs/01-overview/architecture.md`、`src/domain/reducers/comics.ts`、`src/epics/scrollEpic.ts`、`src/epics/sites/readerFlow.ts`
- Popup / Manage：`docs/03-features/manage.md`、`src/ui/containers/PopupApp/`、`src/ui/containers/ManageApp/`、`src/epics/popup/`
- Library repository：`docs/03-features/library.md`、`src/infra/services/library/`
- Background / release notice：`docs/03-ops/background-check.md`、`src/infra/services/background.ts`、`src/infra/services/extensionRelease.ts`
- Site parser / 新站點：先用 `$comic-scroller-site-adapter`，再看 `docs/04-sites/README.md` 與站點專屬文件
- Release / 版本：`docs/02-dev/release.md`、`scripts/verify-release.mjs`
- Pages site：`docs/02-dev/site.md`、`site/`
