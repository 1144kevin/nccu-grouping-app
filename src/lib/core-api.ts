import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import type { FeedPost, PostLocation } from '@/types/domain';

export const CORE_API_ENABLED = process.env.EXPO_PUBLIC_CORE_API_ENABLED === 'true';
export const CORE_SUPABASE_MODE = process.env.EXPO_PUBLIC_CORE_DATA_MODE === 'supabase';

export type CoreUser = {
  profile_setup_required?: boolean;
  deletion_pending?: boolean;
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  bio?: string;
  badge?: '🍜' | '🥐' | '🍕' | '🧋' | '🍱' | '🍍';
  version?: number;
  auth_mode: 'local_development' | 'supabase';
  email_verified: boolean;
};
export type CoreSession = {
  access_token: string;
  refresh_token?: string | null;
  expires_at: string;
  user: CoreUser;
};
export type ConfirmationRequired = {
  confirmation_required: true;
  message: 'check_email_to_confirm';
};
export type GoogleStart = { authorize_url: string; flow_id: string; expires_in: number };
export type CoreProfileInput = {
  display_name: string;
  bio: string;
  badge: NonNullable<CoreUser['badge']>;
  expected_version: number;
};
export type Membership = 'host' | 'none' | 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type CorePost = {
  images?: { id: string; width: number; height: number }[];
  semantic_recommendation?: { similarity: number; model_id: string; combined_score: number } | null;
  recommendation?: {
    version: 'rules_v2';
    score: number;
    remaining_seats: number;
    as_of: string;
    reasons: {
      code: 'preferred_tags' | 'preferred_location' | 'remaining_seats' | 'deadline';
      text: string;
    }[];
  } | null;
  is_demo?: boolean;
  image_id?: string | null;
  id: string;
  author_id: string;
  author_name: string;
  author_badge?: string;
  author_level?: number;
  content: string;
  tags: string[];
  location: PostLocation;
  price_per_person: string | null;
  deadline_at: string;
  capacity: number;
  joined: number;
  status: 'open' | 'full' | 'expired' | 'cancelled';
  my_status: Membership;
  version?: number;
  can_edit?: boolean;
  created_at: string;
};
export type CorePostInput = Pick<
  CorePost,
  'content' | 'tags' | 'location' | 'deadline_at' | 'capacity'
> & {
  price_per_person: string | null;
};
export type CoreJoin = {
  id: string;
  post_id: string;
  requester_id: string;
  requester_name: string;
  requester_badge?: string;
  requester_level?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  decided_at: string | null;
};
export type CorePostPage = { items: CorePost[]; next_cursor: string | null };
export type CoreMessage = {
  image_id?: string | null;
  id: string;
  post_id: string;
  sender_id: string;
  sender_name: string;
  sender_badge: string;
  sender_level?: number;
  content: string;
  created_at: string;
};
export type CoreChatPage = {
  post: CorePost;
  messages: CoreMessage[];
  next_cursor: string | null;
  can_send: boolean;
};
export type CoreConversationPage = {
  items: { post: CorePost; last_message: CoreMessage | null }[];
  next_cursor: string | null;
};
export type CoreChatActivity = {
  groups: { post_id: string; unread_count: number }[];
  total_unread: number;
  pending_requests: number;
};
export type CorePublicUser = {
  id: string;
  display_name: string;
  bio: string;
  badge: string;
  created_at: string;
  active_posts: number;
  level?: number;
};
export type CoreOrderActivity = {
  requester_level?: number;
  requester_badge?: string;
  id: string;
  post_id: string;
  post_content: string;
  requester_id: string;
  requester_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  kind: 'hosted_request' | 'my_request';
  occurred_at: string;
  post_cancelled: boolean;
  post_expired: boolean;
};
export type CoreOrderActivityPage = { items: CoreOrderActivity[]; next_cursor: string | null };
export type CoreSearchItem = {
  level?: number;
  badge?: string;
  id: string;
  kind: 'user' | 'message' | 'history';
  title: string;
  detail: string;
  post_id: string | null;
  created_at: string;
};
export type CoreSearchPage = { items: CoreSearchItem[]; next_cursor: string | null };

export const coreApi = {
  search: async (scope: 'users' | 'messages' | 'history', q: string, cursor?: string) =>
    (await api.get<CoreSearchPage>('/search', { params: { scope, q, cursor, limit: 30 } })).data,
  clock: async () => (await api.get<{ server_time: string }>('/development/clock')).data,
  orderActivity: async (cursor?: string) =>
    (await api.get<CoreOrderActivityPage>('/notifications', { params: { cursor, limit: 30 } }))
      .data,
  publicUser: async (id: string) =>
    (await api.get<CorePublicUser>(`/users/${encodeURIComponent(id)}`)).data,
  userPosts: async (id: string, cursor?: string) =>
    (
      await api.get<CorePostPage>(`/users/${encodeURIComponent(id)}/posts`, {
        params: { cursor, limit: 30 },
      })
    ).data,
  chatActivity: async () => (await api.get<CoreChatActivity>('/conversations/activity')).data,
  readChat: async (postId: string, messageId: string) =>
    (
      await api.post<{ ok: true }>(`/conversations/${encodeURIComponent(postId)}/read`, {
        message_id: messageId,
      })
    ).data,
  conversations: async (cursor?: string) =>
    (await api.get<CoreConversationPage>('/conversations', { params: { cursor, limit: 30 } })).data,
  messages: async (postId: string, cursor?: string) =>
    (
      await api.get<CoreChatPage>(`/conversations/${encodeURIComponent(postId)}/messages`, {
        params: { cursor, limit: 30 },
      })
    ).data,
  sendMessage: async (postId: string, content: string, key: string) =>
    (
      await api.post<CoreMessage>(
        `/conversations/${encodeURIComponent(postId)}/messages`,
        { content },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  clearDemo: async () =>
    (await api.delete<{ deleted_posts: number; kept_posts: number }>('/development/demo')).data,
  googleStart: async (client: 'web' | 'web_account' | 'web_public' | 'ios' = 'web') =>
    (await api.post<GoogleStart>('/auth/google/start', { client })).data,
  setAppPassword: async (password: string, expectedUserId: string) => {
    await api.post('/auth/password', { password, expected_user_id: expectedUserId });
  },
  googleFinish: async (flowId: string, code: string) =>
    (await api.post<CoreSession>('/auth/google/finish', { flow_id: flowId, code })).data,
  register: async (email: string, password: string, displayName: string) =>
    (
      await api.post<CoreSession | ConfirmationRequired>('/auth/register', {
        email,
        password,
        display_name: displayName,
      })
    ).data,
  login: async (email: string, password: string) =>
    (await api.post<CoreSession>('/auth/login', { email, password })).data,
  me: async () => (await api.get<CoreUser>('/auth/me')).data,
  updateProfile: async (value: CoreProfileInput) =>
    (await api.patch<CoreUser>('/auth/me', value)).data,
  logout: async () => {
    await api.post('/auth/logout');
  },
  posts: async (
    scope: 'feed' | 'hosted' | 'participating' | 'history' = 'feed',
    cursor?: string,
    q = '',
    activeOnly = false,
    limit = 30,
  ) =>
    (
      await api.get<CorePostPage>('/posts', {
        params: { scope, cursor, q, active_only: activeOnly, limit },
      })
    ).data,
  post: async (id: string) => (await api.get<CorePost>(`/posts/${encodeURIComponent(id)}`)).data,
  create: async (value: CorePostInput, requestKey: string) =>
    (await api.post<CorePost>('/posts', value, { headers: { 'Idempotency-Key': requestKey } }))
      .data,
  edit: async (id: string, value: CorePostInput & { expected_version: number }) =>
    (await api.patch<CorePost>(`/posts/${encodeURIComponent(id)}`, value)).data,
  requestJoin: async (id: string, expectedVersion = 1) =>
    (
      await api.post<CoreJoin>(`/posts/${encodeURIComponent(id)}/join-requests`, {
        expected_version: expectedVersion,
      })
    ).data,
  withdraw: async (id: string) =>
    (await api.delete<CorePost>(`/posts/${encodeURIComponent(id)}/membership`)).data,
  requests: async (id: string) =>
    (await api.get<CoreJoin[]>(`/posts/${encodeURIComponent(id)}/join-requests`)).data,
  decide: async (id: string, status: 'accepted' | 'rejected') =>
    (await api.patch<CoreJoin>(`/join-requests/${encodeURIComponent(id)}`, { status })).data,
  cancel: async (id: string) =>
    (await api.post<CorePost>(`/posts/${encodeURIComponent(id)}/cancel`)).data,
};

export function toFeedPost(post: CorePost): FeedPost {
  return {
    id: post.id,
    name: post.author_name,
    badge: post.author_badge ?? '🍱',
    level: post.author_level ?? 1,
    time: new Date(post.created_at).toLocaleString('zh-TW'),
    content: post.content,
    tags: post.tags,
    deadline: new Date(post.deadline_at).toLocaleString('zh-TW'),
    deadlineAt: post.deadline_at,
    joined: post.joined,
    capacity: post.capacity,
    location: post.location,
    pricePerPerson: post.price_per_person === null ? undefined : Number(post.price_per_person),
    isMine: post.my_status === 'host',
  };
}

const messages: Record<string, string> = {
  social_requires_supabase: '目前無法使用訊息功能，請稍後重試。',
  direct_message_unavailable: '目前無法與這位主揪私訊。',
  conversation_not_found: '找不到聊天室，或你目前無法存取。',
  direct_message_rate_limit: '訊息操作過於頻繁，請稍後重試。',
  handoff_not_ready: '尚未符合面交確認條件，請重新整理拼單。',
  post_writing_invalid_output: '這次草稿未通過檢查，原文已保留，請重新生成。',
  local_post_writing_not_configured: '本地 AI 尚未啟動，原文已保留。',
  post_writing_rate_limit: '生成次數較多，請稍等再試。',
  post_writing_already_pending: '你已有一份文案正在處理，請稍候完成。',
  post_writing_queue_full: '目前排隊人數較多，原文與照片已保留，請稍後再試。',
  post_writing_job_not_found:
    '這份 AI 工作已過期或伺服器已重新啟動，原文與照片已保留，請重新生成。',
  post_writing_wait_timeout: '本次等候時間較長，原文與照片已保留，請稍後重試。',
  post_writing_failed: 'AI 本次未完成，原文與照片已保留，請重新生成。',
  post_image_unreadable: '照片中的資訊看不清楚，請換一張清晰完整的照片。',
  post_image_invalid_output: '圖片辨識未完成，照片已保留，請重試。',
  local_model_vision_unavailable: '目前本機模型不支援圖片辨識，請啟用具備視覺能力的模型後重試。',
  post_speech_unavailable:
    '目前環境不支援語音辨識。網頁請用 Safari 或 Chrome 開啟；也可以點鍵盤上的麥克風輸入文字。',
  post_speech_permission_denied: '請在系統或瀏覽器設定允許麥克風與語音辨識，再重試。',
  post_speech_failed: '語音辨識未完成，已辨識的文字仍保留，可編輯後潤稿或重試。',
  post_speech_busy: '麥克風正在使用中，請結束其他錄音後重試。',
  post_speech_interrupted: '語音辨識已暫停，已辨識的文字仍保留。',
  post_speech_start_timeout: '等待語音權限逾時，請確認權限後重試。',
  post_speech_microphone_unavailable: '無法使用麥克風，請確認裝置可錄音，並結束其他錄音後重試。',
  post_speech_no_speech: '沒有聽到語音，請靠近麥克風重試，或用鍵盤輸入。',
  post_speech_network:
    '瀏覽器的語音辨識服務連線失敗，文字已保留。可以重試，或使用鍵盤的麥克風輸入。',
  post_speech_language_unavailable: '瀏覽器不支援目前的語音語言，請使用鍵盤輸入或鍵盤的麥克風。',
  quick_interview_unavailable: '聊天整理暫時無法使用，內容已保留。可以稍後重試，或使用分身設定。',
  invalid_social_input: '操作未完成，請重新整理後再試。',
  invalid_social_cursor: '清單已更新，請重新整理。',
  invalid_block_input: '請選擇有效使用者；不能封鎖自己。',
  block_limit_reached: '已達500位封鎖上限，請先整理封鎖名單。',
  user_interaction_blocked: '目前雙方無法互動，可能存在封鎖關係。',
  blocked_group_interaction:
    '此群組存在與你的封鎖關係，目前無法發送訊息；仍可查看允許的紀錄與退出。',
  invalid_safety_input: '操作格式不符，請重新整理後再試。',
  account_deletion_pending: '帳號正在清除，請到帳號設定繼續刪除流程。',
  account_deletion_reauthentication_required:
    '刪除帳號前請先登出，再登入同一帳號；需要15分鐘內的新登入。',
  explicit_account_deletion_required: '請先查看刪除影響，手動輸入 DELETE 並明確確認。',
  account_deletion_challenge_expired: '刪除確認已過期或不屬於此登入，請重新取得預覽。',
  invalid_account_deletion_input: '刪除確認格式不符，請重新取得預覽。',
  account_deletion_not_started: '尚未確認開始刪除，請先取得預覽並確認。',
  account_deletion_storage_remaining:
    '仍有圖片或其他儲存檔案待清理，帳號尚未刪除；請重試或聯絡開發者。',
  account_deletion_cleanup_failed:
    '圖片清理暫時失敗，帳號尚未完成刪除；重新登入同一帳號可繼續清理。',
  image_storage_not_configured: '圖片儲存尚未啟用，請先使用文字拼單或檢查本機設定。',
  image_too_large: '圖片壓縮未完成，請重新選取照片後再試。',
  too_many_post_images: '每篇貼文最多 5 張照片，請重新選擇。',
  image_dimensions_too_large: '圖片解析度過高，請先選擇較小或裁切後的圖片（最多1600萬像素）。',
  image_format_not_supported: '無法讀取這個圖片格式，請選擇 JPEG、PNG 或 HEIC 照片。',
  invalid_image_input: '無法讀取這張圖片，請重新選擇照片。',
  image_conversion_failed: '這張照片轉換未完成，請重新選取照片後再試。',
  image_permission_required: '請允許讀取照片，才能加入拼單圖片。',
  image_processing_busy: '正在處理其他圖片，請稍後重試。',
  image_storage_unavailable: '圖片儲存暫時無法連線，內容仍保留，請稍後重試。',
  image_storage_access_denied: '目前無法存取這份圖片，請重新整理或檢查登入。',
  image_upload_incomplete:
    '圖片上傳或驗證尚未完成，請重試；也可到帳號設定清除未發佈副本後重新選取。',
  image_upload_conflict: '圖片副本與本次內容不符，請到帳號設定清除未發佈副本後重新選取。',
  image_key_conflict: '這次圖片或發布內容與先前重試不同，請重新確認。',
  image_storage_limit: '圖片儲存空間暫時不足，請稍後重試。',
  image_not_found: '圖片不存在或你無權查看。',
  image_already_published: '這張圖片已綁定已發佈拼單，不能當未發佈副本刪除或重複發布。',
  image_verification_required: '圖片尚未通過後端驗證，無法發布。',
  image_delete_incomplete: '圖片副本尚未完整刪除，請重試。',
  invalid_formation_input:
    '請確認公開說明、整數金額、分工與含時區的截止時間；截止需晚於服務時間且不超過配合區間。',
  terms_revision_conflict: '方案已更新，請重新整理並確認新版，舊版同意不會沿用。',
  device_ai_disabled: '目前裝置連線未啟用本機 AI，可先使用手動表單。',
  device_ai_rate_limit: '本機 AI 請求太頻繁，請一分鐘後再試。',
  moderation_not_enabled: '回報查核尚未開放。',
  moderator_required: '此帳號沒有回報查核權限。',
  report_version_conflict: '這筆回報已被更新，請重新整理後核對。',
  report_already_reviewed: '這筆回報已進入其他處理階段，請重新整理。',
  review_required: '請先開始查核，再記錄處理結果。',
  moderation_key_conflict: '此處理請求與原重試內容不同，請重新整理核對。',
  appeal_requires_closed_report: '這筆回報尚在處理中，結案後才能申訴。',
  appeal_already_submitted: '同一事件已提出申訴，請查看我的申訴紀錄。',
  appeal_target_not_found: '事件不存在，或你不是可提出申訴的當事人。',
  appeal_key_conflict: '重試內容與原申訴不同，請重新整理核對。',
  appeal_version_conflict: '申訴已被更新，請重新整理並核對最新版本。',
  invalid_appeal_input: '請檢查申訴說明（10～1,000字）或覆核回覆（5～300字）。',
  invalid_moderation_input: '請填寫5～300字的處理回覆，並核對目前處理版本。',
  message_unavailable: '訊息已不存在或已被處置，請重新整理核對。',
  message_report_required: '這項處置只能用於訊息檢舉。',
  signal_changed: '需求已變更、撤回或過期，請重新整理後再次搜尋。',
  invalid_discovery_input: '需求向量格式或版本不符，請重新建立搜尋。',
  terms_required: '請先提出最終費用與分工方案。',
  formation_cost_conflict: '費用不可超過共同預算。',
  formation_cost_note_required: '調整配對時已知價格，需填 5～120 字原因，並由全員確認新版。',
  formation_deadline_passed: '方案的拼單截止已過，請在邀請有效時修改方案並重新確認。',
  proposal_already_formed: '這組已成團，請到正式拼單處理退出或取消。',
  signal_already_consumed: '這筆需求已成團，請到正式拼單處理退出。',
  demo_cannot_form: '示範人物無法同意，請使用真人帳號測試成團。',
  explicit_consent_required: '請明確確認費用、分工與公開內容。',
  terms_revision_limit: '本組修改已達上限，請重新建立需求。',
  stealth_requires_supabase: '偷揪需要使用 Supabase 開發模式。',
  engagement_requires_supabase: '帳號偏好與回報需要 Supabase 開發模式。',
  invalid_account_input: '設定格式不符，請檢查後再試。',
  invalid_report_input: '回報需填 10～1,000 字，並選擇有效的對象。',
  preferences_changed_reload: '偏好已在其他地方更新，請先重新載入已儲存設定。',
  quick_category_unclear:
    '分身還不確定你想揪什麼，請加上餐點或店名，例如「想喝50嵐」或「想吃披薩」。',
  coordination_waiting_for_all: '還在等其他夥伴同意，全部同意後就可以聊天。',
  report_key_conflict: '這次回報與先前重試內容不同，請重新確認。',
  report_target_unavailable: '無法檢舉此內容，可能已移除或你沒有查看權限。',
  report_rate_limit: '一小時最多送出五筆回報，請稍後再試。',
  inbox_preference_limit: '已達聊天室偏好數量上限，請聯絡管理者處理。',
  reminder_post_closed: '這筆拼單已截止或取消，無法新增提醒；仍可取消舊提醒。',
  saved_post_limit: '已達個人貼文偏好數量上限，請聯絡管理者處理。',
  recommendations_changed_reload: '偏好、名額或推薦資料已更新，請重新整理推薦清單。',
  intake_incomplete: '分身還需要補充資訊，請先回答問題。',
  local_model_not_configured: '尚未啟用本機模型，請依開發文件啟動模型與後端。',
  local_semantic_not_configured:
    '尚未啟用本機語義配對，請依開發文件設定並重啟後端；原配對仍可使用。',
  invalid_candidate_review: '模型未能完成候選判讀，請稍後重試；原配對與確認流程仍可使用。',
  ungrounded_candidate_review: '這次模型理由未通過資料檢查，已隱藏，請重新分析。',
  invalid_embedding_response: '本機模型的向量格式不符，請確認模型設定後重試。',
  embedding_space_changed: '語義模型版本已改變，請重新分析配對。',
  local_model_unavailable: '本機模型未啟動，請執行 run_local_model.py。',
  local_model_not_installed: '本機模型尚未下載，請依開發文件完成下載。',
  local_model_timeout: '本機模型回應逾時，內容仍保留，請稍後重試。',
  local_model_busy: '本機模型正在處理另一筆需求，請稍後重試。',
  invalid_local_model_response: '本機模型暫時無法回應，請確認模型服務已啟動。',
  invalid_local_model_output: '模型未能產生完整資料，請換個說法，或使用手動表單。',
  create_agent_first: '請先建立並儲存你的分身。',
  agent_version_conflict: '分身已在其他地方更新，請重新載入已儲存設定。',
  agent_not_enabled: '分身目前暫停中，請先開啟偷揪並儲存。',
  agent_quiet_hours: '目前是分身的安靜時段；可在設定中調整後再試。',
  match_cooldown: '剛剛已尋找過配對，請等 30 秒再試。',
  active_signal_limit: '最多同時保留 10 筆有效需求，請先撤回不需要的內容。',
  invalid_signal_window: '時間區間不符：持續 15～1,440 分鐘，且結束時間需在未來 7 天內。',
  invalid_stealth_input: '請確認需求內容、分類、角色與輸入格式。',
  invalid_stealth_money: '金額請填 0～100,000 的整數，留白表示尚未確認。',
  stealth_role_required: '提供資源需要選擇角色；行程需明確勾選願意順路取餐。',
  idempotency_payload_conflict: '重試內容與先前不同，請重新確認。',
  stealth_not_found: '找不到這筆偷揪資料，或你無權操作。',
  proposal_unavailable: '這個配對已失效，可能有人撤回、暫停或已超過期限。',
  stealth_busy_retry: '分身正在處理其他變更，請稍後再試。',
  public_profile_not_found: '找不到這位使用者的公開資料。',
  chat_members_only: '只有主揪與已加入的團員可以使用這個聊天室；退出後便無法再讀取新訊息。',
  chat_read_only: '這筆拼單已取消，聊天室只能查看紀錄。',
  chat_rate_limit: '訊息傳得太快，請等一分鐘再試。',
  chat_requires_supabase: '文字聊天需要使用 Supabase 開發模式。',
  invalid_chat_input: '訊息需要 1～2,000 字，請確認內容後再傳送。',
  message_key_payload_conflict: '重試訊息的內容與原本不同，請重新輸入後再傳送。',
  invalid_email_or_password: '信箱或密碼不正確。',
  app_password_weak: '密碼不符合安全要求，請設定更長且不常見的 App 專用密碼。',
  app_password_unchanged: '這個密碼已經設定完成，可以回 Expo Go 登入。',
  app_password_reauthenticate: '請先登出並重新用 Google 登入，再設定 App 密碼。',
  app_password_not_available: '請先完成信箱驗證；待刪除的帳號無法設定密碼。',
  app_password_account_changed: '目前登入帳號已改變，請重新開啟密碼設定頁。',
  invalid_or_expired_session: '登入已失效，請重新登入。',
  email_already_registered: '這個信箱已註冊，請改用登入。',
  core_local_adapter_disabled: '本機後端尚未啟用，請依開發文件啟動。',
  post_full: '拼單已額滿，請重新整理查看名額。',
  post_deadline_passed: '已超過截止時間，無法再加入、接受或退出。',
  post_cancelled: '主揪已取消這筆拼單。',
  host_only: '只有主揪可以執行這個操作。',
  host_must_cancel_post: '主揪請使用取消拼單。',
  join_request_not_pending: '申請狀態已改變，請重新整理。',
  too_many_auth_attempts: '嘗試次數太多，請等一分鐘再試。',
  deadline_must_be_within_14_days: '截止時間必須晚於現在，且在未來 14 天內。',
  idempotency_key_payload_conflict: '這次發布的內容與先前不同，請重新確認後發布。',
  profile_changed_reload: '個人資料已在其他地方更新，請重新載入後再編輯。',
  post_changed_reload: '拼單已在其他地方更新，請重新載入後再編輯。',
  post_has_active_requests: '已有待處理申請或團員，請先處理申請，或取消後重新發布。',
  supabase_development_not_configured: 'Supabase 開發專案尚未設定，請確認本機後端設定。',
  supabase_unavailable: '目前無法連接 Supabase，請確認網路後重試。',
  supabase_operation_failed: '雲端操作未完成，請稍後重試；若持續發生，請檢查開發專案設定。',
  email_confirmation_required: '請先完成信箱驗證，再回到此頁登入。',
  email_provider_not_configured: '開發專案尚未設定對外寄信，請使用已驗證的測試帳號。',
  email_address_invalid:
    'Supabase 不接受這個信箱。請使用能收驗證信的真實信箱；example.test 僅供離線測試。',
  email_send_rate_limit: '驗證信寄送已達限制，請稍後再試。',
  google_login_not_configured:
    'Google 登入尚未啟用。請先完成 Google OAuth 與 Supabase Google Provider 設定。',
  google_login_requires_supabase: 'Google 登入需要啟動 Supabase 開發模式。',
  google_login_expired_restart: 'Google 登入已失效或不屬於這個頁籤，請返回登入頁重新開始。',
  google_login_cancelled: 'Google 登入未完成，請返回登入頁重試。',
  google_web_only: '這一版 Google 登入先支援本機瀏覽器，iPhone App 登入尚未啟用。',
  google_ios_not_configured:
    'iPhone Google 登入程式已備妥，尚需設定開發專案的 App 回呼網址並啟用後端設定。',
  google_native_build_required: '請使用 iPhone 開發版本，Expo Go 無法使用這個 App 專屬登入回呼。',
  google_login_invalid_response: 'Google 登入設定不符，請檢查開發專案的回呼網址。',
};

export function coreError(error: unknown): string {
  if (error instanceof Error && messages[error.message]) return messages[error.message];
  if (isAxiosError(error)) {
    if (!error.response)
      return '無法連接本機後端。請確認伺服器已啟動；手機請檢查同一私人網路、本機網路權限與 HTTPS 憑證信任。登入資料會保留，可稍後重試。';
    const detail: unknown = error.response.data?.detail;
    if (typeof detail === 'string' && messages[detail]) return messages[detail];
    if (error.response.status === 422) {
      const fields = new Set<string>();
      if (Array.isArray(detail))
        for (const item of detail) {
          if (item && typeof item === 'object' && 'loc' in item && Array.isArray(item.loc)) {
            for (const field of item.loc) if (typeof field === 'string') fields.add(field);
          }
        }
      if (fields.has('email')) return '請填寫有效的信箱地址。';
      if (fields.has('password')) return '密碼需為 10～128 字。';
      if (fields.has('display_name')) return '顯示名稱需為 1～40 字。';
      if (fields.has('bio')) return '個人介紹最多 160 字。';
      if (fields.has('capacity')) return '需求人數需為 2～20 人（含主揪）。';
      if (fields.has('tags')) return '請填寫 1～10 個標籤，每個最多 40 字。';
      if (fields.has('price_per_person')) return '每人金額需為 0～999,999.99，最多兩位小數。';
      if (fields.has('deadline_at')) return '請重新選擇有效的截止時間。';
      if (fields.has('location')) return '請確認地點名稱與有效座標。';
      return '填寫內容不符合要求，請檢查後再送出。';
    }
    if (error.response.status === 401) return '請重新登入。';
  }
  return '操作未完成，請稍後再試。';
}

// A replay identifier, not an authentication secret. Retain it when retrying the same payload.
export function newRequestKey(): string {
  return `post-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
