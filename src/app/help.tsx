import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const questions = [
  ['什麼是「想被揪」？', '表示你想加入這筆需求。主揪接受後，雙方可在聊天室確認細節。'],
  ['熟度等級怎麼計算？', '完成拼單、準時回覆與良好互動會累積熟度。此等級是平台紀錄，不代表校方認證。'],
  ['遇到可疑訊息怎麼辦？', '不要提供密碼、驗證碼或不明付款資訊，並從貼文或聊天室選單送出檢舉。'],
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number>();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  return <Screen><DetailHeader title="幫助與回報" /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>常見問題</Text>{questions.map(([question, answer], index) => <Pressable key={question} onPress={() => setOpen(open === index ? undefined : index)} style={styles.question}><View style={styles.questionRow}><Text style={styles.questionText}>{question}</Text><MaterialCommunityIcons name={open === index ? 'chevron-up' : 'chevron-down'} size={17} color={colors.muted} /></View>{open === index ? <Text style={styles.answer}>{answer}</Text> : null}</Pressable>)}<Text style={styles.title}>回報問題</Text>{sent ? <View style={styles.success}><MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} /><Text style={styles.successText}>已收到回報，謝謝你的說明。</Text></View> : <><TextInput multiline maxLength={500} value={message} onChangeText={setMessage} placeholder="描述發生的情況，請勿填入密碼或付款資料" placeholderTextColor={colors.subtle} style={styles.input} textAlignVertical="top" /><Text style={styles.counter}>{message.length}/500</Text><PrimaryButton disabled={message.trim().length < 10} onPress={() => { setSent(true); setMessage(''); }}>送出回報</PrimaryButton><Pressable onPress={() => setMessage((value) => `${value}${value ? '\n\n' : ''}裝置：${Platform.OS}\nApp 版本：1.0.0`)} style={styles.email}><MaterialCommunityIcons name="cellphone-information" size={17} color={colors.brown} /><Text style={styles.emailText}>加入裝置資訊</Text></Pressable></>}</ScrollView></Screen>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { marginTop: spacing.md, marginBottom: spacing.sm, color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  question: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  questionRow: { flexDirection: 'row', alignItems: 'center' },
  questionText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
  answer: { marginTop: spacing.sm, paddingRight: spacing.xl, color: colors.muted, fontSize: 11, lineHeight: 18 },
  input: { minHeight: 120, padding: spacing.md, color: colors.ink, fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  counter: { marginVertical: 5, color: colors.subtle, fontSize: 10, textAlign: 'right' },
  success: { minHeight: 62, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: '#EDF8F1' },
  successText: { color: colors.success, fontSize: 12 },
  email: { minHeight: 48, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emailText: { color: colors.brown, fontSize: 11, fontWeight: '700' },
});
