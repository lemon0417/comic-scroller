# DM5 解析流程

本文件保留核心解析鏈路，供維護與除錯使用。

## 1) 入口
使用者進入章節頁（例：`https://www.dm5.com/m1753397/`），背景會導向：
```
chrome-extension://<ext-id>/app.html?site=dm5&chapter=m1753397
```

## 2) 章節頁抓取
來源：`src/epics/sites/dm5.ts`（`fetchImgs$`）

從章節 HTML 解析：
- `DM5_IMAGE_COUNT`
- `DM5_CID` / `DM5_CURL`
- `DM5_MID`
- `DM5_VIEWSIGN_DT` / `DM5_VIEWSIGN`
- `DM5_KEY`（可為空）

## 3) chapterfun.ashx（中介）
```
https://www.dm5.com/<DM5_CURL>/chapterfun.ashx
  ?cid=<DM5_CID>
  &page=<page>
  &key=<DM5_KEY>
  &language=1
  &gtk=6
  &_cid=<DM5_CID>
  &_mid=<DM5_MID>
  &_dt=<DM5_VIEWSIGN_DT>
  &_sign=<DM5_VIEWSIGN>
```
回應為 obfuscated script（packer 格式）。

## 4) 解包與解析
解出：
- `pix`：CDN base URL
- `pvalue` / `d` / `hd_c`：圖片路徑
- 可能包含 `cid` / `key`

取第一張圖片路徑作為該頁 URL 來源。

## 5) 最終圖片 URL
```
<pix>/<image-path>?cid=<cid>&key=<key>
```
若 script 未提供 `cid/key`，則回退到章節頁解析的值。

## 6) Header 規則
CDN 需要 Referer 與成人 Cookie，由 `public/rules.json` 注入：
- `Referer: https://www.dm5.com/m`
- `Cookie: isAdult=1`
