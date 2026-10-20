import { ScrollView } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { router } from 'expo-router';

export default function DataNoticeScreen() {
  return <Screen><DetailHeader title="內測資料與使用說明" /><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text>版本：2026-10-20 內測草案。營運名稱「政缺一咖開發團隊（示範）」及 support@example.invalid 均為假資料；該信箱不能收信，尚非正式對外條款或客服。</Text>
    <Text>資料用途：登入信箱與基本資料用於辨識帳號；拼單、加入申請、聊天及偷揪需求用於協調與配對。回報、申訴與處置紀錄用於查核，不會提供給其他一般使用者。</Text>
    <Text>資料流向：帳號與功能資料存於 Supabase 開發專案。啟用本機 AI 時，訪談文字會傳至開發者管理的電腦處理，不等於全程留在手機；已確認需求會產生向量存入 Supabase，用於跨使用者搜尋。向量也視為私人資料。</Text>
    <Text>AI 只提供理解與建議，可能出錯，不保證價格、食物安全或成團。模型不會替任何人付款、取餐或同意；費用與分工修改後仍須全員確認最新版本。目前沒有啟用付費模型或 Apple 原生 AI。</Text>
    <Text>使用規範：請提供正確資訊，不散布騷擾、詐騙或侵害他人權益的內容。平台協助媒合，不代為下單或付款；過敏與飲食資訊須自行向供餐者確認。</Text>
    <Text>處理方式：可檢舉、封鎖並查看本人回報。管理者查核後可取消拼單或隱藏訊息；受到處置的作者及原回報者可提出一次申訴。申訴不會自動恢復名額或舊同意。</Text>
    <Text>保留與刪除：撤回需求會立即停止配對，原需求不因此自動刪除。帳號刪除流程會清理現行應用資料與登入工作階段。訊息隱藏會保留原文供查核；目前尚未上線定時清理與備份逐筆刪除機制，因此不承諾固定天數內清除所有備份。</Text>
    <Text>暫定政策目標：過期需求30天、已結束協調90天、結案回報與申訴180天、團隊自管備份30天。這些是待確認與待實作的草案期限，尚未自動執行；Supabase 備份依服務方案與供應商實際機制另外確認。</Text>
    <Text>需要查詢、更正或刪除資料時，內測期間請從「幫助與回報」送出具體需求；不要提供密碼、驗證碼或付款資訊。正式上線前須換成真實營運名稱、可用支援聯絡方式並確認政策。</Text>
    <PrimaryButton secondary onPress={() => router.push('/help')}>幫助與回報</PrimaryButton>
    <PrimaryButton secondary onPress={() => router.push('/appeals')}>申訴與覆核</PrimaryButton>
  </ScrollView></Screen>;
}
