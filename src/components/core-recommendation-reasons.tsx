import { StyleSheet, View } from 'react-native';
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
  const reasons = info.reasons
    .filter((r) => r.code === 'preferred_tags' || r.code === 'preferred_location')
    .slice(0, 2);
  if (!reasons.length && !post.semantic_recommendation) return null;
  return (
    <View testID={`recommendation-reasons-${post.id}`} style={styles.row}>
      {post.semantic_recommendation ? <Text style={styles.tag}>符合你的需求</Text> : null}
      {reasons.map((reason) => (
        <Text key={reason.code} numberOfLines={1} style={styles.tag}>
          {reason.text}
        </Text>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    color: colors.brown,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.pill,
  },
});
