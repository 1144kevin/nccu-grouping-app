import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { IconButton, PrimaryButton, SectionTitle, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const schema = z.object({ content: z.string().trim().min(10, '至少輸入 10 個字').max(500, '最多 500 個字') });
type FormValues = z.infer<typeof schema>;
const suggestedTags = ['拼單', '政大附近', '東側門', '麵包', '法國可頌'];

export default function CreateScreen() {
  const publishPost = useAppStore((state) => state.publishPost);
  const [tags, setTags] = useState(['拼單']);
  const [imageUri, setImageUri] = useState<string>();
  const [voiceUri, setVoiceUri] = useState<string>();
  const [deadline, setDeadline] = useState(createInitialDeadline);
  const [draftDeadline, setDraftDeadline] = useState(deadline);
  const [deadlineStartDate] = useState(startOfDay);
  const [capacity, setCapacity] = useState(4);
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const { control, handleSubmit, formState: { errors, isValid, isDirty }, getValues, setValue, reset } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: { content: '' } });
  const content = useWatch({ control, name: 'content' });

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

  async function generate() {
    setWorking(true);
    await new Promise((resolve) => setTimeout(resolve, 550));
    setValue('content', '今天想揪大家一起訂東側門附近的餐點，目前還缺 3 人。預計在校門口取餐，費用會依人數均分，有興趣請在截止前加入！', { shouldDirty: true, shouldValidate: true });
    setTags(['拼單', '政大附近', '東側門']);
    setWorking(false);
  }

  async function polish() {
    if (!getValues('content').trim()) return;
    setWorking(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    setValue('content', `${getValues('content').trim()}\n\n費用將平均分攤，成團後會透過訊息確認取餐時間與地點。`, { shouldDirty: true, shouldValidate: true });
    setWorking(false);
  }

  function close() {
    if (!isDirty && !imageUri && !voiceUri) return router.replace('/');
    Alert.alert('捨棄這篇貼文？', '尚未發布的內容不會被保留。', [{ text: '繼續編輯', style: 'cancel' }, { text: '捨棄', style: 'destructive', onPress: () => router.replace('/') }]);
  }

  const submit = handleSubmit((values) => {
    if (!tags.length) return Alert.alert('請選擇標籤', '至少需要一個主題標籤。');
    publishPost({ content: values.content.trim(), tags, deadline: formatDeadline(deadline), capacity, imageUrl: imageUri, voiceUri });
    reset();
    Alert.alert('貼文已發布', '已加入首頁推薦資訊流。', [{ text: '查看首頁', onPress: () => router.replace('/') }]);
  });

  function addCustomTag() {
    const tag = customTag.trim().slice(0, 12);
    if (!tag) return;
    setTags((items) => [...new Set([...items, tag])]);
    setCustomTag('');
    setTagModalVisible(false);
  }

  function openDeadlinePicker() {
    setDraftDeadline(new Date(deadline));
    setDeadlineModalVisible(true);
  }

  function applyDeadline() {
    if (draftDeadline.getTime() <= Date.now()) {
      Alert.alert('截止時間已過', '請選擇晚於目前時間的截止時間。');
      return;
    }
    setDeadline(new Date(draftDeadline));
    setDeadlineModalVisible(false);
  }

  return (
    <Screen>
      <View style={styles.header}><IconButton icon="close" label="關閉" onPress={close} /><Text style={styles.title}>建立新貼文</Text><Pressable accessibilityRole="button" disabled={!isValid || !tags.length} onPress={submit} style={[styles.publish, (!isValid || !tags.length) && styles.publishDisabled]}><Text style={styles.publishText}>發布</Text></Pressable></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.mediaRow}>
            {imageUri && <View><Image source={{ uri: imageUri }} style={styles.thumbnail} /><Pressable onPress={() => setImageUri(undefined)} style={styles.removeMedia}><MaterialCommunityIcons name="close" size={15} color="#FFFFFF" /></Pressable></View>}
            <Pressable onPress={pickImage} style={styles.mediaButton}><MaterialCommunityIcons name="image-plus-outline" size={21} color={colors.ink} /><Text style={styles.mediaLabel}>新增圖片</Text></Pressable>
            <Pressable onPress={toggleRecording} style={[styles.mediaButton, recorderState.isRecording && styles.recording]}><MaterialCommunityIcons name={recorderState.isRecording ? 'stop' : 'microphone-outline'} size={21} color={recorderState.isRecording ? colors.danger : colors.ink} /><Text style={styles.mediaLabel}>{recorderState.isRecording ? `${Math.max(1, Math.round(recorderState.durationMillis / 1000))} 秒` : voiceUri ? '已錄音' : '語音'}</Text></Pressable>
          </View>
          <Controller control={control} name="content" render={({ field: { onChange, onBlur, value } }) => <TextInput autoFocus multiline maxLength={500} value={value} onBlur={onBlur} onChangeText={onChange} placeholder="分享想揪的餐點、價格、取餐地點等資訊..." placeholderTextColor={colors.subtle} style={styles.editor} textAlignVertical="top" />} />
          <View style={styles.counterRow}><Text style={styles.error}>{errors.content?.message}</Text><Text style={styles.counter}>{content.length}/500</Text></View>
          <View style={styles.aiBox}><View style={styles.aiHeader}><MaterialCommunityIcons name="creation" size={18} /><Text style={styles.aiTitle}>AI 文字助理</Text><Text style={styles.aiNote}>內容仍需自行確認</Text></View><View style={styles.aiActions}><PrimaryButton secondary disabled={working} style={styles.aiButton} onPress={generate}>✨ 生成</PrimaryButton><PrimaryButton secondary disabled={working || !content.trim()} style={styles.aiButton} onPress={polish}>✎ 潤稿</PrimaryButton></View></View>
          <SectionTitle action={<IconButton icon="plus-circle-outline" label="新增標籤" onPress={() => setTagModalVisible(true)} />}>主題標籤</SectionTitle>
          <View style={styles.tagRow}>{suggestedTags.map((tag) => { const selected = tags.includes(tag); return <Pressable key={tag} onPress={() => setTags((items) => selected ? items.filter((item) => item !== tag) : [...items, tag])} style={[styles.tag, selected && styles.selectedTag]}><Text style={styles.tagText}>{selected ? '✓  ' : ''}{tag}</Text></Pressable>; })}</View>
          <SectionTitle>拼單設定</SectionTitle>
          <Pressable accessibilityRole="button" accessibilityLabel="選擇截止時間" onPress={openDeadlinePicker} style={styles.settingRow}><MaterialCommunityIcons name="clock-outline" size={19} color={colors.yellow} /><View style={styles.settingText}><Text style={styles.settingLabel}>截止時間</Text><Text style={styles.settingValue}>{formatDeadline(deadline)}</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.muted} /></Pressable>
          <View style={styles.settingRow}><MaterialCommunityIcons name="account-group-outline" size={19} color={colors.yellow} /><View style={styles.settingText}><Text style={styles.settingLabel}>需求人數</Text><Text style={styles.settingValue}>{capacity} 人（包含主揪）</Text></View><IconButton icon="minus-circle-outline" label="減少人數" disabled={capacity <= 2} onPress={() => setCapacity((value) => value - 1)} /><Text style={styles.capacity}>{capacity}</Text><IconButton icon="plus-circle-outline" label="增加人數" disabled={capacity >= 20} onPress={() => setCapacity((value) => value + 1)} /></View>
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

function formatDeadline(date: Date) { return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }

function formatFullDeadline(date: Date) {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日（週${weekday}）${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function createInitialDeadline() {
  const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000);
  deadline.setSeconds(0, 0);
  deadline.setMinutes(Math.ceil(deadline.getMinutes() / 15) * 15);
  return deadline;
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function updateDate(value: Date, selectedDate: Date) {
  const next = new Date(value);
  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  return next;
}

function shiftTime(value: Date, amount: number, unit: 'hours' | 'minutes' | 'days') {
  const next = new Date(value);
  if (unit === 'hours') next.setHours(next.getHours() + amount);
  if (unit === 'minutes') next.setMinutes(next.getMinutes() + amount);
  if (unit === 'days') next.setDate(next.getDate() + amount);
  return next;
}

type DeadlinePickerModalProps = {
  startDate: Date;
  value: Date;
  visible: boolean;
  onApply: () => void;
  onChange: (value: Date) => void;
  onClose: () => void;
};

function DeadlinePickerModal({ startDate, value, visible, onApply, onChange, onClose }: DeadlinePickerModalProps) {
  const dates = Array.from({ length: 14 }, (_, index) => shiftTime(startDate, index, 'days'));
  const dateLabel = (date: Date, index: number) => index === 0 ? '今天' : index === 1 ? '明天' : `週${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, styles.deadlineSheet]} onPress={() => undefined}>
          <View style={styles.deadlineHeader}>
            <View style={styles.deadlineHeading}>
              <Text style={styles.modalTitle}>選擇截止時間</Text>
              <Text style={styles.deadlinePreview}>{formatFullDeadline(value)}</Text>
            </View>
            <IconButton icon="close" label="關閉截止時間設定" onPress={onClose} />
          </View>

          <Text style={styles.pickerLabel}>日期</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
            {dates.map((date, index) => {
              const selected = isSameDay(date, value);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`選擇 ${date.getMonth() + 1} 月 ${date.getDate()} 日`}
                  key={date.toISOString()}
                  onPress={() => onChange(updateDate(value, date))}
                  style={[styles.dateOption, selected && styles.dateOptionSelected]}
                >
                  <Text style={[styles.dateWeekday, selected && styles.dateTextSelected]}>{dateLabel(date, index)}</Text>
                  <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{date.getMonth() + 1}/{date.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.pickerLabel}>時間</Text>
          <View style={styles.timePicker}>
            <TimeStepper label="小時" value={String(value.getHours()).padStart(2, '0')} onDecrease={() => onChange(shiftTime(value, -1, 'hours'))} onIncrease={() => onChange(shiftTime(value, 1, 'hours'))} />
            <Text style={styles.timeColon}>:</Text>
            <TimeStepper label="分鐘" value={String(value.getMinutes()).padStart(2, '0')} onDecrease={() => onChange(shiftTime(value, -15, 'minutes'))} onIncrease={() => onChange(shiftTime(value, 15, 'minutes'))} />
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => onChange(shiftTime(value, 1, 'hours'))} style={styles.quickButton}><Text style={styles.quickButtonText}>延後 1 小時</Text></Pressable>
            <Pressable onPress={() => onChange(shiftTime(value, 3, 'hours'))} style={styles.quickButton}><Text style={styles.quickButtonText}>延後 3 小時</Text></Pressable>
            <Pressable onPress={() => onChange(shiftTime(value, 1, 'days'))} style={styles.quickButton}><Text style={styles.quickButtonText}>隔天同時間</Text></Pressable>
          </View>

          <View style={styles.modalActions}><PrimaryButton secondary style={styles.modalButton} onPress={onClose}>取消</PrimaryButton><PrimaryButton style={styles.modalButton} onPress={onApply}>套用時間</PrimaryButton></View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type TimeStepperProps = { label: string; value: string; onDecrease: () => void; onIncrease: () => void };

function TimeStepper({ label, value, onDecrease, onIncrease }: TimeStepperProps) {
  return (
    <View style={styles.timeStepper}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeControls}>
        <IconButton icon="minus" label={`減少${label}`} onPress={onDecrease} />
        <Text style={styles.timeValue}>{value}</Text>
        <IconButton icon="plus" label={`增加${label}`} onPress={onIncrease} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 54, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { flex: 1, textAlign: 'center', color: colors.ink, fontFamily: typography.rounded, fontSize: 18, fontWeight: '700' },
  publish: { minWidth: 64, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.yellow },
  publishDisabled: { backgroundColor: '#E4E4E2' },
  publishText: { color: colors.ink, fontFamily: typography.rounded, fontSize: 13, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  mediaRow: { height: 84, flexDirection: 'row', gap: 10 },
  thumbnail: { width: 84, height: 84, borderRadius: radius.md },
  removeMedia: { position: 'absolute', top: 3, right: 3, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000099' },
  mediaButton: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  recording: { borderColor: colors.danger, backgroundColor: '#FFF4F4' },
  mediaLabel: { color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  editor: { minHeight: 185, paddingTop: 18, color: colors.ink, fontFamily: typography.regular, fontSize: 16, lineHeight: 24 },
  counterRow: { height: 24, flexDirection: 'row' },
  error: { flex: 1, color: colors.danger, fontSize: 11 },
  counter: { color: colors.muted, fontSize: 11 },
  aiBox: { padding: spacing.md, marginBottom: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiTitle: { flex: 1, color: colors.ink, fontWeight: '700' },
  aiNote: { color: colors.muted, fontSize: 10 },
  aiActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  aiButton: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.muted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  tag: { minHeight: 36, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.yellow, borderRadius: radius.md },
  selectedTag: { backgroundColor: colors.yellowSoft },
  tagText: { color: colors.ink, fontFamily: typography.regular, fontSize: 13 },
  settingRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingText: { flex: 1 },
  settingLabel: { color: colors.ink, fontFamily: typography.regular, fontSize: 14 },
  settingValue: { marginTop: 3, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  capacity: { width: 18, textAlign: 'center', fontWeight: '700' },
  modalBackdrop: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: '#00000055' },
  modalSheet: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, fontWeight: '700' },
  modalInput: { height: 46, marginTop: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.ink },
  modalActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1 },
  deadlineSheet: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  deadlineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  deadlineHeading: { flex: 1 },
  deadlinePreview: { marginTop: 5, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  pickerLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.ink, fontFamily: typography.regular, fontSize: 12, fontWeight: '700' },
  dateList: { gap: 8, paddingRight: spacing.md },
  dateOption: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background },
  dateOptionSelected: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  dateWeekday: { color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  dateNumber: { color: colors.ink, fontFamily: typography.rounded, fontSize: 14, fontWeight: '700' },
  dateTextSelected: { color: colors.ink },
  timePicker: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  timeStepper: { flex: 1, gap: 6 },
  timeLabel: { textAlign: 'center', color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  timeControls: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  timeValue: { minWidth: 34, textAlign: 'center', color: colors.ink, fontFamily: typography.rounded, fontSize: 18, fontWeight: '700' },
  timeColon: { paddingBottom: 13, color: colors.ink, fontSize: 18, fontWeight: '700' },
  quickActions: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickButton: { minHeight: 34, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface },
  quickButtonText: { color: colors.ink, fontFamily: typography.regular, fontSize: 11, fontWeight: '600' },
});
