# Apple 裝置端需求訪談（2026-10-21）

**2026-10-22正常版接Windows：**先讀相鄰後端 `docs/MAC_CONNECT_WINDOWS.md`。
`apple:configure --connection`可匯入公開接線包；正常profile固定trial=false，保留登入、儲存與配對。
本文件下方trial=true指令僅為先前獨立試用紀錄，不適用這次完整連線驗收。

原 App 新增專案內 Expo 原生模組 `modules/apple-intake`，透過 iPhone 的 Foundation Models 產生繁體中文需求摘要與補問。沒有新增 npm 第三方依賴，也不需要 Ollama、Mac 模型或雲端 AI 金鑰。只能在包含這個模組的 iOS 原生版本使用，Expo Go 不包含此模組。

## 本次範圍

- `AppleStealthIntake` 支援最多八輪使用者補充，每輪1000字、合計4000字；每次依完整使用者對話重新整理，最新明確更正優先。
- 模型只提供「待人工核對摘要」與最多四個補問。使用者明確點按後，只把摘要放進原 `SignalEditor` 的標題。分類、地點、時間、預算、已知費用、飲食條件及自願角色由使用者手動核對，不由模型覆寫。
- 原本完整手動表單保留。停止、60秒逾時、背景切換與離開畫面會取消生成；逾時或失敗保留輸入，舊摘要不可被當成新一輪結果套用。
- 可先在「核對後的需求標題」修正文字，再明確採用。模型完整摘要保留；超過160字時需要自行整理短標題，不會把截斷結果直接放進表單。
- 畫面顯示本次／總字數和輪數，超限會說明原因並保留輸入。「修改上一輪輸入」可在八輪後繼續修正；重新整理成功後才取代舊輪次，失敗時保留舊輪與修改內容。只有本人按「取消本次修改／放棄這次補充」才恢復採用舊摘要的資格。
- 回到 App 前景會重新檢查 Apple AI 狀態，檢查超過5秒會提供重試。iOS26.4以上在生成前計算指示、對話與結構的長度，為回覆保留空間；超出模型範圍時保留原輸入，不自動刪掉早先輪次或更正。模型實際限制與字數限制不同，詳見 [Apple 的 context window 說明](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)。
- 使用 `SystemLanguageModel.default`，無網路模型回退、無工具呼叫。原始訪談不傳給 API、不寫入資料庫，原生錯誤不攜帶對話原文。正常登入版本中，使用者採用摘要並親自儲存表單後，表單才依既有流程送往後端。
- 不整合向量、語義配對、自動付費、訂購或角色承諾。先前獨立 Probe 的結構化抽取正確率不足，因此這版刻意維持人工核對。

## 兩種入口

1. 正常連線版本：`EXPO_PUBLIC_APPLE_INTAKE_ENABLED=true`，`EXPO_PUBLIC_APPLE_INTAKE_TRIAL=false`。登入後開啟「偷揪 → 我的需求」，使用同一個 Apple 訪談元件與既有儲存／配對流程。仍需先完成手機到開發 API 的 HTTPS、本人登入與後端設定。
2. 本機試用：兩個 Apple 旗標皆為 `true`，並設定 `EXPO_PUBLIC_CORE_API_ENABLED=true`。App 直接顯示相同需求表單的訪談試用頁，不建立假帳號，也不執行登入還原、關鍵字 API、儲存或配對；關閉 App 後草稿不保留。這是目前沒有可用手機 API 時的實機入口。不要把此版本視為完整後端驗收。

本機試用會移除未使用的推播 entitlement，讓現有 Personal Team 可簽署。正常版本設定不受此試用分支影響。production、release profile 與 `CORE_RELEASE_CHECK` 均拒絕試用旗標。

## 手機操作驗收

1. 開啟「政缺一咖」，確認顯示「本機需求訪談」及「Apple 裝置端 AI 已就緒」。若未就緒，先依畫面提示處理 Apple Intelligence；手動表單仍能操作。
2. 輸入「想喝熱湯，預算120元，不方便取餐」，按「讓 Apple 分身整理」。閱讀摘要和補問，確認下方表單尚未被自動改動。
3. 補充「更正，預算80元；我還是不方便取餐」，按「補充並重新整理」。人工確認摘要是否保留最新更正及未承諾取餐。模型正確性需實際閱讀，生成成功不代表理解正確。
4. 先在手動表單填預算、費用、時間與自願角色；在「核對後的需求標題」修正摘要，再按「將摘要放入需求標題，再手動核對」，確認只有標題改動，其他欄位維持原值。清除本機對話後，已採用的標題與手動表單仍應保留。
5. 按「修改上一輪輸入」，確認輸入框帶回原文。改完後按「更新上一輪並整理」，確認成功後取代該輪，輪數不增加。尚未整理時按「取消本次修改」，確認恢復原輪次及舊摘要。
6. 貼上超過1000字內容，確認輸入完整保留、畫面說明超限且生成按鈕停用；縮短後可重試。八輪後應仍可修改上一輪。
7. 測試停止生成、切到背景後返回，以及直接略過 AI 手動輸入；過期結果不能被採用。本機試用不會儲存，頁面也不提供送出按鈕。

## Mac 必要原生工作

只需 Mac 處理 CocoaPods／Xcode 編譯、簽章、安裝 iPhone、Apple 框架實機驗證。本輪使用 Node24.22.0、Xcode27.1／iOS27.1 SDK、既有 Personal Team 與已信任的 iPhone17／iOS26.6.1；原生 API 執行時要求 iOS26以上，這份程式依本輪 SDK 的介面編譯。沒有啟動 Simulator、Docker 或在 Mac 安裝模型。

目前模組包含 SDK27 介面，原生建置需完整 Xcode27以上（已用27.1驗證），不能只依 Expo57 的 Xcode26.4最低需求判斷。Apple 原生啟動腳本已在建置前檢查版本。

本次試用建置的環境變數如下（無私密值）：

```sh
export EXPO_PUBLIC_CORE_API_ENABLED=true
export EXPO_PUBLIC_CORE_DATA_MODE=supabase
export EXPO_PUBLIC_APPLE_INTAKE_ENABLED=true
export EXPO_PUBLIC_APPLE_INTAKE_TRIAL=true
export EXPO_PUBLIC_APP_PROFILE=device
export EXPO_PUBLIC_API_BASE_URL=https://api.nccu-grouping.invalid/api/v1
export EXPO_OFFLINE=1
export EXPO_NO_TELEMETRY=1
npx expo prebuild --platform ios --no-install
EXPO_USE_PRECOMPILED_MODULES=1 pod install --project-directory=ios
```

`.invalid` 僅供本機試用，沒有可連線服務。接著從 `ios/app.xcworkspace` 選本人 Team 與實機編譯；也可用 `xcodebuild`，指定 `-jobs 1` 降低記憶體負擔。Release configuration 可內嵌 JS，讓手機不必連著 Metro；這不等於商店 production profile。`ios/`、簽章與 `.local/` 建置產物均不提交。Expo prebuild 可能自動改 package.json 的 ios/android 指令，請保持既有專案指令慣例。

## 留給 Windows 的後續

- 擴充繁體中文更正／撤回／未知費用案例、可及性與摘要／補問文案。字數提示、最後一輪編輯、摘要標題編輯、錯誤恢復與背景重查已完成；TypeScript、Jest、Web 回歸可在 Windows 重跑，真實模型仍由 iPhone 驗收。
- 開發 API、Supabase 開發設定、登入與儲存／配對整合、權限及資料隔離測試；先在 Windows 完成服務與契約，再用實機驗收連線。
- 重新規劃向量介面、版本與重建索引流程。先前 Probe 為 Apple `zh-Hans` revision1、640維，繁體原文 top1 9/11；不是既有512維向量的直接替換。不要混用不同模型、revision、維度或文字轉換策略，也尚未證明跨裝置向量一致性。先在 Windows 做候選資料權限、契約、排序回退與測試，再評估手機計算與候選重排；本次未修改資料庫或建立向量索引。
- 在 Windows 執行後端完整回歸、資料 migration 設計與必要的 UI 功能。只有 Swift 原生編譯、iOS 權限／生命週期、簽章與真機確認需要轉回 Mac。

前一階段 Apple AI 能力與限制詳見相鄰 backend repo 的 `docs/APPLE_AI_PROBE_RESULTS.md`。請搬移兩個 repo 的未提交變更，勿只搬忽略的 `ios/` 或舊版 Probe zip。

## 本輪檢查

原生實際結果：Xcode Release 單工編譯與簽章驗證通過，已把原 bundle `com.nccugrouping.nccuGrouping`（手機名稱「政缺一咖」）安裝到本人 iPhone17／iOS26.6.1 並啟動；後續 CoreDevice 檢查仍有該 App 行程。編譯內嵌 JS 的 Apple enabled／trial 旗標皆已核對為 true，原生 module provider 包含 `AppleIntakeModule`。不需連著 Metro。本輪 App 約63MiB、DerivedData 約2GiB；首次單工編譯約12分20秒，最後原生增量建置約43秒，這些是這台 M1／8GB 的本輪觀測，非一般效能保證。

安裝／啟動與程式測試已完成。2026-10-21 本人依實機測試提示操作後，明確回報「有出現 AI 摘要與補問」；原 App → Expo 原生橋接 → iPhone 裝置端模型 → 畫面結果的最小流程已獲本人確認。未取得實際輸出內容，因此這只確認能生成及顯示結果，不代表摘要正確性、多輪更正或所有手動欄位核對流程均已實機驗收。

後續兩小時整理任務：六組訪談／表單／adapter／契約的 Jest 共49項及八項建置設定檢查通過，TypeScript、相關 TS／TSX ESLint 通過。新增覆蓋長摘要尾端撤回不被截斷、人工修正後採用、八輪後修改、失敗編輯保留、前景狀態重查與過期檢查忽略、輸入快照、快速取消順序及正常模式明確儲存。這些 mock 測試只驗證程式契約與畫面行為，不能代表模型理解品質。

新版原生 App 已編譯、簽章驗證通過，並於 2026-10-21 23:03（Asia/Taipei）更新安裝至 iPhone。輕量 XCTest UI runner 重跑結果為一項通過、一項失敗：直接手動填寫需求標題與預算通過；繁體中文兩輪案例在定位訪談輸入欄位階段收到 `Not authorized for performing UI testing actions`，未取得本次模型回覆，因此多輪語義及採用後保留欄位仍待實機驗收。首跑曾遇腳本欄位定位及快速數字輸入問題，已改用動態輸入欄位查詢、最大捲動區及逐字輸入。尚未證明這些調整足以完成 AI 案例；不能把本次編譯或先前使用者確認混寫為新版完整驗收。

Windows 可重跑（不需要 Apple SDK）：

```sh
npm ci
npm run test:apple-intake
```

這個指令依序跑型別、相關 ESLint、Jest 與建置設定測試，將摘要寫入忽略的 `.local/apple-intake-checks.json`。它會隔離測試用的 build flags，不安裝套件、不啟動模型、API、Xcode 或網路服務。請使用 Node24。

## 可選的 iPhone 自動 UI 驗證（僅 Mac）

`tools/apple_intake_ui/AppleIntakeUITests.swift` 只測已安裝的本機試用 App，另建小型 XCTest runner，不編譯整套 Expo 相依。兩個固定案例分別走繁體中文兩輪生成、人工修正標題並保留手動金額／時間，以及直接手動輸入。AI 回覆保存在測試附件的合成案例紀錄；測試不以生成成功代表語義正確，仍需閱讀更正後的實際摘要。它會重新啟動試用 App，畫面草稿因此重置。

Ruby 的 `xcodeproj` 使用既有 CocoaPods 安裝提供的 gem，不另裝工具。先把最新試用 App 安裝到已信任且解鎖的 iPhone，再執行（自行代入本人 Team／實機 UDID；不可選 Simulator）：

```sh
GEM_HOME="$(brew --prefix cocoapods)/libexec" "$(brew --prefix ruby)/bin/ruby" tools/apple_intake_ui/prepare.rb
xcodebuild build-for-testing -project .local/apple-intake-ui/AppleIntakeUITests.xcodeproj -scheme AppleIntakeUITests -configuration Release -destination 'generic/platform=iOS' -jobs 1 -derivedDataPath .local/apple-intake-ui-build DEVELOPMENT_TEAM=YOUR_TEAM_ID -allowProvisioningUpdates
xcodebuild test-without-building -project .local/apple-intake-ui/AppleIntakeUITests.xcodeproj -scheme AppleIntakeUITests -configuration Release -destination 'platform=iOS,id=YOUR_DEVICE_UDID' -jobs 1 -parallel-testing-enabled NO -derivedDataPath .local/apple-intake-ui-build -resultBundlePath .local/apple-intake-ui-results
```

專案、簽章、完整 `.xcresult` 與手機診斷檔都留在 `.local/`；Windows 只需帶走測試來源和操作說明。離線手機不能執行測試，不以編譯成功替代實機結果。

## 重建 Windows 交接包

`tools/build_apple_handoff.py` 使用 Python3.9以上及 Git，打包兩個既有 repo 的未提交來源變更、刪除清單、已追蹤檔差異、基底 commit 與 SHA256 manifest，不提交或套用變更。它排除 `.env`、簽章、產物、外部 symlink，保留 `.env.example` 與本地原生模組；輸出副本中的 Team／手機識別資料會遮除，原檔不變。打包工具本身的五項標準庫測試通過。

```sh
python tools/build_apple_handoff.py --app PATH_TO_APP --backend PATH_TO_BACKEND --output PATH_TO_HANDOFF_ZIP
python -m unittest discover -s tools/tests -p test_build_apple_handoff.py -v
```

重新產生同一交接檔時明確加 `--overwrite`；若要包含先前四份固定 Probe 合成案例報告，加 `--include-probe-fixtures`。新檔與差異分別位於 ZIP 的 `overlay`／`patches`；Windows 合併前先比對 manifest 的 branch／HEAD，保留當地未提交工作並逐檔檢查，勿直接覆蓋整個 repo。

真機的生成正確性、輸入法、捲動與人工核對流程需依上方操作清單驗收；未執行登入、後端儲存、向量或完整配對端到端測試。
