# 政缺一咖 App

React Native + Expo 前端。

## 本機程式 + Supabase 開發專案

後端執行 `scripts/run_supabase_core.py`，前端執行 `npm run dev:supabase`，瀏覽 `http://localhost:8081`。登入頁及頂端標示 Supabase 開發版；帳號／拼單存於指定雲端開發專案，程式沒有部署。詳細測試與信箱驗證限制見後端 `docs/CORE_SUPABASE_DEV.md`。原本 `dev:local` 的 SQLite 模式仍保留。

目前可測 Google／信箱登入與自動續期、發布／搜尋／編輯／審核／退出／取消拼單、過往紀錄、公開個人資料、文字聊天室、已讀與真實未讀數量，以及 Drawer 的「拼單動態」。開發資料庫已保留七筆示範拼單及三則示範對話，提供兩步確認的個人示範資料清理入口；其他真實使用者參與的紀錄會保留。

更新前登入的頁籤請自行登出再用 Google 登入一次，取得續期憑證。新增與編輯拼單使用後端提供的資料庫時間，避免裝置時鐘不同造成截止時間錯誤。手機原生 Google 回跳、iPhone 連 Windows 本機 API 與 TestFlight 原生建置仍待完成；目前只監聽 localhost。

新增選單「偷揪 · 我的 AI 分身」：同帳號建立分身，在「我的需求」用免費本機 Qwen3.5 4B 整理中文需求及補問，再明確套用表單、親自儲存。模型對話不存入資料庫。配對後由規則規劃器預填已知費用與自願分工；未知資訊保持待補，可人工修改，改價需填原因且不能超預算。全員逐人同意同一版方案才建立既有拼單與聊天室，改版要求重新確認。預設關閉；可允許示範配對並預覽草案，但示範人物無法同意成團。手動表單與關鍵字提示保留；模型在 Windows 本機執行，尚未整合手機推播。完整啟動及測試方式見後端 `docs/CORE_SUPABASE_DEV.md`。

## 原本登入／拼單的本機 API 模式

後端啟動後執行 `npm run dev:local`，瀏覽 `http://localhost:8081`。支援本機測試信箱登入、個人資料編輯、發布、搜尋、主揪編輯、申請、主揪接受／拒絕與截止前退出。資料存於後端 SQLite，重開不會清除；其餘展示功能仍保留。完整步驟見後端專案的 `docs/CORE_LOCAL.md`。

一般 `npm start` 保留原展示模式（`EXPO_PUBLIC_CORE_API_ENABLED=false`）。SQLite 本機模式人數為 2～20 人（含主揪），不寄驗證信；Supabase 模式提供雲端登入、拼單與文字聊天。媒體上傳、手機推播與檢舉後端尚未串接；展示模式原介面保留。禁止把 Supabase MCP PAT 或 service_role key 放入任何 EXPO_PUBLIC 變數。

## 開始開發嘍

需要 Node.js 24。安裝依賴後啟動 Expo：

```bash
nvm use
npm install
npm start
```

終端機顯示 QR code 後可用 Expo Go 開啟；需要測試推播等原生能力時，改用 development build。

## 常用指令

```bash
npm run ios
npm run android
npm run web
npm run typecheck
npm run lint
npm test
```

## 目錄

- `src/app/`：Expo Router 頁面與導覽。
- `src/components/`：跨頁共用 UI 元件。
- `src/store/`：Zustand 本機狀態與操作。
- `src/lib/`：API client 與 React Query 設定。
- `src/services/`：推播等裝置服務。
- `src/data/`：後端完成前使用的展示資料。
- `src/theme/`：設計色彩、字體、間距與圓角 token。
- `src/types/`：跨模組共用的 TypeScript 型別。

## 主要路由

- `/(tabs)`：首頁、拼單、新增、訊息、個人檔案。
- `/search`：跨貼文、使用者、訊息與拼單紀錄的獨立搜尋。
- `/post/[id]`、`/order/[id]`、`/user/[name]`、`/chat/[id]`：各類詳情與互動流程。
- `/notifications`、`/preferences`、`/settings`、`/edit-profile`、`/help`：Drawer 及帳號相關功能。

## 環境變數

以 `.env.example` 建立本機 `.env`；`.env` 已由 Git 忽略，僅提交 `.env.example` 範本，不要提交私密金鑰。OpenAI 金鑰只能存在後端，不能放入 Expo App。

## 取餐地點與距離

新貼文在「拼單設定」輸入地點名稱或地址，按「搜尋地點」並選擇正確結果，即可自動儲存座標；也可使用目前位置。修改搜尋文字會清除舊的地點選擇，須重新確認才能發布，不再需要貼連結或座標。

免金鑰搜尋使用 [Photon 公開示範服務](https://github.com/komoot/photon#demo-server)（OpenStreetMap 資料），只在使用者送出搜尋時查詢，並加入記憶體快取、請求合併、節流、逾時及過期結果防護。服務沒有可用性保證，僅適合少量使用；正式流量需透過 `EXPO_PUBLIC_GEOCODER_URL` 改為自架或有保障的相容服務。搜尋詞會傳至設定的搜尋服務，不會附帶使用者定位。請保留 OpenStreetMap 來源標示。

選定地點後仍使用不需 API Key 的 [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) 開啟地圖。舊貼文缺少地點顯示「未提供」。每人預估金額以 NT$ 儲存，留白為待確認、0 為免費；人數可直接輸入正整數，沒有原先的 20 人上限。首頁與詳情共用時間、人數、金額、地點四列資訊。貼文仍沿用記憶體儲存，重新載入會重置。

使用者按「開啟定位」後，透過 Expo Location 取得前景定位權限，並在裝置上計算與取餐點的球面直線距離（公里），不是步行或開車里程。位置只保留於記憶體，可按「更新定位」重新取得；拒絕權限、逾時或定位失敗時不顯示公里數。網頁需 HTTPS 或 localhost，原生自訂 development build 加入定位套件及權限設定後需重新建置。

## TestFlight

以下是後續原生建置參考，本輪沒有執行 EAS 建置或上傳。iOS JavaScript 匯出成功不代表已完成 Xcode 簽署、實機 API 連線或原生 Google 登入；先完成這些整合再使用建置流程。

登入 Expo 與 Apple Developer 帳號後執行：

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

首次執行前需用 `eas init` 綁定 Expo 專案，並將產生的 project ID 放入 App 設定或環境變數。
