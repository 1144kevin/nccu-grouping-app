import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, IconButton } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useAppStore((state) => state.conversations);
  const conversation = useMemo(() => conversations.find((item) => item.id === id), [conversations, id]);
  const markRead = useAppStore((state) => state.markRead);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const muted = useAppStore((state) => state.mutedConversationIds.includes(id));
  const blocked = useAppStore((state) => state.blockedUserNames.includes(conversation?.name ?? ''));
  const toggleMuted = useAppStore((state) => state.toggleConversationMuted);
  const toggleBlocked = useAppStore((state) => state.toggleBlockedUser);
  const [text, setText] = useState('');
  useEffect(() => { if (id) markRead(id); }, [id, markRead]);
  if (!conversation) return <SafeAreaView style={styles.missing}><Text>找不到這個對話</Text><Pressable onPress={() => router.back()}><Text style={styles.link}>回到訊息</Text></Pressable></SafeAreaView>;
  const conversationId = conversation.id;
  const conversationName = conversation.name;

  function openOptions() {
    Alert.alert('對話選項', conversationName, [
      { text: muted ? '開啟通知' : '關閉通知', onPress: () => toggleMuted(conversationId) },
      { text: '查看個人檔案', onPress: () => router.push(`/user/${encodeURIComponent(conversationName)}`) },
      { text: blocked ? '解除封鎖' : '封鎖使用者', style: 'destructive', onPress: () => toggleBlocked(conversationName) },
      { text: '檢舉對話', style: 'destructive', onPress: () => Alert.alert('已送出檢舉', '管理員將審核必要的近期訊息。') },
      { text: '取消', style: 'cancel' },
    ]);
  }

  async function attach() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!result.canceled) sendMessage(id, '📷 傳送了一張照片');
  }
  function send() { const value = text.trim(); if (!value) return; sendMessage(conversationId, value); setText(''); }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><IconButton icon="chevron-left" label="返回" onPress={() => router.back()} /><Pressable onPress={() => router.push(`/user/${encodeURIComponent(conversation.name)}`)}><Avatar name={conversation.name} badge={conversation.badge} size={41} /></Pressable><Pressable onPress={() => router.push(`/user/${encodeURIComponent(conversation.name)}`)} style={styles.headerName}><Text numberOfLines={1} style={styles.name}>{conversation.name}{muted ? '　🔕' : ''}</Text><Text style={styles.level}>{conversation.badge} Lv.{conversation.level}</Text></Pressable><IconButton icon="dots-vertical" label="對話選項" onPress={openOptions} /></View>
      <Text style={styles.date}>5月24日下午4:23</Text><Text style={styles.warning}>⚠ 請留意聊天室中潛在的詐騙行為</Text>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <FlatList inverted data={[...conversation.messages].reverse()} keyExtractor={(item) => item.id} contentContainerStyle={styles.messages} renderItem={({ item }) => <View style={[styles.bubbleWrap, item.mine && styles.mineWrap]}><View style={[styles.bubble, item.mine && styles.mineBubble]}><Text style={styles.messageText}>{item.text}</Text></View><Text style={styles.sentAt}>{item.sentAt}</Text></View>} />
        {blocked ? <View style={styles.blocked}><Text style={styles.blockedText}>你已封鎖這位使用者</Text><Pressable onPress={() => toggleBlocked(conversation.name)}><Text style={styles.unblock}>解除封鎖</Text></Pressable></View> : <View style={styles.composer}><IconButton icon="plus" label="新增附件" onPress={attach} /><TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" placeholder="訊息……" placeholderTextColor={colors.subtle} style={styles.input} /><IconButton icon="send" label="送出訊息" disabled={!text.trim()} color={colors.yellow} onPress={send} /></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.background },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  link: { color: colors.brown, fontWeight: '700' },
  header: { height: 64, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerName: { flex: 1, marginLeft: 9 },
  name: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  level: { marginTop: 2, color: colors.muted, fontSize: 13 },
  date: { paddingTop: 12, textAlign: 'center', color: colors.subtle, fontSize: 13 },
  warning: { paddingTop: 6, textAlign: 'center', color: colors.subtle, fontSize: 13 },
  messages: { padding: spacing.lg },
  bubbleWrap: { marginBottom: 12, alignItems: 'flex-start' },
  mineWrap: { alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  mineBubble: { backgroundColor: colors.yellow },
  messageText: { color: colors.ink, fontFamily: typography.regular, fontSize: 16, lineHeight: 23 },
  sentAt: { marginTop: 3, color: colors.subtle, fontSize: 12 },
  composer: { minHeight: 62, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
  input: { fontSize: 16, flex: 1, minHeight: 42, paddingHorizontal: 13, color: colors.ink, fontFamily: typography.regular, borderRadius: 21, backgroundColor: colors.surface },
  blocked: { minHeight: 62, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  blockedText: { color: colors.muted, fontSize: 14 },
  unblock: { color: colors.brown, fontSize: 14, fontWeight: '700' },
});
