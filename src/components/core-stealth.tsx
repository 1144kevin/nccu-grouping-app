import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { StealthFormation } from '@/components/core-stealth-formation';
import { QuickStealthScreen } from '@/components/quick-stealth';
import { StealthIntake } from '@/components/core-stealth-intake';
import { StealthSemanticMatches, StealthSemanticSummary } from '@/components/core-stealth-semantic';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreClock } from '@/lib/core-clock';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { queryClient } from '@/lib/query-client';
import { buildStealthSignal, stealthApi, type SignalForm, type StealthAgent, type StealthAgentInput, type StealthCategory, type StealthMatch, type StealthRole, type StealthSignal, type StealthSignalInput, type StealthSemanticItem } from '@/lib/stealth-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

const categories: [StealthCategory, string][] = [['meal','正餐'],['pizza','披薩'],['drink','飲料'],['bakery','麵包'],['snack','零食']];
const locations = { main_gate: '政大正門', east_gate: '政大東側門', south_gate: '政大南門' };
const roles: [StealthRole, string][] = [['share','一起分食'],['coupon','提供優惠券'],['order','願意下單'],['pickup','願意順路取餐']];
const avatars = { rice: '🍚', pizza: '🍕', tea: '🧋', cat: '🐱' };
const defaults: SignalForm = { kind: 'need', category: 'meal', alternatives: [], title: '', location: 'main_gate', delay: '60', duration: '120', budget: '', cost: '', tags: '晚餐', requirements: '', verified: '', roles: [] };
function toggle<T>(values: T[], value: T) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function Field({ label, value, onChange, numeric = false, multiline = false, disabled = false, maxLength = 160 }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean; maxLength?: number }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} multiline={multiline} keyboardType={numeric ? 'number-pad' : 'default'} maxLength={maxLength} style={[styles.input, multiline && { minHeight: 80 }]} /></View>;
}
function Choice({ label, checked, onPress, disabled = false }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, checked && styles.selected]}><Text style={styles.body}>{checked ? '✓ ' : ''}{label}</Text></Pressable>;
}
function ErrorText({ error }: { error: unknown }) { return error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(error)}</Text> : null; }

export function CoreStealthScreen() {
  const [advanced, setAdvanced] = useState(false);
  return advanced ? <AdvancedStealthScreen onQuick={() => setAdvanced(false)} /> : <QuickStealthScreen onAdvanced={() => setAdvanced(true)} />;
}

export function AdvancedStealthScreen({ onQuick }: { onQuick?: () => void } = {}) {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const [tab, setTab] = useState<'agent' | 'signals' | 'matches'>('agent');
  const [formRevision, setFormRevision] = useState(0);
  const key = ['core', user?.id, 'stealth'];
  const agent = useQuery({ queryKey: [...key,'agent'], queryFn: stealthApi.agent, enabled: !!user && focused, refetchOnWindowFocus: false });
  const signals = useQuery({ queryKey: [...key,'signals'], queryFn: stealthApi.signals, enabled: !!user && focused, refetchInterval: 10_000 });
  const matches = useQuery({ queryKey: [...key,'matches'], queryFn: stealthApi.matches, enabled: !!user && focused, refetchInterval: 10_000 });
  const clock = useCoreClock();
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: key }); };
  const run = useMutation({ mutationFn: stealthApi.run, onSettled: invalidate });
  const agentReady = !!agent.data?.enabled && !agent.error;
  return <Screen>
    <DetailHeader title="偷揪 · 我的 AI 分身" right={<IconButton icon="refresh" label="重新整理偷揪資料" onPress={() => { void invalidate(); void clock.refetch(); }} />} />
    {onQuick ? <PrimaryButton secondary onPress={onQuick}>回到一句話偷揪</PrimaryButton> : null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.heading}>不用發文，也能被揪</Text><Text style={styles.body}>告訴分身你需要什麼、擁有什麼，或接下來願意做什麼，讓它找出兩到三人的互補機會。</Text><Text style={styles.hint}>免費開發模式：本機模型理解與補問，規則檢查配對及費用分工。原始需求只供本人查看；全員確認同一版方案才成團，沒有代為訂購或付款。</Text></View>
      {clock.data && Math.abs(clock.data.driftMs) > 60_000 ? <Text style={styles.hint}>裝置時間與服務不同，需求與邀請期限以服務時間為準。載入時服務時間：{new Date(clock.data.serverMs).toLocaleString('zh-TW')}</Text> : null}
      <View style={styles.row}>{([['agent','我的分身'],['signals','我的需求'],['matches','偷揪結果']] as const).map(([value,label]) => <PrimaryButton key={value} secondary={tab !== value} onPress={() => setTab(value)}>{label}</PrimaryButton>)}</View>
      {tab === 'agent' ? <>
        <ErrorText error={agent.error} />
        {agent.isPending ? <ActivityIndicator /> : agent.data === undefined ? <PrimaryButton secondary onPress={() => { void agent.refetch(); }}>重試載入分身</PrimaryButton> : <AgentForm key={`${user?.id}:${formRevision}`} initial={agent.data} refresh={invalidate} />}
        {agent.data !== undefined ? <PrimaryButton secondary onPress={() => { void agent.refetch().then((result) => { if (!result.error) setFormRevision((value) => value + 1); }); }}>重新載入已儲存設定（捨棄未儲存內容）</PrimaryButton> : null}
      </> : tab === 'signals' ? <>
        {!agent.data ? <Text style={styles.note}>先到「我的分身」建立並儲存分身，再設定需求。</Text> : !clock.data ? <View><Text style={styles.note}>正在取得服務時間，取得後才能建立需求。</Text><ErrorText error={clock.error} /><PrimaryButton secondary onPress={() => { void clock.refetch(); }}>重試取得時間</PrimaryButton></View> : <SignalEditor key={user?.id} now={clock.now} refresh={invalidate} />}
        <Text style={styles.heading}>我的近期需求（最多顯示 50 筆）</Text>
        <ErrorText error={signals.error} />
        {signals.isPending ? <ActivityIndicator /> : signals.data?.items.length === 0 ? <Text style={styles.hint}>還沒有需求。可以先填「一小時後想一起吃披薩」。</Text> : null}
        {signals.data?.items.map((signal) => <SignalCard key={signal.id} signal={signal} refresh={invalidate} />)}
      </> : <>
        <Text style={styles.note}>建立需求時會嘗試配對；其他人新增相容需求時，你也可能被動收到結果。App 在前景時約每 10 秒更新，沒有手機推播。</Text>
        {agent.error ? <View style={styles.card}>
          <Text style={styles.note}>無法確認已儲存的分身設定，請重試載入。</Text>
          <ErrorText error={agent.error} />
          <PrimaryButton secondary disabled={agent.isFetching} onPress={() => { void agent.refetch(); }}>重試載入分身</PrimaryButton>
        </View> : agent.isPending ? <Text style={styles.note}>正在載入分身設定，完成後即可尋找機會。</Text> : !agentReady ? <View style={styles.card}>
          <Text style={styles.heading}>{agent.data ? '你的分身目前已暫停' : '先建立自己的分身'}</Text>
          <Text style={styles.body}>三個搜尋與分析按鈕需要先啟用分身。請到「我的分身」勾選「開啟偷揪」，再按「儲存我的分身」；只勾選但未儲存不會生效。</Text>
          <PrimaryButton secondary onPress={() => setTab('agent')}>前往設定並啟用分身</PrimaryButton>
        </View> : <Text style={styles.hint}>分身已啟用：先用「讓分身找機會」或「AI 搜尋新配對機會」尋找對象，出現有效配對後即可按「AI 語義排序與判讀」。</Text>}
        {agentReady && !clock.data ? <View style={styles.card}>
          <Text style={styles.note}>尚未取得服務時間，AI 搜尋與判讀暫停；一般尋找機會仍可使用。</Text>
          <ErrorText error={clock.error} />
          <PrimaryButton secondary disabled={clock.isFetching} onPress={() => { void clock.refetch(); }}>重試取得時間</PrimaryButton>
        </View> : null}
        <PrimaryButton disabled={run.isPending || !agentReady || !focused} onPress={() => run.mutate()}>{run.isPending ? '分身尋找中…' : '讓分身找機會'}</PrimaryButton>
        <ErrorText error={run.error ?? matches.error} />
        {run.data ? <Text accessibilityRole="alert" style={styles.note}>這次新增 {run.data.created} 組機會。相同組合不會重複邀請；安靜時段、每日上限與必要條件都會影響結果。</Text> : null}
        {matches.isPending ? <ActivityIndicator /> : matches.data?.items.length === 0 ? <Text style={styles.note}>尚未找到配對。請確認另一位使用者也有開啟分身，且分類、地點、時間與預算相容。示範拼單不會自動變成偷揪需求。</Text> : null}
        <StealthSemanticMatches key={user?.id} matches={matches.data?.items ?? []} disabled={run.isPending || !agentReady || !clock.data} focused={focused} refresh={invalidate} now={clock.data ? clock.now : Date.now} renderMatch={(match, semantic) => <MatchCard key={match.id} match={match} semantic={semantic} refresh={invalidate} now={clock.data ? clock.now : undefined} />} />
      </>}
    </ScrollView>
  </Screen>;
}

export function AgentForm({ initial, refresh }: { initial: StealthAgent | null; refresh: () => Promise<void> }) {
  const actor = useAuthStore((state) => state.user?.id);
  const [name, setName] = useState(initial?.name ?? '我的偷揪分身');
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [savedEnabled, setSavedEnabled] = useState(initial?.enabled ?? false);
  const [includeDemo, setIncludeDemo] = useState(initial?.include_demo ?? false);
  const [avatar, setAvatar] = useState<StealthAgentInput['avatar_key']>(initial?.avatar_key ?? 'cat');
  const [tone, setTone] = useState<StealthAgentInput['tone']>(initial?.tone ?? 'warm');
  const [exploration, setExploration] = useState<StealthAgentInput['exploration']>(initial?.exploration ?? 'familiar');
  const [limit, setLimit] = useState(String(initial?.daily_invite_limit ?? 3));
  const [quiet, setQuiet] = useState(initial ? initial.quiet_start_hour !== null : true);
  const [quietStart, setQuietStart] = useState(String(initial?.quiet_start_hour ?? 22));
  const [quietEnd, setQuietEnd] = useState(String(initial?.quiet_end_hour ?? 8));
  const [version, setVersion] = useState(initial?.version ?? 0);
  const save = useMutation({ mutationFn: () => stealthApi.saveAgent({ name: name.trim(), enabled, include_demo: includeDemo, avatar_key: avatar, tone, exploration, daily_invite_limit: Number(limit), timezone: initial?.timezone ?? 'Asia/Taipei', quiet_start_hour: quiet ? Number(quietStart) : null, quiet_end_hour: quiet ? Number(quietEnd) : null, expected_version: version }),
    onSuccess: async (updated) => { if (useAuthStore.getState().user?.id !== actor) return; setVersion(updated.version); setSavedEnabled(updated.enabled); await refresh(); },
  });
  const valid = name.trim().length > 0 && /^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 10 && (!quiet || (/^\d+$/.test(quietStart) && /^\d+$/.test(quietEnd) && Number(quietStart) <= 23 && Number(quietEnd) <= 23 && Number(quietStart) !== Number(quietEnd)));
  return <View style={styles.card}>
    <Text style={styles.avatar}>{avatars[avatar]}</Text>
    <Field label="分身名稱" value={name} onChange={setName} disabled={save.isPending} maxLength={40} />
    <Text style={styles.label}>捏一個分身外觀</Text><View style={styles.row}>{(Object.keys(avatars) as (keyof typeof avatars)[]).map((value) => <Choice key={value} label={avatars[value]} checked={avatar === value} onPress={() => setAvatar(value)} disabled={save.isPending} />)}</View>
    <Text style={styles.label}>分身說話方式</Text><View style={styles.row}>{([['warm','溫暖'],['direct','直接'],['playful','活潑']] as const).map(([value,label]) => <Choice key={value} label={label} checked={tone === value} onPress={() => setTone(value)} disabled={save.isPending} />)}</View>
    <Text style={styles.label}>探索範圍</Text><Choice label="熟悉偏好：共同需求也需共同標籤" checked={exploration === 'familiar'} onPress={() => setExploration('familiar')} disabled={save.isPending} /><Choice label="多探索一些：相同必要條件即可嘗試" checked={exploration === 'balanced'} onPress={() => setExploration('balanced')} disabled={save.isPending} />
    <Field label="每日最多幾組新邀請（1～10）" value={limit} onChange={setLimit} numeric disabled={save.isPending} maxLength={2} />
    <Choice label="啟用安靜時段" checked={quiet} onPress={() => setQuiet(!quiet)} disabled={save.isPending} />
    {quiet ? <><Field label="安靜開始時（0～23）" value={quietStart} onChange={setQuietStart} numeric disabled={save.isPending} maxLength={2} /><Field label="安靜結束時（0～23）" value={quietEnd} onChange={setQuietEnd} numeric disabled={save.isPending} maxLength={2} /><Text style={styles.hint}>以分身時區 {initial?.timezone ?? 'Asia/Taipei'} 的服務時間判斷；安靜時段不建立新邀請。</Text></> : null}
    <Choice label="開啟偷揪，允許依已確認需求尋找機會" checked={enabled} onPress={() => setEnabled(!enabled)} disabled={save.isPending} />
    <Text accessibilityLiveRegion="polite" style={styles.note}>{enabled !== savedEnabled ? '啟用狀態尚未儲存，請按下方「儲存我的分身」才會生效。' : savedEnabled ? '已儲存狀態：偷揪已啟用。' : '已儲存狀態：偷揪未啟用，搜尋與分析按鈕會暫停。'}</Text>
    <Choice label="也接受清楚標示的示範配對（不是真人）" checked={includeDemo} onPress={() => setIncludeDemo(!includeDemo)} disabled={save.isPending} />
    {includeDemo ? <Text style={styles.hint}>示範資源是「正餐／政大正門／晚餐標籤／已知每人 90 元」，可用相容需求體驗。示範人物不會接受意願或回覆；需求不符仍不配對。</Text> : null}
    <Text style={styles.hint}>開啟分身不代表加入拼單；配對後仍需全員確認費用與分工才會成團。暫停或變更探索範圍會使尚未成團的舊配對失效。</Text>
    <PrimaryButton disabled={!valid || save.isPending} onPress={() => save.mutate()}>{save.isPending ? '儲存中…' : '儲存我的分身'}</PrimaryButton>
    <ErrorText error={save.error} />{save.data ? <Text accessibilityRole="alert" style={styles.note}>分身已儲存在你的 Supabase 帳號，版本 {version}。</Text> : null}
  </View>;
}

export function SignalEditor({ now, refresh, localOnly = false }: { now: () => number; refresh: () => Promise<void>; localOnly?: boolean }) {
  const [form, setForm] = useState<SignalForm>(defaults);
  const [intakeRevision, setIntakeRevision] = useState(0);
  const frozen = useRef<{ signature: string; value: StealthSignalInput; key: string } | null>(null);
  const change = <K extends keyof SignalForm>(key: K, value: SignalForm[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = useMutation({ mutationFn: () => {
    if (localOnly) throw new Error('local_draft_only');
    const signature = JSON.stringify(form);
    if (frozen.current?.signature !== signature) frozen.current = { signature, value: buildStealthSignal(form, now()), key: newRequestKey() };
    return stealthApi.create(frozen.current.value, frozen.current.key);
  }, onSuccess: async () => { frozen.current = null; setIntakeRevision((value) => value + 1); setForm((value) => ({ ...value, title: '' })); await refresh(); } });
  const draft = useMutation({ mutationFn: () => stealthApi.draft(form.title), onSuccess: (value) => setForm((previous) => ({ ...previous, category: value.category_hint ?? previous.category, location: value.location_hint ?? previous.location })) });
  const busy = save.isPending || draft.isPending;
  const stateLabels = { completed: '分身已完成一次尋找，可到偷揪結果查看。', paused: '分身尚未開啟；開啟並儲存後可尋找配對。', quiet: '目前是安靜時段，暫未尋找。', cooldown: '剛剛已尋找過；稍後可到結果頁手動尋找。', unavailable: '需求已保存，這次配對暫時無法完成；稍後可重試尋找。' };
  return <View style={styles.card}>
    <StealthIntake key={intakeRevision} disabled={busy} onApplySummary={(title) => { frozen.current = null; setForm(previous => ({ ...previous, title })); draft.reset(); save.reset(); }} onApply={(value) => { frozen.current = null; setForm(value); draft.reset(); save.reset(); }} />
    <Text style={styles.heading}>告訴分身一件事</Text>
    <View style={styles.row}>{([['need','我需要'],['offer','我擁有'],['plan','我即將做']] as const).map(([value,label]) => <Choice key={value} label={label} checked={form.kind === value} onPress={() => change('kind',value)} disabled={busy} />)}</View>
    <Field label="我的需求或計畫（只有自己可見）" value={form.title} onChange={(value) => change('title',value)} multiline disabled={busy} />
    {!localOnly ? <PrimaryButton secondary disabled={!form.title.trim() || busy} onPress={() => draft.mutate()}>整理需求草稿（免費關鍵字提示）</PrimaryButton> : null}
    {draft.data ? <Text style={styles.hint}>已提示分類與地點，請自行確認下方欄位。這是關鍵字草稿，不是大型模型理解結果；沒有自動保存。</Text> : null}
    <ErrorText error={draft.error} />
    <Text style={styles.label}>餐點分類</Text><View style={styles.row}>{categories.map(([value,label]) => <Choice key={value} label={label} checked={form.category === value} onPress={() => change('category',value)} disabled={busy} />)}</View>
    {form.kind !== 'offer' ? <><Text style={styles.label}>我也明確接受的類型（可不選）</Text><View style={styles.row}>{categories.filter(([value]) => value !== form.category).map(([value,label]) => <Choice key={value} label={`也接受${label}`} checked={form.alternatives.includes(value)} onPress={() => change('alternatives',toggle(form.alternatives,value))} disabled={busy} />)}</View></> : <Text style={styles.hint}>資源請填實際擁有的類型，不能以替代選項表示不存在的資源。</Text>}
    <Text style={styles.label}>取餐範圍</Text><View style={styles.row}>{(Object.keys(locations) as (keyof typeof locations)[]).map((value) => <Choice key={value} label={locations[value]} checked={form.location === value} onPress={() => change('location',value)} disabled={busy} />)}</View>
    <Field label="從服務時間幾分鐘後開始" value={form.delay} onChange={(value) => change('delay',value)} numeric disabled={busy} maxLength={5} />
    <Field label="可配合多久（15～1440 分鐘）" value={form.duration} onChange={(value) => change('duration',value)} numeric disabled={busy} maxLength={4} />
    <Text style={styles.hint}>使用資料庫時間建立區間；需求在區間結束時失效。邀請最多保留 30 分鐘，也可能因開始時間或撤回而提早失效。</Text>
    <Field label="每人預算上限（整數，留白未知）" value={form.budget} onChange={(value) => change('budget',value)} numeric disabled={busy} maxLength={6} />
    <Field label="已知每人費用（整數，留白未知）" value={form.cost} onChange={(value) => change('cost',value)} numeric disabled={busy} maxLength={6} />
    <Field label="共同偏好標籤（逗號分隔）" value={form.tags} onChange={(value) => change('tags',value)} disabled={busy} maxLength={395} />
    <Text style={styles.label}>我明確願意貢獻的角色</Text><View style={styles.row}>{roles.map(([value,label]) => <Choice key={value} label={label} checked={form.roles.includes(value)} onPress={() => change('roles',toggle(form.roles,value))} disabled={busy} />)}</View>
    <Text style={styles.hint}>「我即將做」必須勾選願意順路取餐；單純路過不代表承諾。資源至少需一種角色。</Text>
    <Field label="必要飲食條件（逗號分隔，可留白）" value={form.requirements} onChange={(value) => change('requirements',value)} disabled={busy} maxLength={395} />
    <Field label="我已確認的餐點條件（逗號分隔）" value={form.verified} onChange={(value) => change('verified',value)} disabled={busy} maxLength={395} />
    <Text style={styles.hint}>缺少必要飲食資訊就不配對；本人提供的資訊不等於商家認證或過敏安全保證。</Text>
    {localOnly ? <Text style={styles.note}>這是本機核對草稿，尚未儲存。正式儲存與配對需連接開發 API 並登入本人帳號。</Text> : <PrimaryButton disabled={!form.title.trim() || busy} onPress={() => save.mutate()}>{save.isPending ? '儲存並尋找中…' : '確認需求並交給分身'}</PrimaryButton>}
    <ErrorText error={save.error} />
    {save.error ? <Text style={styles.hint}>內容仍保留，未更改內容的重試沿用同一筆請求，不重複新增。</Text> : null}
    {save.data ? <Text accessibilityRole="alert" style={styles.note}>需求已存入資料庫。{stateLabels[save.data.matching]}</Text> : null}
  </View>;
}

function SignalCard({ signal, refresh }: { signal: StealthSignal; refresh: () => Promise<void> }) {
  const revoke = useMutation({ mutationFn: () => stealthApi.revoke(signal.id), onSettled: refresh });
  return <View style={styles.card}>
    <Text style={styles.title}>{signal.title}</Text><Text style={styles.hint}>{({need:'我需要',offer:'我擁有',plan:'我即將做'} as const)[signal.kind]} · {locations[signal.location_id]} · {signal.status === 'consumed' ? '已用於成團' : signal.status === 'revoked' ? '已撤回' : '已保存（有效性依截止時間判斷）'}</Text>
    <Text style={styles.body}>{new Date(signal.starts_at).toLocaleString('zh-TW')} ～ {new Date(signal.ends_at).toLocaleString('zh-TW')}</Text>
    {signal.status === 'active' ? <PrimaryButton secondary disabled={revoke.isPending} onPress={() => revoke.mutate()}>撤回需求並使配對失效</PrimaryButton> : null}<ErrorText error={revoke.error} />
  </View>;
}

function MatchCard({ match, semantic, refresh, now }: { match: StealthMatch; semantic?: StealthSemanticItem; refresh: () => Promise<void>; now?: () => number }) {
  const mutation = useMutation({ mutationFn: (decision: 'accepted' | 'declined') => stealthApi.decide(match.id,decision), onSettled: refresh });
  return <View testID={`stealth-match-${match.id}`} style={styles.card}>
    <Text style={styles.title}>{match.invitation_text}</Text><Text style={styles.hint}>{match.member_count} 人 · {categories.find(([value]) => value === match.category)?.[1]} · {locations[match.location_id]}</Text>
    {match.is_demo ? <Text style={styles.note}>示範配對 · 包含虛構資源，沒有真實訂購。示範人物不會自動回覆或接受意願。</Text> : null}
    <Text style={styles.body}>來自你的需求：{match.my_signal_title}</Text>
    <Text style={styles.body}>{new Date(match.starts_at).toLocaleString('zh-TW')} ～ {new Date(match.ends_at).toLocaleString('zh-TW')}</Text>
    <Text style={styles.hint}>邀請期限：{new Date(match.expires_at).toLocaleString('zh-TW')}</Text>
    <Text style={styles.body}>每人已知費用：{match.known_cost_twd === null ? '尚未確認' : `NT$ ${match.known_cost_twd}`} · 共同預算上限：{match.budget_max_twd === null ? '未提供' : `NT$ ${match.budget_max_twd}`}</Text>
    <Text style={styles.hint}>條件排序分數 {match.score}／100，屬規則評分，並非成團機率。</Text>
    {semantic ? <StealthSemanticSummary item={semantic} match={match} /> : null}
    <Text style={styles.label}>為什麼揪你</Text>{[...match.reasons,...match.why_me].map((reason) => <Text key={reason} style={styles.body}>• {reason}</Text>)}
    {match.unknowns.length ? <><Text style={styles.label}>仍需確認</Text>{match.unknowns.map((unknown) => <Text key={unknown} style={styles.hint}>• {unknown}</Text>)}</> : null}
    <Text style={styles.note}>{match.status === 'formed' ? '已正式成團。' : match.status === 'unavailable' ? '這組機會已失效，不再接受意願。' : match.status === 'ready' ? '大家都有意願，還需要確認最終方案。' : match.my_decision === 'accepted' ? '你已表示有意願，仍需確認費用與分工。' : '這是私人配對邀請，先由你決定是否有意願。'}</Text>
    <StealthFormation key={match.id} match={match} refresh={refresh} now={now} />
    {match.status !== 'unavailable' && match.status !== 'formed' ? <View style={styles.row}>{match.my_decision !== 'accepted' ? <PrimaryButton disabled={mutation.isPending} onPress={() => mutation.mutate('accepted')}>我有意願</PrimaryButton> : null}<PrimaryButton secondary disabled={mutation.isPending} onPress={() => mutation.mutate('declined')}>{match.my_decision === 'accepted' ? '撤回我的意願' : '這次先不要'}</PrimaryButton></View> : null}
    <ErrorText error={mutation.error} />
  </View>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  hero: { padding: spacing.md, backgroundColor: colors.yellowSoft, borderRadius: radius.md, gap: spacing.sm },
  heading: { fontSize: 21, fontWeight: '700', color: colors.ink, lineHeight: 30 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, lineHeight: 25 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23 }, hint: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  choice: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }, selected: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  field: { gap: 5 }, input: { minHeight: 45, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  avatar: { fontSize: 46, textAlign: 'center' }, note: { fontSize: 14, lineHeight: 23, color: colors.brown, paddingVertical: spacing.sm },
  error: { color: colors.danger, fontSize: 14, lineHeight: 23 },
});
