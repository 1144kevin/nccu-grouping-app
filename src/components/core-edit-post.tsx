import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { DeadlinePickerModal, formatDeadline, startOfDay } from '@/components/deadline-picker';
import { LocalLocationPicker } from '@/components/local-location-picker';
import { coreApi, coreError, type CorePost } from '@/lib/core-api';
import { invalidateCore, useCorePost } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import type { PostLocation } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';
import { useCoreClock } from '@/lib/core-clock';

export function CoreEditPostScreen({ id }: { id: string }) {
  const query = useCorePost(id);
  const clock = useCoreClock();
  if (!query.data) return <Screen><DetailHeader title="編輯拼單" />{query.isPending ? <ActivityIndicator /> : <View><Text>{coreError(query.error)}</Text><PrimaryButton onPress={() => { void query.refetch(); }}>重試</PrimaryButton></View>}</Screen>;
  if (query.data.my_status !== 'host') return <Screen><DetailHeader title="編輯拼單" /><Text>只有主揪可以修改這筆拼單。</Text></Screen>;
  if (!clock.data) return <Screen><DetailHeader title="編輯拼單" /><Text>{clock.isPending ? '正在取得截止時間基準…' : coreError(clock.error)}</Text><PrimaryButton secondary onPress={() => { void clock.refetch(); }}>重新取得時間</PrimaryButton></Screen>;
  return <PostForm key={query.data.id} post={query.data} now={clock.now} clockDrift={Math.abs(clock.data.driftMs) > 60_000} />;
}

function PostForm({ post, now, clockDrift }: { post: CorePost; now: () => number; clockDrift: boolean }) {
  const [content, setContent] = useState(post.content);
  const [tagText, setTagText] = useState(post.tags.join('、'));
  const [capacity, setCapacity] = useState(String(post.capacity));
  const [price, setPrice] = useState(post.price_per_person ?? '');
  const [location, setLocation] = useState<PostLocation | undefined>(post.location);
  const [locationKey, setLocationKey] = useState(0);
  const [deadline, setDeadline] = useState(new Date(post.deadline_at));
  const [draftDeadline, setDraftDeadline] = useState(deadline);
  const [deadlineVisible, setDeadlineVisible] = useState(false);
  const [deadlineStartDate, setDeadlineStartDate] = useState(() => startOfDay(now()));
  const [clockReference] = useState(() => formatDeadline(new Date(now())));
  const [deadlineError, setDeadlineError] = useState('');
  const [version, setVersion] = useState(post.version ?? 1);
  const tags = [...new Set(tagText.split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean))];
  const valid = content.trim().length >= 10 && content.trim().length <= 500
    && /^\d+$/.test(capacity) && Number(capacity) >= 2 && Number(capacity) <= 20
    && (price.trim() === '' || /^\d{1,6}(\.\d{1,2})?$/.test(price.trim()))
    && tags.length >= 1 && tags.length <= 10 && tags.every((tag) => tag.length <= 40) && !!location;
  const mutation = useMutation({
    mutationFn: () => coreApi.edit(post.id, {
      content: content.trim(), tags, capacity: Number(capacity), price_per_person: price.trim() || null,
      location: location!, deadline_at: deadline.toISOString(), expected_version: version,
    }),
    onSuccess: async () => {
      await invalidateCore();
      if (useAuthStore.getState().user?.id === post.author_id) {
        if (router.canGoBack()) router.back(); else router.replace(`/order/${post.id}`);
      }
    },
  });
  const reload = useMutation({
    mutationFn: () => coreApi.post(post.id),
    onSuccess: async (updated) => {
      setContent(updated.content); setTagText(updated.tags.join('、'));
      setCapacity(String(updated.capacity)); setPrice(updated.price_per_person ?? '');
      setLocation(updated.location); setLocationKey((key) => key + 1);
      setDeadline(new Date(updated.deadline_at)); setVersion(updated.version ?? 1);
      mutation.reset(); await invalidateCore();
    },
  });
  const busy = mutation.isPending || reload.isPending;
  const allowed = post.can_edit === true;
  function applyDeadline() {
    if (draftDeadline.getTime() <= now()) { setDeadlineError('請選擇晚於現在的截止時間。'); return; }
    setDeadline(new Date(draftDeadline)); setDeadlineVisible(false); setDeadlineError('');
  }
  return <Screen>
    <DetailHeader title="編輯拼單" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {clockDrift ? <Text style={styles.hint}>裝置與服務時間不同，截止時間以服務時間為準。載入時服務時間：{clockReference}</Text> : null}
      <Text style={styles.hint}>{allowed ? '僅在沒有待處理申請或團員時可修改。' : post.status === 'expired' || post.status === 'cancelled' ? '拼單已截止或取消，無法修改。' : '已有待處理申請或團員，請先處理申請，或取消後重新發布。'}</Text>
      <Text style={styles.label}>拼單內容</Text><TextInput accessibilityLabel="拼單內容" multiline value={content} onChangeText={setContent} maxLength={500} editable={!busy && allowed} style={[styles.input, { minHeight: 100 }]} />
      <Text style={styles.label}>標籤（以頓號或逗號分隔）</Text><TextInput accessibilityLabel="拼單標籤" value={tagText} onChangeText={setTagText} maxLength={410} editable={!busy && allowed} style={styles.input} />
      <Text style={styles.label}>人數（含主揪，2～20 人）</Text><TextInput accessibilityLabel="拼單人數" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" editable={!busy && allowed} style={styles.input} />
      <Text style={styles.label}>每人預估金額（留白為待確認）</Text><TextInput accessibilityLabel="拼單金額" value={price} onChangeText={setPrice} keyboardType="decimal-pad" editable={!busy && allowed} style={styles.input} />
      <PrimaryButton secondary disabled={busy || !allowed} onPress={() => { setDeadlineStartDate(startOfDay(now())); setDraftDeadline(new Date(deadline)); setDeadlineVisible(true); }}>截止：{formatDeadline(deadline)}</PrimaryButton>
      {deadlineError ? <Text accessibilityRole="alert" style={styles.error}>{deadlineError}</Text> : null}
      <Text style={styles.label}>取餐地點</Text><LocalLocationPicker key={locationKey} value={location} onChange={setLocation} />
      {mutation.error || reload.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(mutation.error ?? reload.error)}</Text> : null}
      <PrimaryButton disabled={busy || !allowed || !valid} onPress={() => mutation.mutate()}>{busy ? '處理中…' : '儲存拼單變更'}</PrimaryButton>
      <PrimaryButton secondary disabled={busy} onPress={() => reload.mutate()}>重新載入已儲存內容</PrimaryButton>
    </ScrollView>
    <DeadlinePickerModal startDate={deadlineStartDate} value={draftDeadline} visible={deadlineVisible} onChange={setDraftDeadline} onApply={applyDeadline} onClose={() => setDeadlineVisible(false)} />
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  input: { minHeight: 46, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.ink, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 14 },
});
