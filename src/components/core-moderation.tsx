import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { api } from '@/lib/api';
import { coreError, newRequestKey } from '@/lib/core-api';
import type { Report, ReportInput } from '@/lib/engagement-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';

type OperatorReport = Pick<Report, 'id' | 'status' | 'review_version' | 'public_response' | 'created_at'> & { payload: ReportInput };
type Action = 'review' | 'resolve' | 'dismiss' | 'cancel_post' | 'hide_message';
export const moderationApi = {
  reports: async () => (await api.get<{ items: OperatorReport[] }>('/moderation/reports')).data,
  review: async (id: string, value: { expected_version: number; action: Action; public_response: string; internal_note: string; request_key: string }) => (await api.post(`/moderation/reports/${id}/review`, value)).data,
};

function ReviewCard({ report, refresh }: { report: OperatorReport; refresh: () => Promise<unknown> }) {
  const context = useMutation({ retry: false, gcTime: 0, mutationFn: async () => (await api.get<{ content?: string; unavailable?: boolean }>(`/moderation/reports/${report.id}/context`)).data });
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [version, setVersion] = useState(report.review_version ?? 1);
  const stale = version !== (report.review_version ?? 1);
  const frozen = useRef<{ signature: string; key: string } | null>(null);
  const mutation = useMutation({ retry: false, mutationFn: (action: Action) => {
    const value = { expected_version: version, action, public_response: response.trim(), internal_note: note.trim() };
    const signature = JSON.stringify(value);
    if (frozen.current?.signature !== signature) frozen.current = { signature, key: newRequestKey() };
    return moderationApi.review(report.id, { ...value, request_key: frozen.current.key });
  }, onSuccess: async result => { setCancelConfirm(false); setVersion(result.review_version); setResponse(''); setNote(''); await refresh(); } });
  const valid = response.trim().length >= 5 && !mutation.isPending && !stale;
  return <View style={{ padding: 16, gap: 10, borderWidth: 1, borderColor: '#ddd' }}>
    <Text>{report.id} · {report.status} · 第 {report.review_version ?? 1} 版</Text>
    <Text>{report.payload.kind} · {report.payload.reason}</Text>
    <Text>{report.payload.detail}</Text>
    {['post', 'message'].includes(report.payload.kind) ? <PrimaryButton secondary disabled={context.isPending} onPress={() => context.mutate()}>查核被檢舉原文</PrimaryButton> : null}
    {context.data ? <Text>查核原文：{context.data.content ?? '內容已不存在或無法提供。'}</Text> : null}
    {context.error ? <Text accessibilityRole="alert">{coreError(context.error)}</Text> : null}
    {report.payload.target_id ? <Text>回報目標：{report.payload.target_id}</Text> : null}
    {report.payload.kind === 'post' && report.payload.target_id ? <PrimaryButton secondary onPress={() => router.push({ pathname: '/order/[id]', params: { id: report.payload.target_id! } })}>查看被檢舉拼單</PrimaryButton> : null}
    {report.public_response ? <Text>已回覆：{report.public_response}</Text> : null}
    {stale ? <><Text accessibilityRole="alert">查核版本已更新，文字已保留。核對最新狀態後才能再處理。</Text><PrimaryButton secondary onPress={() => { setVersion(report.review_version ?? 1); mutation.reset(); setCancelConfirm(false); }}>重新載入查核版本（保留文字）</PrimaryButton></> : null}
    {report.status === 'received' || report.status === 'reviewing' ? <>
      <Text>給回報者的回覆（會顯示給本人）</Text>
      <TextInput accessibilityLabel="給回報者的回覆" value={response} onChangeText={setResponse} maxLength={300} editable={!mutation.isPending} multiline />
      <Text>管理者內部備註（不公開）</Text>
      <TextInput accessibilityLabel="管理者內部備註" value={note} onChangeText={setNote} maxLength={1000} editable={!mutation.isPending} multiline />
      {report.status === 'received' ? <PrimaryButton disabled={!valid} onPress={() => mutation.mutate('review')}>開始查核</PrimaryButton> : <>
        <PrimaryButton disabled={!valid} onPress={() => mutation.mutate('resolve')}>記錄處理結果並結案</PrimaryButton>
        <PrimaryButton secondary disabled={!valid} onPress={() => mutation.mutate('dismiss')}>查核後不成立</PrimaryButton>
        {report.payload.kind === 'post' ? <PrimaryButton secondary disabled={!valid} onPress={() => setCancelConfirm(true)}>取消被檢舉拼單…</PrimaryButton> : null}
        {report.payload.kind === 'message' ? <PrimaryButton secondary disabled={!valid} onPress={() => setCancelConfirm(true)}>隱藏被檢舉訊息…</PrimaryButton> : null}
        {cancelConfirm ? report.payload.kind === 'message' ? <><Text>訊息與聊天室預覽將顯示處置提示，原文保留供查核；不會刪除帳號或自動取消拼單。</Text><PrimaryButton disabled={!valid} onPress={() => mutation.mutate('hide_message')}>確認隱藏這則訊息並結案</PrimaryButton><PrimaryButton secondary onPress={() => setCancelConfirm(false)}>保留訊息</PrimaryButton></> : <><Text>這會取消該拼單、停止加入並使聊天室唯讀；不會刪除帳號或歷史內容。請先核對回報目標及影響。</Text><PrimaryButton disabled={!valid} onPress={() => mutation.mutate('cancel_post')}>確認取消這筆拼單並結案</PrimaryButton><PrimaryButton secondary onPress={() => setCancelConfirm(false)}>保留拼單</PrimaryButton></> : null}
      </>}
    </> : null}
    {mutation.error ? <Text accessibilityRole="alert">{coreError(mutation.error)} 修改已保留，請重新整理核對狀態；不要重複執行不同處置。</Text> : null}
  </View>;
}

export function CoreModerationScreen() {
  const actor = useAuthStore(state => state.user?.id);
  const key = ['core', actor, 'moderation'];
  const query = useQuery({ queryKey: key, queryFn: moderationApi.reports, enabled: !!actor, retry: false, gcTime: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return <Screen><DetailHeader title="回報查核" /><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text>僅限授權管理者。先查核再處理，回覆會提供給回報者，內部備註不會公開。結案紀錄不代表已自動移除內容。</Text>
    <PrimaryButton secondary onPress={() => { void query.refetch(); }}>重新整理回報</PrimaryButton>
    <PrimaryButton secondary onPress={() => router.push('/appeals')}>查看申訴與覆核</PrimaryButton>
    {query.isPending ? <Text>載入中…</Text> : null}
    {query.error ? <Text accessibilityRole="alert">{coreError(query.error)}</Text> : null}
    {query.data?.items.length === 0 ? <Text>目前沒有回報。</Text> : null}
    {query.data?.items.map(report => <ReviewCard key={`${actor}:${report.id}`} report={report} refresh={refresh} />)}
  </ScrollView></Screen>;
}
