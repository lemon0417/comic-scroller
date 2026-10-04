# 漫畫櫃離線 fixtures

透過 `readSiteFixture("manhuagui", filename)` 讀取；所有 HTML／packer 只作為 parser 輸入，不執行外站腳本、不下載圖片。

## 來源

樣本於 2026-10-04 擷取；作品 HTML 於 2026-10-05 在同份離線資料上精簡，沒有重新抓取或變更簽章。

| 檔案 | 來源 | 保留內容 |
| --- | --- | --- |
| `49169.series.html` | https://www.manhuagui.com/comic/49169/ | 单话、单行本、番外篇；共 13 個代表章節 |
| `28004.series.html` | https://www.manhuagui.com/comic/28004/ | 单行本、番外篇、单话；共 23 個代表章節 |
| `910633.chapter.html` | https://www.manhuagui.com/comic/49169/910633.html | 完整圖片 packer，18 頁 |
| `844724.chapter.html` | https://www.manhuagui.com/comic/28004/844724.html | 完整圖片 packer，196 頁 |

## 精簡方式與驗證

- 作品樣本保留封面／標題、所有 h4 分組、原始 ul 分頁順序、隱藏頁與重複的 chapter-list HTML ID。
- 每個章節 ul 保留首尾各兩筆；不足四筆時全保留。額外保留 28004 的 528964、569206、778267、369532，驗證 ID 與閱讀順序不同的情況。
- 保留額外的側欄 `999999.html` 連結，驗證 parser 只收錄 chapter-list；此連結是原測試加入的排除案例，並非擷取自原站。
- 圖片 packer 完整保留；簽章只作為離線解析資料，測試不依賴其有效期限。
- metadata 測試明確列出精簡後預期章節順序，涵蓋分組、分頁反轉、title／cover、側欄排除及壓縮 __VIEWSTATE 路徑。__VIEWSTATE 測試由此 HTML 人工壓縮產生，不宣稱為該作品的實際回應。
