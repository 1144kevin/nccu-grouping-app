import { displayTimestamp } from '@/lib/display-time';
import { PageLoading } from '@/components/page-loading';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreError, newRequestKey } from '@/lib/core-api';
import { engagementApi, type ReportInput } from '@/lib/engagement-api';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { queryClient } from '@/lib/query-client';
import { CoreConnectionStatus } from '@/components/core-connection-status';
import { colors, radius, spacing } from '@/theme/tokens';
import { pickPersonalImage } from '@/lib/pick-personal-image';
import type { PickedPostImage } from '@/lib/pick-post-images';
import { profileSocial } from '@/lib/profile-social';
import { Image } from 'expo-image';
import { PersonalImage } from './personal-image';

const reasons: [ReportInput['reason'], string][] = [
  ['spam', '垃圾訊息'],
  ['harassment', '騷擾'],
  ['fraud', '疑似詐騙'],
  ['inappropriate', '不當內容'],
  ['other', '其他'],
];
export function ReportComposer({
  kind,
  targetId = null,
}: {
  kind: ReportInput['kind'];
  targetId?: string | null;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState<ReportInput['reason']>('other');
  const [photo, setPhoto] = useState<PickedPostImage | null>(null);
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const upload = useRef<{ key: string; id?: string }>({ key: newRequestKey() });
  async function pick(camera: boolean) {
    setPicking(true);
    setPhotoError('');
    try {
      const selected = await pickPersonalImage(camera);
      if (selected) {
        setPhoto(selected);
        upload.current = { key: newRequestKey() };
      }
    } catch (error) {
      setPhotoError(coreError(error));
    } finally {
      setPicking(false);
    }
  }
  const frozen = useRef<{ signature: string; key: string } | null>(null);
  const send = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async () => {
      if (!photo?.base64) throw new Error('report_image_required');
      if (!upload.current.id)
        upload.current.id = (
          await profileSocial.upload('evidence', photo.base64, upload.current.key)
        ).id;
      if (useAuthStore.getState().user?.id !== actor) throw new Error('invalid_or_expired_session');
      const value: ReportInput = {
        evidence_image_id: upload.current.id,
        kind,
        target_id: targetId,
        reason,
        detail: detail.trim(),
        platform:
          Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android'
            ? Platform.OS
            : 'unknown',
        app_version: '1.0.0',
      };
      const signature = JSON.stringify(value);
      if (frozen.current?.signature !== signature)
        frozen.current = { signature, key: newRequestKey() };
      return engagementApi.report(value, frozen.current.key);
    },
    onSuccess: () => {
      if (useAuthStore.getState().user?.id === actor)
        void queryClient.invalidateQueries({ queryKey: ['core', actor, 'reports'] });
    },
  });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{kind === 'feedback' ? '回報問題' : '檢舉內容'}</Text>
      <Text style={styles.hint}>回報僅供管理者查看。請勿填入密碼、驗證碼或付款資料。</Text>
      {send.data ? (
        <>
          <Text accessibilityRole="alert" style={styles.success}>
            已儲存並收到，尚待管理者查看。回報編號：{send.data.id}
          </Text>
          <PrimaryButton
            secondary
            onPress={() => {
              frozen.current = null;
              send.reset();
              setDetail('');
              setPhoto(null);
              upload.current = { key: newRequestKey() };
            }}
          >
            再寫一筆
          </PrimaryButton>
        </>
      ) : (
        <>
          {kind !== 'feedback' ? (
            <View style={styles.row}>
              {reasons.map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: reason === value, disabled: send.isPending }}
                  disabled={send.isPending}
                  onPress={() => setReason(value)}
                  style={styles.choice}
                >
                  <Text style={styles.body}>
                    {reason === value ? '✓ ' : ''}
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="回報說明"
            multiline
            value={detail}
            onChangeText={setDetail}
            maxLength={1000}
            editable={!send.isPending}
            placeholder="請具體描述發生的情況（至少10字）"
            style={styles.input}
          />
          <Text style={styles.hint}>{detail.length}/1000</Text>
          <Text style={styles.hint}>請附上一張相關截圖或照片</Text>
          {photo ? (
            <Image
              accessibilityLabel="已選擇的佐證圖片"
              source={{ uri: photo.uri }}
              contentFit="contain"
              style={{ width: '100%', height: 170, borderRadius: 12 }}
            />
          ) : null}
          <View style={styles.row}>
            <PrimaryButton
              secondary
              disabled={send.isPending || picking}
              onPress={() => {
                void pick(false);
              }}
            >
              {photo ? '更換圖片' : '上傳圖片'}
            </PrimaryButton>
            <PrimaryButton
              secondary
              disabled={send.isPending || picking}
              onPress={() => {
                void pick(true);
              }}
            >
              拍照
            </PrimaryButton>
          </View>
          {photoError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {photoError}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={detail.trim().length < 10 || !photo || send.isPending || picking}
            onPress={() => send.mutate()}
            loading={send.isPending}
          >
            {send.isPending ? '儲存中' : '確認送出回報'}
          </PrimaryButton>
          {send.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(send.error)} 內容已保留，未修改內容的重試不會重複新增。
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
export function ReportButton({
  kind,
  targetId,
}: {
  kind: 'post' | 'message' | 'user';
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const actor = useAuthStore((state) => state.user?.id);
  return (
    <View>
      <PrimaryButton secondary onPress={() => setOpen(!open)}>
        {open ? '收起檢舉表單' : '檢舉'}
      </PrimaryButton>
      {open ? (
        <ReportComposer key={`${actor}:${kind}:${targetId}`} kind={kind} targetId={targetId} />
      ) : null}
    </View>
  );
}
export function CoreHelpScreen() {
  const [diagnostics, setDiagnostics] = useState(false);
  const actor = useAuthStore((state) => state.user?.id);
  const access = useQuery({
    queryKey: ['core', actor, 'moderation-access'],
    enabled: !!actor,
    retry: false,
    queryFn: async () => (await api.get<{ can_review: boolean }>('/moderation/access')).data,
  });
  const query = useQuery({
    queryKey: ['core', actor, 'reports'],
    queryFn: engagementApi.reports,
    enabled: !!actor,
  });
  return (
    <Screen>
      <DetailHeader title="幫助與回報" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>需要協助時</Text>
        <Text style={styles.body}>
          加入申請需要主揪接受；偷揪要全員確認同一版方案才成團。遇到可疑內容可在貼文、公開個人資料或聊天室檢舉。平台不會代為訂餐或付款。
        </Text>
        <PrimaryButton secondary onPress={() => setDiagnostics(!diagnostics)}>
          {diagnostics ? '收起連線檢查' : '連線檢查'}
        </PrimaryButton>
        {diagnostics ? <CoreConnectionStatus /> : null}
        <ReportComposer key={actor} kind="feedback" />
        <PrimaryButton secondary onPress={() => router.push('/appeals')}>
          申訴與覆核
        </PrimaryButton>
        <PrimaryButton secondary onPress={() => router.push('/data-notice')}>
          資料與使用說明
        </PrimaryButton>
        {access.data?.can_review ? (
          <PrimaryButton secondary onPress={() => router.push('/moderation')}>
            管理回報
          </PrimaryButton>
        ) : null}
        <Text style={styles.title}>我的回報</Text>
        {query.isPending ? <PageLoading /> : null}
        {query.error ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(query.error)}
            </Text>
            <PrimaryButton
              secondary
              onPress={() => {
                void query.refetch();
              }}
            >
              重試載入回報
            </PrimaryButton>
          </>
        ) : null}
        {query.data?.items.length === 0 ? <Text style={styles.hint}>還沒有回報紀錄。</Text> : null}
        {query.data?.items.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.evidence_image_id ? <PersonalImage id={item.evidence_image_id} /> : null}
            <Text style={styles.body}>
              {item.kind === 'feedback' ? '問題回報' : '內容檢舉'} ·{' '}
              {
                {
                  received: '已收到，待查看',
                  reviewing: '管理者處理中',
                  resolved: '已結案',
                  dismissed: '查核後不成立',
                }[item.status]
              }
            </Text>
            <Text style={styles.body}>{item.detail}</Text>
            {item.public_response ? (
              <Text style={styles.body}>處理回覆：{item.public_response}</Text>
            ) : null}
            <Text style={styles.hint}>{displayTimestamp(item.created_at)}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { padding: spacing.sm, backgroundColor: colors.surface },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  input: {
    minHeight: 120,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.ink,
  },
  error: { color: colors.danger },
  success: { color: colors.success, lineHeight: 23 },
});
