import { useState } from 'react';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardViewport, KeyboardScrollView } from '@/components/keyboard-layout';
import { IconButton, PrimaryButton } from '@/components/primitives';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export { createInitialDeadline, startOfDay, formatDeadline } from '@/lib/deadline-time';

function formatFullDeadline(date: Date) {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日（週${weekday}）${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function updateDate(value: Date, selectedDate: Date) {
  const next = new Date(value);
  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  return next;
}

function shiftTime(value: Date, amount: number, unit: 'hours' | 'minutes' | 'days') {
  const next = new Date(value);
  if (unit === 'hours') next.setHours((next.getHours() + amount + 24) % 24);
  if (unit === 'minutes') next.setMinutes((next.getMinutes() + amount + 60) % 60);
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

export function DeadlinePickerModal(props: DeadlinePickerModalProps) {
  return (
    <Modal animationType="fade" transparent visible={props.visible} onRequestClose={props.onClose}>
      {props.visible ? <DeadlinePickerContent {...props} /> : null}
    </Modal>
  );
}

function validTimePart(text: string, max: number) {
  return /^\d{1,2}$/.test(text) && Number(text) <= max;
}

function DeadlinePickerContent({
  startDate,
  value,
  onApply,
  onChange,
  onClose,
}: DeadlinePickerModalProps) {
  const [hour, setHour] = useState(() => String(value.getHours()).padStart(2, '0'));
  const [minute, setMinute] = useState(() => String(value.getMinutes()).padStart(2, '0'));
  const valid = validTimePart(hour, 23) && validTimePart(minute, 59);
  const enterTime = (text: string, unit: 'hours' | 'minutes') => {
    if (!/^\d{0,2}$/.test(text)) return;
    (unit === 'hours' ? setHour : setMinute)(text);
    if (validTimePart(text, unit === 'hours' ? 23 : 59)) {
      const next = new Date(value);
      if (unit === 'hours') next.setHours(Number(text));
      else next.setMinutes(Number(text));
      onChange(next);
    }
  };
  const stepTime = (amount: number, unit: 'hours' | 'minutes') => {
    const next = shiftTime(value, amount, unit);
    (unit === 'hours' ? setHour : setMinute)(
      String(unit === 'hours' ? next.getHours() : next.getMinutes()).padStart(2, '0'),
    );
    onChange(next);
  };
  const dates = Array.from({ length: 14 }, (_, index) => shiftTime(startDate, index, 'days'));
  const dateLabel = (date: Date, index: number) =>
    index === 0
      ? '今天'
      : index === 1
        ? '明天'
        : `週${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;

  return (
    <KeyboardViewport>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        >
          <Pressable style={[styles.modalSheet, styles.deadlineSheet]} onPress={() => undefined}>
            <View style={styles.deadlineHeader}>
              <View style={styles.deadlineHeading}>
                <Text style={styles.modalTitle}>選擇截止時間</Text>
                <Text style={styles.deadlinePreview}>{formatFullDeadline(value)}</Text>
              </View>
              <IconButton icon="close" label="關閉截止時間設定" onPress={onClose} />
            </View>

            <Text style={styles.pickerLabel}>日期</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateList}
            >
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
                    <Text style={[styles.dateWeekday, selected && styles.dateTextSelected]}>
                      {dateLabel(date, index)}
                    </Text>
                    <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>
                      {date.getMonth() + 1}/{date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.pickerLabel}>時間</Text>
            <View style={styles.timePicker}>
              <TimeStepper
                label="時"
                value={hour}
                onChange={(text) => enterTime(text, 'hours')}
                onBlur={() => {
                  if (validTimePart(hour, 23)) setHour(hour.padStart(2, '0'));
                }}
                onDecrease={() => stepTime(-1, 'hours')}
                onIncrease={() => stepTime(1, 'hours')}
              />
              <Text style={styles.timeColon}>:</Text>
              <TimeStepper
                label="分"
                value={minute}
                onChange={(text) => enterTime(text, 'minutes')}
                onBlur={() => {
                  if (validTimePart(minute, 59)) setMinute(minute.padStart(2, '0'));
                }}
                onDecrease={() => stepTime(-1, 'minutes')}
                onIncrease={() => stepTime(1, 'minutes')}
              />
            </View>
            <Text
              style={[styles.timeHint, !valid && { color: colors.danger }]}
              accessibilityLiveRegion="polite"
            >
              {valid
                ? '24 小時制，可直接輸入時、分，也可用 ＋／－ 調整。'
                : '請輸入有效時間：時 00–23，分 00–59。'}
            </Text>

            <View style={styles.modalActions}>
              <PrimaryButton secondary style={styles.modalButton} onPress={onClose}>
                取消
              </PrimaryButton>
              <PrimaryButton style={styles.modalButton} disabled={!valid} onPress={onApply}>
                套用時間
              </PrimaryButton>
            </View>
          </Pressable>
        </KeyboardScrollView>
      </Pressable>
    </KeyboardViewport>
  );
}

type TimeStepperProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
};

function TimeStepper({ label, value, onChange, onBlur, onDecrease, onIncrease }: TimeStepperProps) {
  return (
    <View style={styles.timeStepper}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeControls}>
        <IconButton icon="minus" label={`減少${label}`} onPress={onDecrease} />
        <TextInput
          accessibilityLabel={`截止時間（${label}）`}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          style={styles.timeValue}
        />
        <IconButton icon="plus" label={`增加${label}`} onPress={onIncrease} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: '#00000055',
  },
  modalSheet: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 17,
    fontWeight: '700',
  },
  modalActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1 },
  deadlineSheet: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  deadlineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  deadlineHeading: { flex: 1 },
  deadlinePreview: {
    marginTop: 5,
    color: colors.muted,
    fontFamily: typography.regular,
    fontSize: 14,
  },
  pickerLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 14,
    fontWeight: '700',
  },
  dateList: { gap: 8, paddingRight: spacing.md },
  dateOption: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  dateOptionSelected: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  dateWeekday: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  dateNumber: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  dateTextSelected: { color: colors.ink },
  timePicker: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  timeStepper: { flex: 1, gap: 6 },
  timeLabel: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: typography.regular,
    fontSize: 13,
  },
  timeControls: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  timeValue: {
    flex: 1,
    minWidth: 34,
    height: 44,
    padding: 0,
    textAlign: 'center',
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 18,
    fontWeight: '700',
  },
  timeHint: { marginTop: spacing.sm, color: colors.muted, fontSize: 12, lineHeight: 20 },
  timeColon: { paddingBottom: 13, color: colors.ink, fontSize: 18, fontWeight: '700' },
});
