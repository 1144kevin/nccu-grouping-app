import { AppText as Text } from '@/components/app-text';
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ChatSwipeRow } from '@/components/chat-swipe-row';
import type { ChatSwipeHandle } from '@/components/chat-swipe-row.types';
import { AppHeader, Avatar, EmptyState, IconButton, Screen } from '@/components/primitives';
import { sortedConversations } from '@/lib/conversations';
import { useAppStore } from '@/store/app-store';
import type { Conversation, InboxType } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { CoreInbox } from '@/components/core-chat';

type InboxTab = 'all' | InboxType;

export default function MessagesScreen() {
  return CORE_API_ENABLED && CORE_SUPABASE_MODE ? <CoreInbox /> : <DemoMessagesScreen />;
}

function DemoMessagesScreen() {
  const conversations = useAppStore((state) => state.conversations);
  const deleted = useAppStore((state) => state.deletedConversations);
  const restore = useAppStore((state) => state.restoreConversation);
  const classify = useAppStore((state) => state.setConversationInbox);
  const pin = useAppStore((state) => state.toggleConversationPinned);
  const remove = useAppStore((state) => state.deleteConversation);
  const [tab, setTab] = useState<InboxTab>('all');
  const [optionsId, setOptionsId] = useState<string>();
  const [swiping, setSwiping] = useState(false);
  const activeSwipe = useRef<ChatSwipeHandle | null>(null);
  const selected = conversations.find((item) => item.id === optionsId);
  const lastDeleted = deleted.at(-1);
  const items = sortedConversations(conversations, tab);

  const closeSwipe = useCallback(() => {
    activeSwipe.current?.close();
    activeSwipe.current = null;
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        closeSwipe();
        setOptionsId(undefined);
        setSwiping(false);
      },
      [closeSwipe],
    ),
  );
  function openSwipe(swipe: ChatSwipeHandle) {
    if (activeSwipe.current !== swipe) activeSwipe.current?.close();
    activeSwipe.current = swipe;
  }
  function menuAction(action: () => void) {
    setOptionsId(undefined);
    closeSwipe();
    action();
  }

  return (
    <Screen>
      <AppHeader searchScope="messages" />
      <View style={styles.tabs}>
        {(['all', 'primary', 'general'] as InboxTab[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => {
              closeSwipe();
              setTab(value);
            }}
            style={[styles.tab, tab === value && styles.activeTab]}
          >
            <Text style={styles.tabText}>
              {value === 'all' ? '全部' : value === 'primary' ? '主要' : '一般'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>左滑分類 · 右滑釘選或刪除</Text>
      {lastDeleted ? (
        <View style={styles.undoBar}>
          <Text numberOfLines={1} accessibilityLiveRegion="polite" style={styles.undoText}>
            已刪除 {lastDeleted.conversation.name} 的聊天室
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`復原 ${lastDeleted.conversation.name} 的聊天室`}
            style={styles.undoButton}
            onPress={() => {
              restore(lastDeleted.conversation.id);
              setTab('all');
            }}
          >
            <Text style={styles.undoLabel}>復原</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        scrollEnabled={!swiping}
        directionalLockEnabled
        contentContainerStyle={{ paddingBottom: 120 }}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState icon="text-search" title="沒有符合的訊息" />}
        ListFooterComponent={items.length ? <Text style={styles.end}>已經到底了喔！</Text> : null}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onGestureActiveChange={setSwiping}
            onOpenSwipe={openSwipe}
            onMore={() => {
              closeSwipe();
              setOptionsId(item.id);
            }}
          />
        )}
      />
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selected)}
        onRequestClose={() => setOptionsId(undefined)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉聊天室選項"
            style={StyleSheet.absoluteFill}
            onPress={() => setOptionsId(undefined)}
          />
          {selected ? (
            <View style={styles.menu} accessibilityViewIsModal>
              <Text style={styles.menuTitle}>聊天室選項</Text>
              <Text numberOfLines={1} style={styles.menuName}>
                {selected.name}
              </Text>
              <MenuButton
                label={selected.inbox === 'primary' ? '主要（目前分類）' : '移至主要'}
                icon="star-outline"
                disabled={selected.inbox === 'primary'}
                onPress={() => menuAction(() => classify(selected.id, 'primary'))}
              />
              <MenuButton
                label={selected.inbox === 'general' ? '一般（目前分類）' : '移至一般'}
                icon="inbox-outline"
                disabled={selected.inbox === 'general'}
                onPress={() => menuAction(() => classify(selected.id, 'general'))}
              />
              <MenuButton
                label={selected.pinned ? '取消釘選' : '釘選'}
                icon={selected.pinned ? 'pin-off-outline' : 'pin-outline'}
                onPress={() => menuAction(() => pin(selected.id))}
              />
              <MenuButton
                label="刪除聊天室"
                icon="trash-can-outline"
                danger
                onPress={() => menuAction(() => remove(selected.id))}
              />
              <MenuButton label="取消" icon="close" onPress={() => setOptionsId(undefined)} />
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function ConversationRow({
  item,
  onOpenSwipe,
  onMore,
  onGestureActiveChange,
}: {
  item: Conversation;
  onGestureActiveChange: (active: boolean) => void;
  onOpenSwipe: (swipe: ChatSwipeHandle) => void;
  onMore: () => void;
}) {
  const swipe = useRef<ChatSwipeHandle>(null);
  const open = useRef(false);
  const markRead = useAppStore((state) => state.markRead);
  const classify = useAppStore((state) => state.setConversationInbox);
  const pin = useAppStore((state) => state.toggleConversationPinned);
  const remove = useAppStore((state) => state.deleteConversation);
  const [side, setSide] = useState<'left' | 'right' | null>(null);

  function action(callback: () => void) {
    swipe.current?.close();
    callback();
  }
  function beginSwipe() {
    open.current = true;
    if (swipe.current) onOpenSwipe(swipe.current);
  }

  return (
    <ChatSwipeRow
      ref={swipe}
      onOpenStart={beginSwipe}
      onGestureActiveChange={onGestureActiveChange}
      onOpen={setSide}
      onClose={() => {
        open.current = false;
        setSide(null);
      }}
      leftActions={
        <View
          style={styles.swipeActions}
          accessibilityElementsHidden={side !== 'left'}
          importantForAccessibility={side === 'left' ? 'auto' : 'no-hide-descendants'}
        >
          <SwipeAction
            label={item.pinned ? '取消釘選' : '釘選'}
            icon={item.pinned ? 'pin-off-outline' : 'pin-outline'}
            color={colors.yellow}
            onPress={() => action(() => pin(item.id))}
          />
          <SwipeAction
            label="刪除"
            icon="trash-can-outline"
            color={colors.danger}
            white
            onPress={() => action(() => remove(item.id))}
          />
        </View>
      }
      rightActions={
        <View
          style={styles.swipeActions}
          accessibilityElementsHidden={side !== 'right'}
          importantForAccessibility={side === 'right' ? 'auto' : 'no-hide-descendants'}
        >
          <SwipeAction
            label="主要"
            icon="star-outline"
            color={colors.yellow}
            selected={item.inbox === 'primary'}
            onPress={() => action(() => classify(item.id, 'primary'))}
          />
          <SwipeAction
            label="一般"
            icon="inbox-outline"
            color={colors.surface}
            selected={item.inbox === 'general'}
            onPress={() => action(() => classify(item.id, 'general'))}
          />
        </View>
      }
    >
      <View style={[styles.row, item.pinned && styles.pinnedRow]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`開啟 ${item.name} 的聊天室${item.pinned ? '，已釘選' : ''}`}
          onLongPress={onMore}
          onPress={() => {
            if (swipe.current?.shouldIgnorePress()) return;
            if (open.current) {
              swipe.current?.close();
              return;
            }
            markRead(item.id);
            router.push(`/chat/${item.id}`);
          }}
          style={styles.chatButton}
        >
          <View>
            <Avatar name={item.name} badge={item.badge} size={50} />
            {item.unread && <View style={styles.unreadDot} />}
          </View>
          <View style={styles.body}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, item.unread && styles.unread]}>
                {item.name}
              </Text>
              {item.pinned ? (
                <MaterialCommunityIcons
                  name="pin"
                  size={13}
                  color={colors.brown}
                  accessibilityLabel="已釘選"
                />
              ) : null}
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.preview, item.unread && styles.unreadPreview]}>
              {item.preview}
            </Text>
            <Text style={styles.category}>
              {item.inbox === 'primary' ? '主要' : '一般'} · {item.badge} Lv.{item.level}
            </Text>
          </View>
        </Pressable>
        <IconButton icon="dots-horizontal" label={`${item.name} 的聊天室選項`} onPress={onMore} />
      </View>
    </ChatSwipeRow>
  );
}

type ActionIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function SwipeAction({
  label,
  icon,
  color,
  white = false,
  selected = false,
  onPress,
}: {
  label: string;
  icon: ActionIcon;
  color: string;
  white?: boolean;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? `${label}（目前分類）` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.swipeAction,
        { backgroundColor: color },
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={21} color={white ? '#FFFFFF' : colors.ink} />
      <Text style={[styles.actionLabel, white && styles.whiteText]}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}
function MenuButton({
  label,
  icon,
  disabled = false,
  danger = false,
  onPress,
}: {
  label: string;
  icon: ActionIcon;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.menuButton, (pressed || disabled) && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={19} color={danger ? colors.danger : colors.ink} />
      <Text style={[styles.menuLabel, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { height: 52, paddingHorizontal: 34, flexDirection: 'row', alignItems: 'center', gap: 9 },
  tab: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  activeTab: { backgroundColor: colors.yellow },
  tabText: { color: colors.ink, fontFamily: typography.regular, fontSize: 15 },
  hint: { paddingHorizontal: 20, paddingBottom: 10, color: colors.muted, fontSize: 13 },
  row: {
    minHeight: 88,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  pinnedRow: { backgroundColor: '#FFFBEA' },
  chatButton: { flex: 1, minWidth: 0, minHeight: 88, flexDirection: 'row', alignItems: 'center' },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: colors.danger,
  },
  body: { flex: 1, minWidth: 0, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '600',
  },
  unread: { fontWeight: '800' },
  time: { color: colors.muted, fontSize: 13 },
  preview: { marginTop: 4, color: colors.muted, fontFamily: typography.regular, fontSize: 15 },
  unreadPreview: { color: colors.ink, fontWeight: '700' },
  category: { marginTop: 4, color: colors.muted, fontSize: 13 },
  end: {
    paddingVertical: 24,
    textAlign: 'center',
    color: colors.subtle,
    fontFamily: typography.regular,
    fontSize: 15,
  },
  swipeActions: { flex: 1, flexDirection: 'row', alignItems: 'stretch', width: 152 },
  swipeAction: { width: 76, justifyContent: 'center', alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  whiteText: { color: '#FFFFFF' },
  pressed: { opacity: 0.55 },
  undoBar: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  undoText: { flex: 1, fontSize: 14, color: colors.muted },
  undoButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  undoLabel: { color: colors.brown, fontSize: 15, fontWeight: '700' },
  overlay: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000055',
  },
  menu: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  menuTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  menuName: { color: colors.muted, fontSize: 14, marginTop: 5, marginBottom: 10 },
  menuButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuLabel: { color: colors.ink, fontSize: 16 },
  dangerText: { color: colors.danger },
});
