import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from './app-text';
import { IconButton } from './primitives';
import { colors, spacing } from '@/theme/tokens';

type Section = { title: string; body: string };
const agreement: Section[] = [
  {
    title: '一、服務與適用範圍',
    body: '政缺一咖提供貼文、拼單、私訊、聊天室、偷揪配對及相關功能，協助使用者自行聯繫與協調。本服務目前為測試版本。使用前請閱讀本協議與隱私權保護政策。',
  },
  {
    title: '二、帳號與使用資格',
    body: '請提供正確的註冊資料並妥善保管帳號。使用 Google 登入時，亦須遵守 Google 的相關條款。若您未達依法可自行同意的年齡，請先取得法定代理人同意。不得冒用他人身分、侵入帳號或以不正當方式使用服務。',
  },
  {
    title: '三、拼單與交易',
    body: '平台提供資訊與聯繫工具，不代訂餐、收款、付款或保證成交。價格、數量、付款、購買、取貨、時間及地點，應由參與者自行確認。餐點品質、保存、過敏原與安全資訊請直接向供應者查證；請勿提供超出協調所需的個人或付款資料。',
  },
  {
    title: '四、貼文與使用規範',
    body: '您應對發布的文字、照片和訊息負責，並確認有權使用相關內容。請勿從事詐騙、騷擾、歧視、威脅、散布違法或侵害他人隱私、肖像及著作權的內容，也不得濫發訊息或干擾服務。若發現問題，可使用檢舉、封鎖及申訴功能。',
  },
  {
    title: '五、內容使用與智慧財產',
    body: '您保留自己內容的權利；為了提供貼文顯示、圖片處理、聊天室、媒合及相關服務，您授權營運團隊在提供服務所需範圍內儲存、處理與顯示您提供的內容。其他使用者的內容與平台設計受其權利人及法律保護，不得未經授權使用。',
  },
  {
    title: '六、偷揪與 AI 功能',
    body: '偷揪可依您提供的需求與偏好協助整理及媒合；AI 也可協助生成貼文、語音與建議回覆。AI 可能理解錯誤、遺漏資訊或產生不正確的建議，請在發布、傳送或確認條件前自行核對。系統不會代您承諾付款、購買或取餐。',
  },
  {
    title: '七、管理、暫停與終止',
    body: '為處理檢舉、違規、安全或技術問題，營運團隊可能依情況限制功能、隱藏內容、取消拼單或停止服務，並提供現有申訴管道。您可在帳號設定中申請刪除帳號；刪除後相關資料及您主揪的拼單可能無法恢復。',
  },
  {
    title: '八、服務限制與條款調整',
    body: '服務可能因維護、網路、第三方服務或測試調整而中斷；我們會依實際情況處理問題，法律保障的權利不因本協議而排除。條款若有調整，將以 App 內公告或其他適當方式通知；重要變更將說明生效時間。',
  },
  {
    title: '九、聯絡與爭議',
    body: '本服務營運者為 ALLDAY PROJECT。可透過 114462003@g.nccu.edu.tw 聯絡，或登入後由「幫助與回報」提出問題或申訴。適用法律及爭議處理依相關法律規定辦理。',
  },
];
const privacy: Section[] = [
  {
    title: '一、蒐集者與聯絡方式',
    body: '本服務由 ALLDAY PROJECT 營運。您可透過 114462003@g.nccu.edu.tw 聯絡，或登入後透過「幫助與回報」提出個人資料問題或權利請求；請勿提供密碼或驗證碼。',
  },
  {
    title: '二、蒐集的資料',
    body: '依您使用的功能，資料可能包括：註冊信箱、顯示名稱、頭像及個人介紹；貼文、照片、標籤、拼單條件、參與紀錄與聊天訊息；偷揪需求、對話、偏好及配對資訊；回報、檢舉與佐證圖片；以及裝置推播訂閱與服務運作所需的技術紀錄。使用 Google 登入時，我們取得驗證服務提供的帳號識別資訊，不會取得您的 Google 密碼。',
  },
  {
    title: '三、資料用途',
    body: '資料用於建立及驗證帳號、顯示個人資料與貼文、推薦和配對、協調拼單、發送訊息及經授權的推播、處理回報與防止濫用，以及維護與改善服務。提供資料並非所有欄位均屬必要，但缺少某些資訊可能使相應功能無法使用。',
  },
  {
    title: '四、AI 與語音',
    body: '您使用偷揪 AI 聊天或語音回覆時，相關對話文字或生成語音所需文字可能送至 Google Gemini 服務處理；圖片文案和語音潤稿可能由專案的本機服務處理。語音辨識依您使用的瀏覽器或裝置服務運作。請避免輸入密碼、驗證碼、付款資訊或不必要的敏感資料。',
  },
  {
    title: '五、資料接收者與使用地區',
    body: '資料儲存、驗證及運作可能使用 Supabase、Google、瀏覽器推播服務和專案團隊管理的電腦或網路服務；資料可能在服務供應商及其處理地區處理，包括臺灣以外。供應商依其服務條款與實際設定處理資料。只有在提供功能、處理安全及回報、依法令要求或其他合法情況下，才會提供必要資料給相關對象。',
  },
  {
    title: '六、可見範圍與保留',
    body: '貼文與公開個人資料可能由其他使用者或持分享連結的人查看；聊天室與配對資訊依參與者及權限顯示，檢舉資料供管理查核。資料在提供服務、處理爭議或符合法令所需期間保留；目前測試環境尚未對所有資料與備份實施固定期限的自動清除。',
  },
  {
    title: '七、您的權利與刪除',
    body: '您可依法請求查詢、閱覽、複製、更正、補充、停止蒐集處理利用或刪除個人資料；部分請求可能受法定例外限制。可在 App 編輯資料或刪除帳號，亦可透過「幫助與回報」提出請求。刪除帳號將清理現行 App 資料及登入工作階段；他人保存的副本、引用與備份不保證立即消失。',
  },
  {
    title: '八、權限與政策變更',
    body: '相機、相片、麥克風、位置及推播依您使用的功能與裝置授權運作，可在裝置或瀏覽器設定中調整。政策有變更時，將透過 App 內公告或其他適當方式通知。',
  },
];

export function RegistrationTerms({
  agreed,
  onChange,
}: {
  agreed: boolean;
  onChange: (value: boolean) => void;
}) {
  const [document, setDocument] = useState<'agreement' | 'privacy' | null>(null);
  const title = document === 'agreement' ? '用戶使用協議' : '隱私權保護政策';
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.links}>
        <Text style={styles.hint}>註冊或使用 Google 前，請先閱讀</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="閱讀用戶使用協議"
          onPress={() => setDocument('agreement')}
        >
          <Text style={styles.link}>用戶使用協議</Text>
        </Pressable>
        <Text style={styles.hint}>與</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="閱讀隱私權保護政策"
          onPress={() => setDocument('privacy')}
        >
          <Text style={styles.link}>隱私權保護政策</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="同意用戶使用協議與隱私權保護政策"
        accessibilityState={{ checked: agreed }}
        onPress={() => onChange(!agreed)}
        style={styles.checkRow}
      >
        <View style={[styles.checkbox, agreed && { backgroundColor: colors.yellow }]}>
          <Text style={{ color: colors.onYellow }}>{agreed ? '✓' : ''}</Text>
        </View>
        <Text style={styles.hint}>我已閱讀並同意以上條款</Text>
      </Pressable>
      <Modal
        visible={document !== null}
        animationType="slide"
        onRequestClose={() => setDocument(null)}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <IconButton icon="close" label="關閉條款" onPress={() => setDocument(null)} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.hint}>內測草案・2026/11/04</Text>
            {(document === 'agreement' ? agreement : privacy).map((item) => (
              <View key={item.title} style={{ gap: 8 }}>
                <Text style={styles.section}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, rowGap: 4 },
  link: { color: colors.brown, fontSize: 13, textDecorationLine: 'underline' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 30 },
  header: {
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  content: { padding: spacing.lg, gap: 22, paddingBottom: 50 },
  section: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 25 },
});
