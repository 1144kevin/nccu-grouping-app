# 政缺一咖 App

React Native + Expo 前端。

本輪測試111項通過，另有 TypeScript／ESLint、release 設定測試與 Web／iOS 離線資源匯出。完整功能缺口與實機驗收見後端 `docs/RELEASE_READINESS.md`；尚未產出簽章 App 或 TestFlight build。改動保留目前 `kevin_dev`，未自動 commit／push。

## 本機程式 + Supabase 開發專案

後端執行 `scripts/run_supabase_core.py`，前端執行 `npm run dev:supabase`，瀏覽 `http://localhost:8081`。登入頁及頂端標示 Supabase 開發版；帳號／拼單存於指定雲端開發專案，程式沒有部署。詳細測試與信箱驗證限制見後端 `docs/CORE_SUPABASE_DEV.md`。原本 `dev:local` 的 SQLite 模式仍保留。

目前可測 Google／信箱登入與自動續期、發布／搜尋／編輯／審核／退出／取消拼單、過往紀錄、公開個人資料、文字聊天室、已讀與真實未讀數量，以及 Drawer 的「拼單動態」。開發資料庫已保留七筆示範拼單及三則示範對話，提供兩步確認的個人示範資料清理入口；其他真實使用者參與的紀錄會保留。

更新前登入的頁籤請自行登出再用 Google 登入一次，取得續期憑證。新增與編輯拼單使用後端提供的資料庫時間，避免裝置時鐘不同造成截止時間錯誤。手機原生 Google 回跳程式已加入但預設未啟用，需精確 App 回呼 allowlist 與原生開發版本；iPhone 連 Windows 本機 API、簽章與 TestFlight 原生建置仍待完成，目前只監聽 localhost。

新增實際連線功能：帳號通知／推薦偏好、首頁「依我的偏好」規則排序、本人沒興趣／截止提醒、聊天室個人封存與靜音、私人問題回報／檢舉及自己的回報紀錄。截止提醒僅在 App 前景頁面查看，沒有手機推播；回報收到不代表已處置。搜尋可切換公開使用者、目前有權進入之聊天室訊息、自己相關的已結束拼單，不搜尋信箱或陌生人的私人對話。App 進入背景後暫停頁面輪詢與已讀提交。原本展示模式保留。

新增選單「偷揪 · 我的 AI 分身」：同帳號建立分身，在「我的需求」用免費本機 Qwen3.5 4B 整理中文需求及補問，再明確套用表單、親自儲存。模型對話不存入資料庫。配對後由規則規劃器預填已知費用與自願分工；未知資訊保持待補，可人工修改，改價需填原因且不能超預算。全員逐人同意同一版方案才建立既有拼單與聊天室，改版要求重新確認。預設關閉；可允許示範配對並預覽草案，但示範人物無法同意成團。手動表單與關鍵字提示保留；模型在 Windows 本機執行，尚未整合手機推播。完整啟動及測試方式見後端 `docs/CORE_SUPABASE_DEV.md`。

Supabase 發文現可加入單張 JPEG／PNG 附圖（4 MiB、1600萬像素以內），後端轉為縮小且移除 EXIF 的 JPEG，與拼單一起發布。預覽只在本機，發布後其他登入使用者可見；原始照片不會被修改。失敗保留草稿，重試不重複上傳／建單；帳號設定可兩步清理未發布副本。每帳號20份、開發專案100份圖片預留；已發布附圖暫不提供更換或移除。完整權限與後端私人驗證金鑰設定見後端 `docs/CORE_SUPABASE_DEV.md`。iPhone 選圖／HEIC 轉換仍待實機驗證。

## 原本登入／拼單的本機 API 模式

後端啟動後執行 `npm run dev:local`，瀏覽 `http://localhost:8081`。支援本機測試信箱登入、個人資料編輯、發布、搜尋、主揪編輯、申請、主揪接受／拒絕與截止前退出。資料存於後端 SQLite，重開不會清除；其餘展示功能仍保留。完整步驟見後端專案的 `docs/CORE_LOCAL.md`。

一般 `npm start` 保留原展示模式（`EXPO_PUBLIC_CORE_API_ENABLED=false`）。SQLite 本機模式人數為 2～20 人（含主揪），不寄驗證信；Supabase 模式提供雲端登入、拼單、文字聊天與上述帳號功能。語音上傳、手機推播、完整管理回報流程尚未串接；展示模式原介面保留。禁止把 Supabase MCP PAT 或 service_role key 放入任何 EXPO_PUBLIC 變數。

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

先執行 `npm run ios:preflight`；`npm run ios:preflight:release` 在未設定可達 HTTPS API 時應失敗。`npm run test:release-config` 是離線設定檢查，不會啟動 EAS 或消耗建置額度。`app.config.js` 會在 production profile 阻止把 localhost／展示模式當正式連線版本。完整 Mac、原生 Google 回呼及目前連線限制請讀取後端專案 `docs/IPHONE_TESTFLIGHT.md`。

以下是後續原生建置參考，本輪沒有執行 EAS 建置或上傳。iOS JavaScript 匯出成功不代表已完成 Xcode 簽署、實機 API 連線或原生 Google 登入；先完成這些整合再使用建置流程。

登入 Expo 與 Apple Developer 帳號後執行：

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

首次執行前需用 `eas init` 綁定 Expo 專案，並將產生的 project ID 放入 App 設定或環境變數。

## 雲端封鎖與帳號刪除

Supabase 模式個人公開頁可二次確認封鎖／解除；「帳號與隱私」管理本人名單。封鎖立即清掉本人快取，限制雙向貼文、申請、聊天、搜尋、圖片與偷揪互動；已接受團員仍能查看必要紀錄及退出。

同頁可預覽刪除影響，15分鐘內的新登入、10分鐘確認碼與手動輸入 DELETE 都具備才開始清理。清理會移除本人 Auth 與 App 關聯資料、真實圖片；本人主揪／示範批次拼單與聊天室也會移除。中斷後重新登入同帳號可續作，未完成不顯示成功。Google 帳號／原始手機照片／他人副本及備份不承諾即時清除。完整 API、隔離測試與限制見後端 docs/CORE_SUPABASE_DEV.md。保留原展示與 SQLite 模式；沒有部署、付費服務或 push。

## Mac 與 iPhone 交接入口

先讀後端專案 `docs/IPHONE_TESTFLIGHT.md` 的最短流程。Mac 安裝鎖定依賴後：

```bash
npm ci
npm run apple:configure -- --profile simulator
npm run apple:check
npm run apple:simulator
```

連線設定僅存在忽略的 `.local/apple-dev.json`。iPhone 內網測試需先備妥受信任TLS、精確裝置白名單與手動啟動後端，再用 `apple:configure -- --profile device --api https://電腦內網IP:8443/api/v1`、`apple:device`。不使用 Expo Go 驗收 Google 原生回跳。這些原生動作在 Windows 會拒絕，不會啟動 EAS、部署或上傳。

未來可用 `apple:configure -- --profile release --api https://你的API網域/api/v1` 切換真正HTTPS API，再執行 `apple:check`／Mac `apple:prepare-release`；這只準備 App，後端正式公開runtime與部署仍需另行驗收。Simulator／device以Release configuration內嵌JS，改網址或程式後重建，不依賴Metro區網連線。

Supabase連線build停用尚未提供的麥克風／相機／背景音訊權限，保留本人觸發照片選取及定位；展示模式原錄音保留。App帳號設定新增唯讀連線與功能狀態檢查。實機結果請記錄於後端 `docs/DEVICE_ACCEPTANCE.csv`。
