import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,

  StyleSheet,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import {
  AppHeader,
  Avatar,
  DetailHeader,
  EmptyState,
  IconButton,
  Screen,
} from '@/components/primitives';
import { ChatSwipeRow } from '@/components/chat-swipe-row';
import type { ChatSwipeHandle } from '@/components/chat-swipe-row.types';
import { socialApi, useInboxThreads, type InboxFilter, type InboxThread } from '@/lib/social-api';
import { coreError } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, typography } from '@/theme/tokens';

export function threadTitle(item: InboxThread) {
  return `【${item.kind === 'group' ? '群組' : '私訊'}】${item.post.content.split('\n')[0]}`;
}
export function UnifiedInbox() {
  const actor = useAuthStore((s) => s.user?.id);
  return <Inbox key={actor} />;
}
function Inbox() {
  const [tab, setTab] = useState<InboxFilter>('all');
  const [deleted, setDeleted] = useState(false);
  const [selected, setSelected] = useState<InboxThread>();
  const [undo, setUndo] = useState<InboxThread>();
  const [swiping, setSwiping] = useState(false);
  const activeSwipe = useRef<ChatSwipeHandle | null>(null);
  const query = useInboxThreads(tab, deleted);
  const actor = useAuthStore((s) => s.user?.id);
  const closeSwipe = useCallback(() => {
    activeSwipe.current?.close();
    activeSwipe.current = null;
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        closeSwipe();
        setSelected(undefined);
        setSwiping(false);
      },
      [closeSwipe],
    ),
  );
  const change = useMutation({
    mutationFn: ({
      item,
      value,
    }: {
      item: InboxThread;
      value: Parameters<typeof socialApi.preference>[1];
    }) => socialApi.preference(item, value),
    onSuccess: (_, input) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      if (input.value.deleted) setUndo(input.item);
      else if (input.value.deleted === false) setUndo(undefined);
      closeSwipe();
      setSelected(undefined);
      void invalidateCore();
    },
  });
  const update = (item: InboxThread, value: Parameters<typeof socialApi.preference>[1]) => {
    closeSwipe();
    change.mutate({ item, value });
  };
  const items = query.error ? [] : query.items;
  return (
    <Screen>
      {deleted ? (
        <DetailHeader
          title="最近刪除"
          right={<IconButton icon="close" label="返回訊息" onPress={() => setDeleted(false)} />}
        />
      ) : (
        <AppHeader searchScope="messages" />
      )}
      {!deleted ? (
        <View style={styles.tabs}>
          {(['all', 'group', 'direct'] as const).map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === kind }}
              onPress={() => {
                closeSwipe();
                setTab(kind);
              }}
              style={[styles.tab, tab === kind && styles.activeTab]}
            >
              <Text style={styles.tabText}>
                {{ all: '全部', group: '群組', direct: '私訊' }[kind]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!deleted ? <Text style={styles.hint}>左滑分類 · 右滑釘選或刪除</Text> : null}
      {undo && !deleted ? (
        <View style={styles.undo}>
          <Text numberOfLines={1} style={{ flex: 1 }}>
            已刪除 {threadTitle(undo)}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => update(undo, { deleted: false })}>
            <Text style={styles.link}>復原</Text>
          </Pressable>
        </View>
      ) : null}
      {query.error || change.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error ?? change.error)}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.kind + i.id}
        scrollEnabled={!swiping}
        directionalLockEnabled
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <PullRefreshControl
            onRefresh={() => {
              return query.refetch();
            }}
          />
        }
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState
              icon="message-outline"
              title={deleted ? '沒有已刪除的聊天室' : '目前沒有訊息'}
            />
          )
        }
        ListFooterComponent={
          <View>
            {query.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void query.fetchNextPage();
                }}
              >
                <Text style={styles.end}>{query.isFetchingNextPage ? '載入中…' : '載入更多'}</Text>
              </Pressable>
            ) : items.length ? (
              <Text style={styles.end}>已經到底了喔！</Text>
            ) : null}
            {!deleted ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  closeSwipe();
                  setDeleted(true);
                }}
              >
                <Text style={styles.end}>最近刪除</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <InboxRow
            item={item}
            deleted={deleted}
            busy={change.isPending}
            onMore={() => {
              closeSwipe();
              setSelected(item);
            }}
            onChange={(value) => update(item, value)}
            onGestureActiveChange={setSwiping}
            onOpen={(handle) => {
              if (activeSwipe.current !== handle) activeSwipe.current?.close();
              activeSwipe.current = handle;
            }}
          />
        )}
      />
      <Modal
        transparent
        animationType="fade"
        visible={!!selected}
        onRequestClose={() => setSelected(undefined)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉聊天室選項"
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(undefined)}
          />
          {selected ? (
            <View style={styles.menu} accessibilityViewIsModal>
              <Text style={styles.menuTitle}>聊天室選項</Text>
              <Text numberOfLines={2} style={styles.hint}>
                {threadTitle(selected)}
              </Text>
              {deleted ? (
                <MenuItem
                  icon="restore"
                  label="復原聊天室"
                  onPress={() => update(selected, { deleted: false })}
                />
              ) : (
                <>
                  <MenuItem
                    icon="star-outline"
                    label="移至主要"
                    disabled={change.isPending || selected.inbox === 'primary'}
                    onPress={() => update(selected, { inbox: 'primary' })}
                  />
                  <MenuItem
                    icon="inbox-outline"
                    label="移至一般"
                    disabled={change.isPending || selected.inbox === 'general'}
                    onPress={() => update(selected, { inbox: 'general' })}
                  />
                  <MenuItem
                    icon="pin-outline"
                    label={selected.pinned ? '取消釘選' : '釘選'}
                    disabled={change.isPending}
                    onPress={() => update(selected, { pinned: !selected.pinned })}
                  />
                  <MenuItem
                    icon="volume-off"
                    label={selected.muted ? '取消靜音' : '靜音'}
                    disabled={change.isPending}
                    onPress={() => update(selected, { muted: !selected.muted })}
                  />
                  <MenuItem
                    icon="trash-can-outline"
                    label="刪除聊天室"
                    danger
                    disabled={change.isPending}
                    onPress={() => update(selected, { deleted: true })}
                  />
                </>
              )}
              <MenuItem icon="close" label="取消" onPress={() => setSelected(undefined)} />
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}
function InboxRow({
  item,
  deleted,
  busy,
  onMore,
  onChange,
  onOpen,
  onGestureActiveChange,
}: {
  item: InboxThread;
  deleted: boolean;
  busy: boolean;
  onMore: () => void;
  onChange: (v: Parameters<typeof socialApi.preference>[1]) => void;
  onOpen: (h: ChatSwipeHandle) => void;
  onGestureActiveChange: (value: boolean) => void;
}) {
  const swipe = useRef<ChatSwipeHandle>(null);
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const act = (value: Parameters<typeof socialApi.preference>[1]) => {
    swipe.current?.close();
    onChange(value);
  };
  const actions = (left: boolean) => (
    <View style={styles.swipeActions}>
      {left ? (
        <>
          <SwipeAction
            icon="pin-outline"
            label={item.pinned ? '取消釘選' : '釘選'}
            disabled={busy || side !== 'left'}
            onPress={() => act({ pinned: !item.pinned })}
          />
          <SwipeAction
            icon="trash-can-outline"
            label="刪除"
            danger
            disabled={busy || side !== 'left'}
            onPress={() => act({ deleted: true })}
          />
        </>
      ) : (
        <>
          <SwipeAction
            icon="star-outline"
            label="主要"
            disabled={busy || side !== 'right'}
            onPress={() => act({ inbox: 'primary' })}
          />
          <SwipeAction
            icon="inbox-outline"
            label="一般"
            disabled={busy || side !== 'right'}
            onPress={() => act({ inbox: 'general' })}
          />
        </>
      )}
    </View>
  );
  const row = (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`開啟 ${threadTitle(item)}`}
        onPress={() => {
          if (swipe.current?.shouldIgnorePress()) return;
          router.push(item.kind === 'group' ? `/chat/${item.post.id}` : `/direct-chat/${item.id}`);
        }}
        style={styles.rowButton}
      >
        <View>
          <Avatar name={item.peer_name} badge={item.peer_badge ?? '🍱'} size={54} />
          {item.unread_count > 0 ? <View style={styles.unreadDot} /> : null}
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, item.unread_count > 0 && styles.unread]}>
              {threadTitle(item)}
            </Text>
            {item.pinned ? (
              <MaterialCommunityIcons name="pin" size={15} color={colors.brown} />
            ) : null}
            <Text style={styles.time}>{relativeTime(item.updated_at)}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.preview, item.unread_count > 0 && styles.unread]}>
            {item.last_message
              ? `${item.last_message.sender_name}：${item.last_message.content}`
              : '還沒有訊息'}
          </Text>
          <Text numberOfLines={1} style={styles.category}>
            {item.inbox === 'primary' ? '主要' : '一般'} ·{' '}
            {item.kind === 'group'
              ? `主揪 ${item.post.author_name} · ${item.post.joined} 人`
              : item.peer_name}
            {item.muted ? ' · 靜音' : ''}
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon={deleted ? 'restore' : 'dots-horizontal'}
        label={deleted ? '復原聊天室' : '聊天室選項'}
        onPress={deleted ? () => onChange({ deleted: false }) : onMore}
      />
    </View>
  );
  return deleted ? (
    row
  ) : (
    <ChatSwipeRow
      ref={swipe}
      leftActions={actions(true)}
      rightActions={actions(false)}
      onOpenStart={() => {
        if (swipe.current) onOpen(swipe.current);
      }}
      onOpen={setSide}
      onClose={() => setSide(null)}
      onGestureActiveChange={onGestureActiveChange}
    >
      {row}
    </ChatSwipeRow>
  );
}
function relativeTime(value: string) {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  return m < 1
    ? '剛剛'
    : m < 60
      ? `${m}分鐘`
      : m < 1440
        ? `${Math.floor(m / 60)}小時`
        : `${Math.floor(m / 1440)}天`;
}
function MenuItem({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.menuItem, disabled && { opacity: 0.45 }]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.danger : colors.ink} />
      <Text style={{ color: danger ? colors.danger : colors.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
function SwipeAction({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: React.ComponentProps<typeof MenuItem>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.swipeAction, { backgroundColor: danger ? colors.danger : colors.yellow }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={danger ? '#fff' : colors.ink} />
      <Text style={{ color: danger ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: 18, gap: 12, paddingVertical: 10 },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: { backgroundColor: colors.yellow },
  tabText: { color: colors.ink, fontSize: 16 },
  hint: {
    paddingHorizontal: 16,
    marginVertical: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  row: {
    minHeight: 96,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowButton: { flex: 1, minWidth: 0, minHeight: 96, flexDirection: 'row', alignItems: 'center' },
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
    fontSize: 15,
    fontWeight: '600',
  },
  unread: { color: colors.ink, fontWeight: '800' },
  time: { color: colors.muted, fontSize: 12 },
  preview: { marginTop: 4, color: colors.muted, fontSize: 14 },
  category: { marginTop: 4, color: colors.muted, fontSize: 12 },
  end: { paddingVertical: 16, textAlign: 'center', color: colors.subtle, fontSize: 14 },
  swipeActions: { flex: 1, flexDirection: 'row', width: 152 },
  swipeAction: { width: 76, justifyContent: 'center', alignItems: 'center', gap: 6 },
  undo: {
    margin: 12,
    padding: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  link: { color: colors.brown, padding: 8 },
  error: { color: colors.danger, padding: 12 },
  overlay: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000055',
  },
  menu: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.md,
    padding: 16,
    backgroundColor: colors.background,
  },
  menuTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  menuItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
