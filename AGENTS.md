# Repository Guidelines

## 專案基礎
- 純前端 Chrome Extension（MV3）。
- 主要入口：app（閱讀）、popup（彈窗）、background（service worker）。

## 核心規範
- **不得引入後端服務**。
- **維持既有資料流**：UI → reducers → epics → store。
- **禁止手改 `dist/`**。
- **使用 Yarn（不得使用 npm）**。
- **所有提交必須符合 Conventional Commits**。

## 文件索引
入口：`docs/index.md`

重點文件：
- `docs/01-overview/extension-rules.md`
- `docs/01-overview/architecture.md`
- `docs/02-dev/commands.md`
- `docs/02-dev/toolchain.md`
- `docs/04-sites/dm5.md`
