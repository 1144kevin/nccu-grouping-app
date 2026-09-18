# 政缺一咖 App

React Native + Expo 前端。

## 開始開發

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

以 `.env.example` 建立本機 `.env`，不要提交私密金鑰。OpenAI 金鑰只能存在後端，不能放入 Expo App。

## TestFlight

登入 Expo 與 Apple Developer 帳號後執行：

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

首次執行前需用 `eas init` 綁定 Expo 專案，並將產生的 project ID 放入 App 設定或環境變數。
