import { AppText as Text } from '@/components/app-text';
import { InlineLoading } from '@/components/inline-loading';
import { useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { distanceKm, formatDistance, googleMapsDirectionsUrl } from '@/lib/location';
import { splitPickupAddress } from '@/lib/pickup-details';
import { formatPrice } from '@/lib/price';
import { useLocationStore } from '@/store/location-store';
import type { FeedPost } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';
import { displayTimestamp } from '@/lib/display-time';

function shortDeadline(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? displayTimestamp(value) : value;
}
function InfoRow({
  icon,
  label,
  children,
  last = false,
}: PropsWithChildren<{
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  last?: boolean;
}>) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <MaterialCommunityIcons name={icon} size={17} color={colors.brown} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueArea}>{children}</View>
    </View>
  );
}

export function PostInfo({
  post,
  reminder = false,
  compact = false,
}: {
  post: FeedPost;
  reminder?: boolean;
  compact?: boolean;
}) {
  const { coordinates, loading, error, requestLocation } = useLocationStore();
  const [mapError, setMapError] = useState('');
  const location = post.location;
  const details = splitPickupAddress(location?.address);

  async function openMap() {
    if (!location) return;
    setMapError('');
    try {
      await Linking.openURL(googleMapsDirectionsUrl(location));
    } catch {
      setMapError('無法開啟 Google Maps，請稍後再試。');
    }
  }

  if (compact)
    return (
      <View style={styles.chips}>
        {(
          [
            {
              icon: 'timer-outline',
              label: '截止時間',
              value: post.deadlineAt ? shortDeadline(post.deadlineAt) : post.deadline,
            },
            { icon: 'account-group', label: '參與人數', value: `${post.joined}/${post.capacity}` },
            { icon: 'cash', label: '每人金額', value: formatPrice(post.pricePerPerson) },
            { icon: 'map-marker-outline', label: '取餐地點', value: location?.name ?? '未提供' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole={item.label === '取餐地點' && location ? 'link' : 'text'}
            accessibilityLabel={`${item.label}：${item.value}${item.label === '截止時間' && reminder ? '，已提醒' : ''}`}
            disabled={item.label !== '取餐地點' || !location}
            onPress={() => {
              void openMap();
            }}
            style={styles.chip}
          >
            <MaterialCommunityIcons name={item.icon} size={19} color={colors.yellow} />
            <Text numberOfLines={1} style={styles.chipText}>
              {item.value}
            </Text>
          </Pressable>
        ))}
        {mapError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mapError}
          </Text>
        ) : null}
      </View>
    );
  return (
    <View style={styles.container}>
      <InfoRow icon="clock-outline" label="截止時間">
        <Text style={styles.value}>
          {post.deadline}
          {reminder ? ' · 已提醒' : ''}
        </Text>
      </InfoRow>
      <InfoRow icon="account-group-outline" label="參與人數">
        <Text style={styles.value}>
          {post.joined} / {post.capacity} 人
        </Text>
      </InfoRow>
      <InfoRow icon="cash" label="每人金額">
        <Text style={styles.value}>{formatPrice(post.pricePerPerson)}</Text>
      </InfoRow>
      <InfoRow icon="map-marker-outline" label="取餐地點" last>
        {location ? (
          <>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`在 Google Maps 開啟 ${location.name}`}
              onPress={openMap}
              style={styles.place}
            >
              <Text style={[styles.value, styles.placeName]}>{location.name}</Text>
              <MaterialCommunityIcons name="open-in-new" size={13} color={colors.brown} />
            </Pressable>
            {details.address && details.address !== location.name ? (
              <Text style={styles.note}>{details.address}</Text>
            ) : null}
            {details.note ? <Text style={styles.note}>取餐說明：{details.note}</Text> : null}
            {coordinates ? (
              <Text style={styles.distance}>
                {formatDistance(distanceKm(coordinates, location))} · 直線距離
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void requestLocation()}
              style={styles.locate}
            >
              {loading ? (
                <InlineLoading label="定位中" textStyle={styles.locateText} />
              ) : (
                <Text style={styles.locateText}>{coordinates ? '更新距離' : '查看距離'}</Text>
              )}
            </Pressable>
            {location.source === 'openstreetmap' ? (
              <Text
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() =>
                    setMapError('無法開啟資料來源頁面。'),
                  );
                }}
                style={styles.attribution}
              >
                © OpenStreetMap contributors
              </Text>
            ) : null}
            {error || mapError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {mapError || error}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.value}>未提供</Text>
        )}
      </InfoRow>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    width: '48%',
    flexGrow: 1,
    minHeight: 38,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CCCBC5',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: { flexShrink: 1, fontSize: 15, color: colors.ink },
  container: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { width: 64, color: colors.muted, fontSize: 14, lineHeight: 20 },
  valueArea: { flex: 1, gap: 3 },
  value: { color: colors.ink, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeName: { flexShrink: 1, color: colors.brown },
  distance: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  locate: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  locateText: { color: colors.brown, fontSize: 13, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  attribution: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
