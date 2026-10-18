import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import type { CorePost } from '@/lib/core-api';
import { colors, radius, spacing } from '@/theme/tokens';

export function CoreRecommendationReasons({ post }: { post: CorePost }) {
  const info = post.recommendation;
  if (
    !info ||
    info.version !== 'rules_v2' ||
    post.status !== 'open' ||
    post.joined >= post.capacity
  )
    return null;
  return (
    <View testID={`recommendation-reasons-${post.id}`} style={styles.box}>
      <Text style={styles.title}>為什麼推薦這一團</Text>
      {info.reasons.map((reason) => (
        <Text key={reason.code} style={styles.body}>
          • {reason.text}
        </Text>
      ))}
      <Text style={styles.hint}>
        依偏好、剩餘名額及截止時間排序，並非成團機率。加入前會重新檢查名額與期限。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.yellowSoft,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, lineHeight: 21, color: colors.ink },
  hint: { fontSize: 12, lineHeight: 19, color: colors.muted },
});
