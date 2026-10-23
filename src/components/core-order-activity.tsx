import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,

  StyleSheet,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { Avatar, DetailHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { coreError, type CoreOrderActivity } from '@/lib/core-api';
import { useCoreOrderActivity } from '@/lib/core-chat-hooks';
import { SegmentedTabs, shortDate } from '@/components/list-ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSavedPostPreferences } from '@/lib/engagement-api';

export function CoreOrderActivityScreen() {
  const [reminders, setReminders] = useState(false);
  return (
    <Screen>
      <DetailHeader title="拼單動態" />
      <SegmentedTabs
        value={reminders ? 'reminders' : 'activity'}
        onChange={(value) => setReminders(value === 'reminders')}
        options={[
          { value: 'activity', label: '申請與審核' },
          { value: 'reminders', label: '截止提醒' },
        ]}
      />
      {reminders ? <CoreDeadlineReminders /> : <CoreRequestActivity />}
    </Screen>
  );
}

function CoreRequestActivity() {
  const query = useCoreOrderActivity(true);
  const items = [...query.items].sort(
    (a, b) =>
      Number(
        b.kind === 'hosted_request' &&
          b.status === 'pending' &&
          !b.post_cancelled &&
          !b.post_expired,
      ) -
      Number(
        a.kind === 'hosted_request' &&
          a.status === 'pending' &&
          !a.post_cancelled &&
          !a.post_expired,
      ),
  );
  return (
    <View style={{ flex: 1 }}>
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
              icon="bell-outline"
              title={query.error ? '動態載入失敗' : '目前沒有拼單動態'}
              action={
                query.error ? (
                  <PrimaryButton
                    secondary
                    onPress={() => {
                      return query.refetch();
                    }}
                  >
                    重試
                  </PrimaryButton>
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <PrimaryButton
              secondary
              disabled={query.isFetchingNextPage}
              onPress={() => {
                void query.fetchNextPage();
              }}
            >
              載入更多
            </PrimaryButton>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看動態 ${activityTitle(item)}`}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/order/[id]',
                params: {
                  id: item.post_id,
                  ...(item.kind === 'hosted_request' &&
                  item.status === 'pending' &&
                  !item.post_cancelled &&
                  !item.post_expired
                    ? { focus: 'requests' }
                    : {}),
                },
              })
            }
          >
            <View style={styles.row}>
              <Avatar name={item.requester_name} badge="🍱" size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{activityTitle(item)}</Text>
                <Text style={styles.hint}>{shortDate(item.occurred_at)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.subtle} />
            </View>
            <Text numberOfLines={2} style={styles.body}>
              {item.post_content}
            </Text>
            {item.kind === 'hosted_request' &&
            item.status === 'pending' &&
            !item.post_cancelled &&
            !item.post_expired ? (
              <Text style={styles.action}>審核申請 →</Text>
            ) : null}
            {item.post_cancelled || item.post_expired ? (
              <Text style={styles.hint}>
                {item.post_cancelled ? '這筆拼單目前已取消。' : '這筆拼單目前已截止。'}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function CoreDeadlineReminders() {
  const query = useSavedPostPreferences();
  const items = query.data?.items.filter((item) => item.reminder) ?? [];
  const labels = {
    scheduled: '已設定提醒',
    due: '即將截止',
    expired: '已截止',
    cancelled: '拼單已取消',
  };
  return (
    <View style={{ flex: 1 }}>
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.list}
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
              icon="bell-outline"
              title={query.error ? '提醒載入失敗' : '尚未設定截止提醒'}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.card}
            onPress={() => router.push(`/post/${item.post_id}`)}
          >
            <Text style={styles.title}>{labels[item.status]}</Text>
            <Text style={styles.body}>{item.post_content}</Text>
            <Text style={styles.hint}>
              截止：{new Date(item.deadline_at).toLocaleString('zh-TW')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function activityTitle(item: CoreOrderActivity): string {
  if (item.kind === 'my_request')
    return {
      pending: '你的申請等待主揪接受',
      accepted: '你的申請已獲接受',
      rejected: '主揪未接受你的申請',
      cancelled: '你已退出或取消申請',
    }[item.status];
  return {
    pending: `${item.requester_name} 等待你審核`,
    accepted: `已接受 ${item.requester_name} 的申請`,
    rejected: `已拒絕 ${item.requester_name} 的申請`,
    cancelled: `${item.requester_name} 已退出或取消申請`,
  }[item.status];
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  note: { padding: spacing.md, color: colors.muted, fontSize: 13, lineHeight: 21 },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  error: { padding: spacing.md, color: colors.danger, fontSize: 13 },
});
