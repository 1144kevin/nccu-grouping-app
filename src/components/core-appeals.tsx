import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { api } from '@/lib/api';
import { coreError, newRequestKey } from '@/lib/core-api';
import { engagementApi } from '@/lib/engagement-api';
import { useAuthStore } from '@/store/auth-store';

type Appeal = { id: string; report_id: string; detail: string; status: 'received' | 'resolved' | 'dismissed'; version: number; response: string };
type Decision = { report_id: string; kind: string; target_id: string };
const statusLabels = { received: '待覆核', resolved: '已覆核結案', dismissed: '覆核後維持原處理' };

function AppealComposer({ reportId, refresh }: { reportId: string; refresh: () => Promise<unknown> }) {
  const [detail, setDetail] = useState('');
  const frozen = useRef<{ detail: string; key: string } | null>(null);
  const request = useMutation({ retry: false, gcTime: 0, mutationFn: async () => {
    const text = detail.trim();
    if (frozen.current?.detail !== text) frozen.current = { detail: text, key: newRequestKey() };
    return api.post(`/moderation/reports/${reportId}/appeal`, { detail: text, request_key: frozen.current.key });
  }, onSuccess: refresh });
  return <View style={{ gap: 10 }}>
    <Text>覆核對象：{reportId}</Text>
    <TextInput accessibilityLabel={`申訴說明 ${reportId}`} multiline maxLength={1000} value={detail} onChangeText={setDetail} editable={!request.isPending && !request.isSuccess} placeholder="請說明不同意之處與新資訊（至少10字）" />
    <PrimaryButton disabled={detail.trim().length < 10 || request.isPending || request.isSuccess} onPress={() => request.mutate()}>送出申訴</PrimaryButton>
    {request.isSuccess ? <Text>申訴已儲存，等待管理者覆核。</Text> : null}
    {request.error ? <Text accessibilityRole="alert">{coreError(request.error)} 說明已保留，原內容重試不會重複新增。</Text> : null}
  </View>;
}

function AppealReview({ value, refresh }: { value: Appeal; refresh: () => Promise<unknown> }) {
  const [response, setResponse] = useState('');
  const [version, setVersion] = useState(value.version);
  const frozen = useRef<{ signature: string; key: string } | null>(null);
  const stale = version !== value.version;
  const request = useMutation({ retry: false, gcTime: 0, mutationFn: async (status: 'resolved' | 'dismissed') => {
    const body = { expected_version: version, response: response.trim(), status };
    const signature = JSON.stringify(body);
    if (frozen.current?.signature !== signature) frozen.current = { signature, key: newRequestKey() };
    return api.post(`/moderation/appeals/${value.id}/review`, { ...body, request_key: frozen.current.key });
  }, onSuccess: refresh });
  return <View style={{ gap: 10, padding: 12, borderWidth: 1 }}>
    <Text>申訴 {value.id} · 原回報 {value.report_id} · {statusLabels[value.status]}</Text><Text>{value.detail}</Text>
    {value.response ? <Text>覆核回覆：{value.response}</Text> : null}
    {value.status === 'received' ? <>
      <TextInput accessibilityLabel={`覆核回覆 ${value.id}`} value={response} onChangeText={setResponse} maxLength={300} multiline editable={!request.isPending} />
      {stale ? <><Text>版本已變更，請核對後重新載入。</Text><PrimaryButton onPress={() => { setVersion(value.version); request.reset(); }}>載入最新版本並保留文字</PrimaryButton></> : null}
      <PrimaryButton disabled={response.trim().length < 5 || request.isPending || stale} onPress={() => request.mutate('resolved')}>記錄覆核結果</PrimaryButton>
      <PrimaryButton secondary disabled={response.trim().length < 5 || request.isPending || stale} onPress={() => request.mutate('dismissed')}>覆核後維持原處理</PrimaryButton>
    </> : null}
    {request.error ? <Text accessibilityRole="alert">{coreError(request.error)} 回覆已保留，請重新整理核對版本。</Text> : null}
  </View>;
}

function Session({ actor }: { actor: string }) {
  const mine = useQuery({ queryKey: ['core', actor, 'appeals'], queryFn: async () => (await api.get<{ items: Appeal[] }>('/moderation/appeals/mine')).data, retry: false, gcTime: 0 });
  const decisions = useQuery({ queryKey: ['core', actor, 'decisions'], queryFn: async () => (await api.get<{ items: Decision[] }>('/moderation/decisions/mine')).data, retry: false, gcTime: 0 });
  const reports = useQuery({ queryKey: ['core', actor, 'reports'], queryFn: engagementApi.reports, retry: false });
  const access = useQuery({ queryKey: ['core', actor, 'moderation-access'], queryFn: async () => (await api.get<{ can_review: boolean }>('/moderation/access')).data, retry: false });
  const operators = useQuery({ queryKey: ['core', actor, 'operator-appeals'], queryFn: async () => (await api.get<{ items: Appeal[] }>('/moderation/appeals')).data, enabled: access.data?.can_review === true, retry: false, gcTime: 0 });
  const refresh = async () => { if (useAuthStore.getState().user?.id !== actor) return; await Promise.all([mine.refetch(), decisions.refetch(), reports.refetch(), ...(access.data?.can_review ? [operators.refetch()] : [])]); };
  const targets = [...new Set([...(reports.data?.items.filter(r => ['resolved', 'dismissed'].includes(r.status)).map(r => r.id) ?? []), ...(decisions.data?.items.map(d => d.report_id) ?? [])])];
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text>對已結案回報或自己受到的內容處置，可就同一事件提出一次申訴。覆核不會自動恢復拼單、名額或任何人的同意。</Text>
    <PrimaryButton secondary onPress={() => { void refresh(); }}>重新整理申訴</PrimaryButton>
    {[mine.error, decisions.error, reports.error, operators.error].filter(Boolean).map((error, i) => <Text key={i} accessibilityRole="alert">{coreError(error)}</Text>)}
    <Text>我的申訴</Text>
    {mine.data?.items.map(a => <View key={a.id}><Text>{statusLabels[a.status]} · {a.report_id}</Text><Text>{a.detail}</Text>{a.response ? <Text>覆核回覆：{a.response}</Text> : null}</View>)}
    {decisions.data?.items.map(d => <Text key={d.report_id}>我的內容已被處置：{d.kind} · {d.target_id}。可使用下方對應回報編號申訴。</Text>)}
    {targets.filter(id => !mine.data?.items.some(a => a.report_id === id)).map(id => <AppealComposer key={id} reportId={id} refresh={refresh} />)}
    {mine.data && !targets.length && !mine.data.items.length ? <Text>目前沒有可申訴的已結案事件。</Text> : null}
    {access.data?.can_review ? <><Text>管理者覆核（最多50筆）</Text>{operators.data?.items.map(a => <AppealReview key={a.id} value={a} refresh={refresh} />)}</> : null}
  </ScrollView>;
}

export function CoreAppealsScreen() {
  const actor = useAuthStore(state => state.user?.id);
  return <Screen><DetailHeader title="申訴與覆核" />{actor ? <Session key={actor} actor={actor} /> : <Text>請先登入。</Text>}</Screen>;
}
