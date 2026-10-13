# 政缺一咖 App

React Native + Expo 前端。

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

登入 Expo 與 Apple Developer 帳號後執行：

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

首次執行前需用 `eas init` 綁定 Expo 專案，並將產生的 project ID 放入 App 設定或環境變數。
