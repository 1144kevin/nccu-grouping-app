import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { IconButton, PrimaryButton, SectionTitle, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { LocationPicker } from '@/components/location-picker';
import { LocalLocationPicker } from '@/components/local-location-picker';
import { DeadlinePickerModal, createInitialDeadline, startOfDay, formatDeadline } from '@/components/deadline-picker';
import { CORE_API_ENABLED, coreApi, coreError, newRequestKey } from '@/lib/core-api';
import { useCoreClock } from '@/lib/core-clock';
import { invalidateCore } from '@/lib/core-hooks';
import { TagChip } from '@/components/tag-chip';
import { SettingField } from '@/components/setting-field';
import { parsePrice, priceInputSchema } from '@/lib/price';
import { capacityInputSchema } from '@/lib/capacity';
import { postLocationSchema } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const schema = z.object({ content: z.string().trim().min(10, '至少輸入 10 個字').max(500, '最多 500 個字'), location: postLocationSchema, price: priceInputSchema, capacity: capacityInputSchema }).superRefine((value, context) => {
  if (CORE_API_ENABLED && (Number(value.capacity) < 2 || Number(value.capacity) > 20)) context.addIssue({ code: 'custom', path: ['capacity'], message: '本機拼單人數需為 2～20 人（含主揪）' });
});
type FormValues = z.infer<typeof schema>;
const suggestedTags = ['拼單', '政大附近', '東側門', '麵包', '法國可頌'];

export default function CreateScreen() {
  return CORE_API_ENABLED ? <ClockReadyCreate /> : <CreateForm />;
}

function ClockReadyCreate() {
  const clock = useCoreClock();
  if (!clock.data) return <Screen><View style={{ padding: spacing.lg, gap: spacing.md }}><Text>{clock.isPending ? '正在取得截止時間基準…' : coreError(clock.error)}</Text><PrimaryButton secondary disabled={clock.isFetching} onPress={() => { void clock.refetch(); }}>重新取得時間</PrimaryButton></View></Screen>;
  return <CreateForm now={clock.now} clockDrift={Math.abs(clock.data.driftMs) > 60_000} />;
}

function CreateForm({ now = Date.now, clockDrift = false }: { now?: () => number; clockDrift?: boolean }) {
  const publishPost = useAppStore((state) => state.publishPost);
  const publication = useRef<{ payload: string; key: string } | null>(null);
  const publishing = useRef(false);
  const [tags, setTags] = useState(['拼單']);
  const [imageUri, setImageUri] = useState<string>();
  const [voiceUri, setVoiceUri] = useState<string>();
  const [deadline, setDeadline] = useState(() => createInitialDeadline(now()));
  const [draftDeadline, setDraftDeadline] = useState(deadline);
  const [deadlineStartDate, setDeadlineStartDate] = useState(() => startOfDay(now()));
  const [clockReference] = useState(() => formatDeadline(new Date(now())));
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [locationKey, setLocationKey] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const { control, handleSubmit, formState: { errors, isValid, isDirty, isSubmitting }, setValue, setError, clearErrors, reset } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { content: '', price: '', capacity: '4' } });
  const content = useWatch({ control, name: 'content' });
  const capacityInput = useWatch({ control, name: 'capacity' });
  const capacity = Number(capacityInput);

  function stepCapacity(amount: number) {
    const current = Number.isSafeInteger(capacity) && capacityInput.trim() !== '' ? capacity : 1;
    setValue('capacity', String(CORE_API_ENABLED ? Math.min(20, Math.max(2, current + amount)) : Math.max(1, current + amount)), { shouldDirty: true, shouldValidate: true });
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('需要照片權限', '請允許讀取照片，才能加入拼單圖片。');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      setVoiceUri(recorder.uri ?? undefined);
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return Alert.alert('需要麥克風權限', '請允許使用麥克風，才能建立語音貼文。');
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  function close() {
    if (!isDirty && !imageUri && !voiceUri) return router.replace('/');
    Alert.alert('捨棄這篇貼文？', '尚未發布的內容不會被保留。', [{ text: '繼續編輯', style: 'cancel' }, { text: '捨棄', style: 'destructive', onPress: () => router.replace('/') }]);
  }

  const submit = () => handleSubmit(async (values) => {
    if (publishing.current) return;
    if (!tags.length) return Alert.alert('請選擇標籤', '至少需要一個主題標籤。');
    publishing.current = true;
    clearErrors('root');
    try {
    if (CORE_API_ENABLED) {
      const input = { content: values.content.trim(), location: values.location, tags, deadline_at: deadline.toISOString(), capacity: Number(values.capacity), price_per_person: values.price.trim() || null };
      const payload = JSON.stringify(input);
      if (deadline.getTime() <= now() && publication.current?.payload !== payload) throw new Error('deadline_must_be_within_14_days');
      if (publication.current?.payload !== payload) publication.current = { payload, key: newRequestKey() };
      await coreApi.create(input, publication.current.key);
      await invalidateCore();
    } else {
      publishPost({ content: values.content.trim(), location: values.location, pricePerPerson: parsePrice(values.price), tags, deadline: formatDeadline(deadline), capacity: Number(values.capacity), imageUrl: imageUri, voiceUri });
    }
    publication.current = null;
    reset();
    setLocationKey((key) => key + 1);
    setImageUri(undefined);
    setVoiceUri(undefined);
    setTags(['拼單']);
    router.replace('/');
    } catch (error) { setError('root.server', { message: coreError(error) }); }
    finally { publishing.current = false; }
  })();

  function addCustomTag() {
    const tag = customTag.trim().slice(0, 12);
    if (!tag) return;
    setTags((items) => [...new Set([...items, tag])]);
    setCustomTag('');
    setTagModalVisible(false);
  }

  function openDeadlinePicker() {
    setDeadlineStartDate(startOfDay(now()));
    setDraftDeadline(new Date(deadline));
    setDeadlineModalVisible(true);
  }

  function applyDeadline() {
    if (draftDeadline.getTime() <= now()) {
      Alert.alert('截止時間已過', '請選擇晚於目前時間的截止時間。');
      return;
    }
    setDeadline(new Date(draftDeadline));
    setDeadlineModalVisible(false);
  }

  return (
    <Screen>
      <View style={styles.header}><IconButton icon="close" label="關閉" disabled={isSubmitting} onPress={close} /><Text style={styles.title}>建立新貼文</Text><Pressable accessibilityRole="button" disabled={!isValid || !tags.length || isSubmitting} onPress={submit} style={[styles.publish, (!isValid || !tags.length || isSubmitting) && styles.publishDisabled]}><Text style={styles.publishText}>{isSubmitting ? '發布中…' : '發布'}</Text></Pressable></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {clockDrift ? <Text style={{ color: colors.muted, fontSize: 13 }}>裝置與服務時間不同，截止時間以服務時間為準。載入時服務時間：{clockReference}</Text> : null}
          {errors.root?.server ? <Text accessibilityRole="alert" style={styles.error}>{errors.root.server.message}</Text> : null}
          {CORE_API_ENABLED ? <Text style={styles.fieldHint}>本機連線版先支援文字拼單；圖片與錄音上傳尚未串接。</Text> : <View style={styles.mediaRow}>
            {imageUri && <View><Image source={{ uri: imageUri }} style={styles.thumbnail} /><Pressable onPress={() => setImageUri(undefined)} style={styles.removeMedia}><MaterialCommunityIcons name="close" size={15} color="#FFFFFF" /></Pressable></View>}
            <Pressable onPress={pickImage} style={styles.mediaButton}><MaterialCommunityIcons name="image-plus-outline" size={21} color={colors.ink} /><Text style={styles.mediaLabel}>新增圖片</Text></Pressable>
            <Pressable onPress={toggleRecording} style={[styles.mediaButton, recorderState.isRecording && styles.recording]}><MaterialCommunityIcons name={recorderState.isRecording ? 'stop' : 'microphone-outline'} size={21} color={recorderState.isRecording ? colors.danger : colors.ink} /><Text style={styles.mediaLabel}>{recorderState.isRecording ? `${Math.max(1, Math.round(recorderState.durationMillis / 1000))} 秒` : voiceUri ? '已錄音' : '語音'}</Text></Pressable>
          </View>}
          <Controller control={control} name="content" render={({ field: { onChange, onBlur, value } }) => <TextInput autoFocus multiline maxLength={500} value={value} onBlur={onBlur} onChangeText={onChange} placeholder="分享想揪的餐點、價格、取餐地點等資訊..." placeholderTextColor={colors.subtle} style={styles.editor} textAlignVertical="top" />} />
          <View style={styles.counterRow}><Text style={styles.error}>{errors.content?.message}</Text><Text style={styles.counter}>{content.length}/500</Text></View>
          <SectionTitle>主題標籤</SectionTitle>
          <View style={styles.tagRow}>
            {[...new Set([...suggestedTags, ...tags])].map((tag) => (
              <TagChip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => setTags((items) => items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag])} />
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="新增標籤" onPress={() => setTagModalVisible(true)} style={({ pressed }) => [styles.addTag, pressed && { opacity: 0.6 }]}>
              <MaterialCommunityIcons name="plus" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <SectionTitle>拼單設定</SectionTitle>
          <SettingField icon="clock-outline" title="截止時間">
            <Pressable accessibilityRole="button" accessibilityLabel="選擇截止時間" onPress={openDeadlinePicker} style={styles.settingControl}><Text style={styles.controlValue}>{formatDeadline(deadline)}</Text><MaterialCommunityIcons name="chevron-right" size={17} color={colors.muted} /></Pressable>
          </SettingField>
          <SettingField icon="account-group-outline" title="需求人數">
            <View style={styles.settingControl}><Text style={styles.peopleHint}>含主揪</Text><IconButton icon="minus" label="減少人數" disabled={capacity === (CORE_API_ENABLED ? 2 : 1)} onPress={() => stepCapacity(-1)} /><Controller control={control} name="capacity" render={({ field: { onChange, onBlur, value } }) => <TextInput accessibilityLabel="需求人數" keyboardType="number-pad" inputMode="numeric" selectTextOnFocus value={value} onChangeText={onChange} onBlur={onBlur} style={styles.capacity} />} /><Text style={styles.currency}>人</Text><IconButton icon="plus" label="增加人數" disabled={CORE_API_ENABLED && capacity >= 20} onPress={() => stepCapacity(1)} /></View>
            {errors.capacity ? <Text style={styles.fieldError}>{errors.capacity.message}</Text> : null}
          </SettingField>
          <SettingField icon="cash" title="每人預估金額">
            <View style={styles.settingControl}><Text style={styles.currency}>NT$</Text><Controller control={control} name="price" render={({ field: { onChange, onBlur, value } }) => <TextInput accessibilityLabel="每人預估金額" keyboardType="decimal-pad" value={value} onChangeText={onChange} onBlur={onBlur} placeholder="未填寫則顯示待確認" placeholderTextColor={colors.subtle} style={styles.priceInput} />} /><Text style={styles.currency}>／人</Text></View>
            {errors.price ? <Text style={styles.fieldError}>{errors.price.message}</Text> : <Text style={styles.fieldHint}>可填 0 表示免費，最多兩位小數。</Text>}
          </SettingField>
          <SettingField icon="map-marker-outline" title="取餐地點（必填）">
            <Controller control={control} name="location" render={({ field: { onChange, value } }) => CORE_API_ENABLED ? <LocalLocationPicker key={locationKey} value={value} onChange={onChange} /> : <LocationPicker key={locationKey} value={value} onChange={onChange} />} />
            {errors.location ? <Text style={styles.fieldError}>請搜尋並選擇取餐地點，或使用目前位置。</Text> : null}
          </SettingField>
        </ScrollView>
      </KeyboardAvoidingView>
      <DeadlinePickerModal
        startDate={deadlineStartDate}
        value={draftDeadline}
        visible={deadlineModalVisible}
        onApply={applyDeadline}
        onChange={setDraftDeadline}
        onClose={() => setDeadlineModalVisible(false)}
      />
      <Modal animationType="fade" transparent visible={tagModalVisible} onRequestClose={() => setTagModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTagModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <Text style={styles.modalTitle}>新增主題標籤</Text>
            <TextInput autoFocus maxLength={12} value={customTag} onChangeText={setCustomTag} onSubmitEditing={addCustomTag} placeholder="例如：宵夜" placeholderTextColor={colors.subtle} style={styles.modalInput} />
            <View style={styles.modalActions}><PrimaryButton secondary style={styles.modalButton} onPress={() => setTagModalVisible(false)}>取消</PrimaryButton><PrimaryButton disabled={!customTag.trim()} style={styles.modalButton} onPress={addCustomTag}>加入</PrimaryButton></View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 54, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { flex: 1, textAlign: 'center', color: colors.ink, fontFamily: typography.rounded, fontSize: 18, fontWeight: '700' },
  publish: { minWidth: 64, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.yellow },
  publishDisabled: { backgroundColor: '#E4E4E2' },
  publishText: { color: colors.ink, fontFamily: typography.rounded, fontSize: 15, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 120 },
  mediaRow: { height: 84, flexDirection: 'row', gap: 10 },
  thumbnail: { width: 84, height: 84, borderRadius: radius.md },
  removeMedia: { position: 'absolute', top: 3, right: 3, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000099' },
  mediaButton: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  recording: { borderColor: colors.danger, backgroundColor: '#FFF4F4' },
  mediaLabel: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  editor: { minHeight: 185, paddingTop: 18, color: colors.ink, fontFamily: typography.regular, fontSize: 16, lineHeight: 24 },
  counterRow: { height: 24, flexDirection: 'row' },
  error: { flex: 1, color: colors.danger, fontSize: 13 },
  counter: { color: colors.muted, fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  addTag: { width: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.yellow, borderRadius: radius.md },
  settingControl: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  controlValue: { flex: 1, color: colors.ink, fontSize: 15 },
  capacity: { flex: 1, minWidth: 36, minHeight: 42, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.ink },
  peopleHint: { fontSize: 14, color: colors.muted },
  currency: { fontSize: 14, color: colors.muted },
  priceInput: { flex: 1, minWidth: 0, minHeight: 42, color: colors.ink, fontSize: 15 },
  fieldHint: { color: colors.muted, fontSize: 13 },
  fieldError: { color: colors.danger, fontSize: 13 },
  modalBackdrop: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: '#00000055' },
  modalSheet: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, fontWeight: '700' },
  modalInput: { fontSize: 16, height: 46, marginTop: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.ink },
  modalActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1 },
});
