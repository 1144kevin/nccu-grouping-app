import { AppText as Text } from '@/components/app-text';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, PrimaryButton } from '@/components/primitives';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export { createInitialDeadline, startOfDay, formatDeadline } from '@/lib/deadline-time';

function formatFullDeadline(date: Date) {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日（週${weekday}）${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

export function DeadlinePickerModal({ startDate, value, visible, onApply, onChange, onClose }: DeadlinePickerModalProps) {
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
            <TimeStepper label="時" value={String(value.getHours()).padStart(2, '0')} onDecrease={() => onChange(shiftTime(value, -1, 'hours'))} onIncrease={() => onChange(shiftTime(value, 1, 'hours'))} />
            <Text style={styles.timeColon}>:</Text>
            <TimeStepper label="分" value={String(value.getMinutes()).padStart(2, '0')} onDecrease={() => onChange(shiftTime(value, -1, 'minutes'))} onIncrease={() => onChange(shiftTime(value, 1, 'minutes'))} />
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
  modalBackdrop: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: '#00000055' },
  modalSheet: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, fontWeight: '700' },
  modalActions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  modalButton: { flex: 1 },
  deadlineSheet: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  deadlineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  deadlineHeading: { flex: 1 },
  deadlinePreview: { marginTop: 5, color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  pickerLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.ink, fontFamily: typography.regular, fontSize: 14, fontWeight: '700' },
  dateList: { gap: 8, paddingRight: spacing.md },
  dateOption: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background },
  dateOptionSelected: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  dateWeekday: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  dateNumber: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  dateTextSelected: { color: colors.ink },
  timePicker: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  timeStepper: { flex: 1, gap: 6 },
  timeLabel: { textAlign: 'center', color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  timeControls: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  timeValue: { minWidth: 34, textAlign: 'center', color: colors.ink, fontFamily: typography.rounded, fontSize: 18, fontWeight: '700' },
  timeColon: { paddingBottom: 13, color: colors.ink, fontSize: 18, fontWeight: '700' },
});
