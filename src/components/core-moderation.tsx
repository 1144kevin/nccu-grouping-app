import { useRef, useState } from 'react';
import { PageLoading } from '@/components/page-loading';
import { useMutation, useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { router } from 'expo-router';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { api } from '@/lib/api';
import { coreError, newRequestKey } from '@/lib/core-api';
import type { Report, ReportInput } from '@/lib/engagement-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { PersonalImage } from './personal-image';
import { colors, radius } from '@/theme/tokens';
import { displayTimestamp } from '@/lib/display-time';

type OperatorReport = Pick<
  Report,
  'id' | 'status' | 'review_version' | 'public_response' | 'created_at'
> & { payload: ReportInput };
const kindLabels: Record<string, string> = {
  post: '拼單貼文',
  message: '聊天室訊息',
  user: '使用者',
  feedback: '問題回報',
};
const reasonLabels: Record<string, string> = {
  spam: '垃圾訊息',
  harassment: '騷擾',
  fraud: '疑似詐騙',
  inappropriate: '不當內容',
  other: '其他',
};
const statusLabels: Record<string, string> = {
  received: '待處理',
  reviewing: '審核中',
  resolved: '已處理',
  dismissed: '不成立',
};
type Action = 'review' | 'resolve' | 'dismiss' | 'cancel_post' | 'hide_message';
export const moderationApi = {
  reports: async () => (await api.get<{ items: OperatorReport[] }>('/moderation/reports')).data,
  target: async (id: string) =>
    (
      await api.get<{ available: boolean; name?: string; score?: number }>(
        `/moderation/reports/${id}/penalty-target`,
      )
    ).data,
  penalty: async (
    id: string,
    value: {
      expected_version: number;
      points: number;
      public_response: string;
      internal_note: string;
      request_key: string;
    },
  ) => (await api.post(`/moderation/reports/${id}/penalty`, value)).data,
  review: async (
    id: string,
    value: {
      expected_version: number;
      action: Action;
      public_response: string;
      internal_note: string;
      request_key: string;
    },
  ) => (await api.post(`/moderation/reports/${id}/review`, value)).data,
};

function ReviewCard({
  report,
  refresh,
}: {
  report: OperatorReport;
  refresh: () => Promise<unknown>;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const context = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () =>
      (
        await api.get<{ content?: string; unavailable?: boolean }>(
          `/moderation/reports/${report.id}/context`,
        )
      ).data,
  });
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const [points, setPoints] = useState('0');
  const [penaltyConfirm, setPenaltyConfirm] = useState(false);
  const target = useQuery({
    queryKey: ['core', actor, 'moderation-penalty-target', report.id],
    queryFn: () => moderationApi.target(report.id),
    enabled: report.status === 'reviewing' && report.payload.kind !== 'feedback',
    retry: false,
  });
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [version, setVersion] = useState(report.review_version ?? 1);
  const stale = version !== (report.review_version ?? 1);
  const frozen = useRef<{ signature: string; key: string } | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: (action: Action) => {
      const value = {
        expected_version: version,
        action,
        public_response: response.trim(),
        internal_note: note.trim(),
        ...(action === 'resolve' && Number(points) > 0 ? { points: Number(points) } : {}),
      };
      const signature = JSON.stringify(value);
      if (frozen.current?.signature !== signature)
        frozen.current = { signature, key: newRequestKey() };
      if (value.points) {
        const { action: _action, ...penalty } = value;
        return moderationApi.penalty(report.id, {
          ...penalty,
          points: value.points,
          request_key: frozen.current.key,
        });
      }
      return moderationApi.review(report.id, { ...value, request_key: frozen.current.key });
    },
    onSuccess: async (result) => {
      setCancelConfirm(false);
      setPenaltyConfirm(false);
      setPoints('0');
      setVersion(result.review_version);
      setResponse('');
      setNote('');
      await refresh();
    },
  });
  const valid = response.trim().length >= 5 && !mutation.isPending && !stale;
  const pointValue = Number(points);
  const penaltyValid =
    /^\d{1,3}$/.test(points) &&
    pointValue >= 0 &&
    pointValue <= 100 &&
    (pointValue === 0 || (!!target.data?.available && pointValue <= (target.data.score ?? -1)));
  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>
          {kindLabels[report.payload.kind] ?? '檢舉'}
        </Text>
        <Text style={{ color: colors.brown, fontWeight: '700' }}>
          {statusLabels[report.status] ?? '狀態未知'}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {report.created_at ? displayTimestamp(report.created_at) : ''}
      </Text>
      <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 6 }}>
        <Text style={{ color: colors.muted }}>檢舉類別</Text>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>
          {reasonLabels[report.payload.reason] ?? '其他'}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>檢舉內容</Text>
        <Text style={{ color: colors.ink, lineHeight: 22 }}>{report.payload.detail}</Text>
      </View>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>圖片佐證</Text>
      {report.payload.evidence_image_id ? (
        <PersonalImage id={report.payload.evidence_image_id} />
      ) : (
        <Text style={{ color: colors.muted }}>此回報沒有圖片佐證</Text>
      )}
      {['post', 'message'].includes(report.payload.kind) ? (
        <PrimaryButton secondary disabled={context.isPending} onPress={() => context.mutate()}>
          查核被檢舉原文
        </PrimaryButton>
      ) : null}
      {context.data ? (
        <Text>查核原文：{context.data.content ?? '內容已不存在或無法提供。'}</Text>
      ) : null}
      {context.error ? <Text accessibilityRole="alert">{coreError(context.error)}</Text> : null}

      {report.payload.kind === 'post' && report.payload.target_id ? (
        <PrimaryButton
          secondary
          onPress={() =>
            router.push({ pathname: '/order/[id]', params: { id: report.payload.target_id! } })
          }
        >
          查看被檢舉拼單
        </PrimaryButton>
      ) : null}
      {report.public_response ? <Text>已回覆：{report.public_response}</Text> : null}
      {stale ? (
        <>
          <Text accessibilityRole="alert">
            查核版本已更新，文字已保留。核對最新狀態後才能再處理。
          </Text>
          <PrimaryButton
            secondary
            onPress={() => {
              setVersion(report.review_version ?? 1);
              mutation.reset();
              setCancelConfirm(false);
            }}
          >
            重新載入查核版本（保留文字）
          </PrimaryButton>
        </>
      ) : null}
      {report.status === 'received' || report.status === 'reviewing' ? (
        <>
          <Text>審核說明（回報者及扣分對象可見）</Text>
          <TextInput
            accessibilityLabel="給回報者的回覆"
            value={response}
            onChangeText={setResponse}
            maxLength={300}
            editable={!mutation.isPending}
            multiline
          />
          <Text>管理者內部備註（不公開）</Text>
          <TextInput
            accessibilityLabel="管理者內部備註"
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            editable={!mutation.isPending}
            multiline
          />
          {report.status === 'received' ? (
            <PrimaryButton disabled={!valid} onPress={() => mutation.mutate('review')}>
              開始查核
            </PrimaryButton>
          ) : (
            <>
              {report.payload.kind !== 'feedback' ? (
                <View
                  style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.surface }}
                >
                  <Text style={{ fontWeight: '700' }}>信譽積分處置</Text>
                  {target.isPending ? (
                    <Text>正在確認對象與積分</Text>
                  ) : target.data?.available ? (
                    <Text>
                      扣分對象：{target.data.name}・目前 {target.data.score} 分
                    </Text>
                  ) : (
                    <Text>無法確認扣分對象，可選擇不扣分處理。</Text>
                  )}
                  <Text>扣除分數（輸入 0 代表不扣分）</Text>
                  <TextInput
                    accessibilityLabel="扣除信譽積分"
                    keyboardType="number-pad"
                    value={points}
                    onChangeText={(value) => {
                      setPoints(value);
                      setPenaltyConfirm(false);
                    }}
                    maxLength={3}
                    editable={!mutation.isPending}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      padding: 10,
                      color: colors.ink,
                    }}
                  />
                  {!penaltyValid ? (
                    <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                      請輸入 0 至對象目前積分之間的整數。
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <PrimaryButton
                disabled={!valid || !penaltyValid}
                onPress={() =>
                  pointValue > 0 ? setPenaltyConfirm(true) : mutation.mutate('resolve')
                }
              >
                檢舉成立並結案
              </PrimaryButton>
              {penaltyConfirm && target.data?.available ? (
                <View style={{ gap: 8 }}>
                  <Text>
                    確認對 {target.data.name} 扣除 {pointValue} 分？系統會發送 App 內通知。
                  </Text>
                  <PrimaryButton
                    disabled={!valid || !penaltyValid}
                    loading={mutation.isPending}
                    onPress={() => mutation.mutate('resolve')}
                  >
                    確認扣分並結案
                  </PrimaryButton>
                  <PrimaryButton secondary onPress={() => setPenaltyConfirm(false)}>
                    返回修改
                  </PrimaryButton>
                </View>
              ) : null}
              <PrimaryButton secondary disabled={!valid} onPress={() => mutation.mutate('dismiss')}>
                檢舉不成立
              </PrimaryButton>
              {report.payload.kind === 'post' ? (
                <PrimaryButton secondary disabled={!valid} onPress={() => setCancelConfirm(true)}>
                  取消被檢舉拼單…
                </PrimaryButton>
              ) : null}
              {report.payload.kind === 'message' ? (
                <PrimaryButton secondary disabled={!valid} onPress={() => setCancelConfirm(true)}>
                  隱藏被檢舉訊息…
                </PrimaryButton>
              ) : null}
              {cancelConfirm ? (
                report.payload.kind === 'message' ? (
                  <>
                    <Text>
                      訊息與聊天室預覽將顯示處置提示，原文保留供查核；不會刪除帳號或自動取消拼單。
                    </Text>
                    <PrimaryButton
                      disabled={!valid}
                      onPress={() => mutation.mutate('hide_message')}
                    >
                      確認隱藏這則訊息並結案
                    </PrimaryButton>
                    <PrimaryButton secondary onPress={() => setCancelConfirm(false)}>
                      保留訊息
                    </PrimaryButton>
                  </>
                ) : (
                  <>
                    <Text>
                      這會取消該拼單、停止加入並使聊天室唯讀；不會刪除帳號或歷史內容。請先核對回報目標及影響。
                    </Text>
                    <PrimaryButton disabled={!valid} onPress={() => mutation.mutate('cancel_post')}>
                      確認取消這筆拼單並結案
                    </PrimaryButton>
                    <PrimaryButton secondary onPress={() => setCancelConfirm(false)}>
                      保留拼單
                    </PrimaryButton>
                  </>
                )
              ) : null}
            </>
          )}
        </>
      ) : null}
      {mutation.error ? (
        <Text accessibilityRole="alert">
          {coreError(mutation.error)} 修改已保留，請重新整理核對狀態；不要重複執行不同處置。
        </Text>
      ) : null}
    </View>
  );
}

export function CoreModerationScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  const key = ['core', actor, 'moderation'];
  const query = useQuery({
    queryKey: key,
    queryFn: moderationApi.reports,
    enabled: !!actor,
    retry: false,
    gcTime: 0,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return (
    <Screen>
      <DetailHeader title="管理回報" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text>查看檢舉內容與佐證後，選擇成立或不成立。回覆會顯示給回報者。</Text>
        <PrimaryButton
          secondary
          onPress={() => {
            void query.refetch();
          }}
        >
          重新整理回報
        </PrimaryButton>
        <PrimaryButton secondary onPress={() => router.push('/appeals')}>
          查看申訴與覆核
        </PrimaryButton>
        {query.isPending ? <PageLoading accessibilityLabel="正在載入管理資料" /> : null}
        {query.error ? <Text accessibilityRole="alert">{coreError(query.error)}</Text> : null}
        {query.data?.items.length === 0 ? <Text>目前沒有回報。</Text> : null}
        {query.data?.items.map((report) => (
          <ReviewCard key={`${actor}:${report.id}`} report={report} refresh={refresh} />
        ))}
      </ScrollView>
    </Screen>
  );
}
