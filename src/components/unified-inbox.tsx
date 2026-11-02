import { PageLoading } from '@/components/page-loading';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { AppHeader, DetailHeader, EmptyState, IconButton, Screen } from '@/components/primitives';
import { ChatSwipeRow } from '@/components/chat-swipe-row';
import type { ChatSwipeHandle } from '@/components/chat-swipe-row.types';
import {
  socialApi,
  useInboxThreads,
  type InboxFilter,
  type InboxThread,
  type InboxPage,
} from '@/lib/social-api';
import { coreError } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, typography, yellowSurface } from '@/theme/tokens';
import { InboxAvatar } from './inbox-avatar';
import { displayTimestamp } from '@/lib/display-time';

export function threadTitle(item: InboxThread) {
  if (item.kind === 'stealth') return `【偷揪】${item.title}`;
  return `【${item.kind === 'group' ? '群組' : '私訊'}】${item.post.content.split('\n')[0]}`;
}
export function UnifiedInbox() {
  const actor = useAuthStore((s) => s.user?.id);
  return <Inbox key={actor} />;
}
function Inbox() {
  const client = useQueryClient();
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
    onSuccess: (result, input) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      client.setQueriesData<InfiniteData<InboxPage>>(
        { queryKey: ['core', actor, 'social-inbox'] },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.kind === input.item.kind && item.id === input.item.id
                      ? { ...item, ...result, ...input.value }
                      : item,
                  ),
                })),
              }
            : old,
      );
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
          {(['all', 'primary', 'group', 'direct'] as const).map((kind) => (
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
                {{ all: '全部', primary: '主要', group: '群組', direct: '私訊' }[kind]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!deleted ? <Text style={styles.hint}>左滑主要與選項 · 右滑釘選或刪除</Text> : null}
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
            <PageLoading />
          ) : deleted ? (
            <EmptyState
              icon="message-outline"
              title={deleted ? '沒有已刪除的聊天室' : '目前沒有訊息'}
            />
          ) : null
        }
        ListFooterComponent={
          <View>
            {query.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                disabled={query.isFetchingNextPage}
                accessibilityState={{ busy: query.isFetchingNextPage }}
                onPress={() => {
                  void query.fetchNextPage();
                }}
              >
                {query.isFetchingNextPage ? (
                  <PageLoading accessibilityLabel="正在載入更多聊天室" />
                ) : (
                  <Text style={styles.end}>載入更多</Text>
                )}
              </Pressable>
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
                    icon={selected.inbox === 'primary' ? 'star' : 'star-outline'}
                    label={selected.inbox === 'primary' ? '取消主要' : '移至主要'}
                    disabled={change.isPending}
                    onPress={() =>
                      update(selected, {
                        inbox: selected.inbox === 'primary' ? 'general' : 'primary',
                      })
                    }
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
            icon={item.inbox === 'primary' ? 'star' : 'star-outline'}
            label="主要"
            disabled={busy || side !== 'right'}
            onPress={() => act({ inbox: item.inbox === 'primary' ? 'general' : 'primary' })}
          />
          <SwipeAction
            icon="dots-horizontal"
            label="聊天室選項"
            secondary
            disabled={busy || side !== 'right'}
            onPress={() => {
              swipe.current?.close();
              onMore();
            }}
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
          router.push(
            item.kind === 'stealth'
              ? `/stealth-chat/${item.id}`
              : item.kind === 'group'
                ? `/chat/${item.post.id}`
                : `/direct-chat/${item.id}`,
          );
        }}
        style={styles.rowButton}
      >
        <InboxAvatar item={item} />
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, item.unread_count > 0 && styles.unread]}>
              {threadTitle(item)}
            </Text>
            {item.pinned ? (
              <MaterialCommunityIcons name="pin" size={15} color={colors.brown} />
            ) : null}
          </View>
          <Text numberOfLines={1} style={[styles.preview, item.unread_count > 0 && styles.unread]}>
            {item.last_message
              ? `${item.last_message.sender_name}：${item.last_message.content}`
              : ''}
          </Text>
        </View>
        <View style={styles.metadata}>
          <Text style={styles.time}>{displayTimestamp(item.updated_at)}</Text>
          {item.unread_count > 0 ? (
            <View
              accessibilityLabel={`未讀 ${item.unread_count} 則`}
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                paddingHorizontal: 6,
                ...yellowSurface,
                backgroundColor: colors.yellow,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text fixedSize style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {deleted ? (
        <IconButton
          icon="restore"
          label="復原聊天室"
          onPress={() => onChange({ deleted: false })}
        />
      ) : null}
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
function MenuItem({
  icon,
  label,
  onPress,
  danger,
  disabled,
  secondary,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  secondary?: boolean;
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
  secondary,
}: React.ComponentProps<typeof MenuItem>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.swipeAction,
        !danger && !secondary && yellowSurface,
        { backgroundColor: danger ? colors.danger : secondary ? colors.surface : colors.yellow },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={danger ? '#fff' : secondary ? colors.ink : colors.onYellow}
      />
      <Text style={{ color: danger ? '#fff' : secondary ? colors.ink : colors.onYellow }}>
        {label}
      </Text>
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
  activeTab: { ...yellowSurface, backgroundColor: colors.yellow },
  tabText: { color: colors.ink, fontSize: 16 },
  hint: {
    paddingHorizontal: 16,
    marginVertical: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  row: {
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  rowButton: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center' },
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
  metadata: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginLeft: 8,
    minWidth: 64,
  },
  time: { color: colors.muted, fontSize: 11 },
  preview: { marginTop: 4, color: colors.muted, fontSize: 14 },
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
