# 工具鏈現況

以下為「目前專案實際狀態」，用於快速對齊開發環境。

## Node / Yarn
- Node：`24.13.0`（`.nvmrc`）
- Yarn：`4.0.2`（Corepack）

## 前端主依賴
- React：`19.1.1`
- Redux：`5.0.1`
- Redux Observable：`3.0.0-rc.3`
- RxJS：`7.8.2`

## 建置與工具
- Vite：`7.3.1`
- TypeScript：`5.9.2`
- ESLint：`9.18.0`
- Prettier：`3.6.2`
- Jest：`29.7.0`
- Tailwind CSS：`^3.4.0`
- PostCSS：`^8.4.0`（`tailwindcss` / `postcss-nested` / `autoprefixer`）

### ESLint 原則
- 使用 ESLint 9 flat config，基底由 `@eslint/js`、`@typescript-eslint`、`eslint-plugin-react`、`eslint-plugin-react-hooks`、`eslint-plugin-jsx-a11y`、`eslint-plugin-import` 的 recommended 規則組成。
- 不啟用 type-aware lint 全套規則，避免目前專案的 lint 成本與配置複雜度過高；型別正確性以 `yarn typecheck` 負責。
- `@typescript-eslint/no-explicit-any` 目前先設為 `warn`，用來讓 legacy `any` 可見化，但不阻斷既有開發流程；測試檔有較寬鬆 override。
- 測試檔不再整包忽略，改用 test-specific override 管理 Jest globals 與少數測試必要寫法。
- `reportUnusedDisableDirectives` 設為 `warn`，避免長期累積失效的 `eslint-disable` 註解。
- `no-restricted-imports` 會限制 repository 邊界：
  - app code 不得再從 `@infra/services/library` 主 barrel 匯入
  - 非 repository 實作不得直接匯入 `library/shared|queries|mutations|compat|signal`
  - reader / popup / background 必須使用各自的 scene facade

## Extension
- Manifest：MV3
- Header 規則：`public/rules.json`（DNR）

## TypeScript 型別來源
- Chrome Extension API 使用官方 `chrome-types`，不要長期維護自製整包 `chrome` global 宣告。
- Vite / SVGR / CSS / HMR 優先使用工具鏈內建型別：`vite/client`、`vite-plugin-svgr/client`。
- `src/types/` 只保留真的無法由依賴套件提供、且範圍足夠小的 local declarations。

## UI 命名規則
- 共用 primitive class 使用 `ds-*`。
- 頁面殼層使用 `popup-*`、`manage-*`、`reader-*`。
- 元件自身結構使用 component-owned class，例如 `series-row__summary`。
- 需要頁面差異時，優先使用顯式 variant class，例如 `series-row--popup`，不要用祖先 selector 偷改共用元件內部結構。
