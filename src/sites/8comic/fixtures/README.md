# 8comic 離線 fixtures

擷取日期：2026-10-05。透過 `readSiteFixture("8comic", filename)` 讀取；所有腳本只作為字串輸入，不執行、不連網下載圖片。

| 檔案 | 來源 | 保留內容 |
| --- | --- | --- |
| `series-105.html` | https://www.8comic.com/html/105.html | 全職獵人；話／卷首尾各兩筆，共 8 章 |
| `series-1551.html` | https://www.8comic.com/html/1551.html | 銀魂；話／卷首尾各兩筆，共 8 章 |
| `chapter-105-420.html` | https://articles.onemoreplace.tw/online/new-105.html?ch=420 | 完整 192 筆圖片表與解碼腳本片段；420 話 16 頁 |
| `chapter-1551-704.html` | https://articles.onemoreplace.tw/online/new-1551.html?ch=704 | 完整 578 筆圖片表與解碼腳本片段；704 話 60 頁 |

- 章節頁擷取時使用對應作品頁 Referer，不使用登入 cookie。
- 作品頁保留原始 id/name/pic meta、chapters 容器、Ch/Vol anchor 及最新章節內的 isnew 腳本，驗證標題不包含腳本文字。省略中段章節，保留原始組內順序。
- 章節頁保留完整編碼字串、數字綁定、substring helper、欄位讀取、章節選擇與圖片組合；移除廣告、導覽、捲動載入與無關的 fz 值。HTML 外殼為精簡後重建。
- 兩個真實回應的欄位順序不同：105 為 server/pages/chapter/seed/part；1551 為 server/seed/pages/chapter/part。
- 頁數、首尾圖片 URL 與章節順序在測試中明確列出。更名變數、split part、惡意 host、錯誤 stride 等案例是測試加工的邊界資料，不宣稱為原站回應。
