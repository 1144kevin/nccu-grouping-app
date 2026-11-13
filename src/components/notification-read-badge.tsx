import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { colors, radius, yellowSurface } from '@/theme/tokens';

/** Unified top-right read/unread indicator for notification cards. */
export function NotificationReadBadge({ unread }: { unread: boolean }) {
  return (
    <View
      accessibilityLabel={unread ? '未讀通知' : '已讀通知'}
      style={[styles.badge, unread ? styles.unreadBadge : styles.readBadge]}
    >
      <Text style={[styles.label, unread ? styles.unreadLabel : styles.readLabel]}>
        {unread ? '未讀' : '已讀'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  unreadBadge: {
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
    borderColor: '#E8CA54',
  },
  readBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  unreadLabel: {
    color: colors.brown,
  },
  readLabel: {
    color: colors.muted,
  },
});
