import { useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { distanceKm, formatDistance, googleMapsUrl } from '@/lib/location';
import { formatPrice } from '@/lib/price';
import { useLocationStore } from '@/store/location-store';
import type { FeedPost } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

function InfoRow({ icon, label, children, last = false }: PropsWithChildren<{ icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; last?: boolean }>) {
  return <View style={[styles.row, last && styles.lastRow]}><MaterialCommunityIcons name={icon} size={17} color={colors.brown} /><Text style={styles.label}>{label}</Text><View style={styles.valueArea}>{children}</View></View>;
}

export function PostInfo({ post, reminder = false }: { post: FeedPost; reminder?: boolean }) {
  const { coordinates, loading, error, requestLocation } = useLocationStore();
  const [mapError, setMapError] = useState('');
  const location = post.location;

  async function openMap() {
    if (!location) return;
    setMapError('');
    try { await Linking.openURL(googleMapsUrl(location)); }
    catch { setMapError('無法開啟 Google Maps，請稍後再試。'); }
  }

  return (
    <View style={styles.container}>
      <InfoRow icon="clock-outline" label="截止時間"><Text style={styles.value}>{post.deadline}{reminder ? ' · 已提醒' : ''}</Text></InfoRow>
      <InfoRow icon="account-group-outline" label="參與人數"><Text style={styles.value}>{post.joined} / {post.capacity} 人</Text></InfoRow>
      <InfoRow icon="cash" label="每人金額"><Text style={styles.value}>{formatPrice(post.pricePerPerson)}</Text></InfoRow>
      <InfoRow icon="map-marker-outline" label="取餐地點" last>
        {location ? <>
          <Pressable accessibilityRole="link" accessibilityLabel={`在 Google Maps 開啟 ${location.name}`} onPress={openMap} style={styles.place}><Text style={[styles.value, styles.placeName]}>{location.name}</Text><MaterialCommunityIcons name="open-in-new" size={13} color={colors.brown} /></Pressable>
          {location.address && location.address !== location.name ? <Text style={styles.note}>{location.address}</Text> : null}
          <Text style={styles.distance}>{coordinates ? `${formatDistance(distanceKm(coordinates, location))} · 直線` : loading ? '定位中…' : '開啟定位以查看距離'}</Text>
          <Pressable accessibilityRole="button" disabled={loading} onPress={() => void requestLocation()} style={styles.locate}><Text style={styles.locateText}>{coordinates ? '更新定位' : '開啟定位'}</Text></Pressable>
          {coordinates ? <Text style={styles.note}>依最近一次定位估算</Text> : null}
          {location.source === 'openstreetmap' ? <Text accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => setMapError('無法開啟資料來源頁面。')); }} style={styles.attribution}>© OpenStreetMap contributors</Text> : null}
          {error || mapError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{mapError || error}</Text> : null}
        </> : <Text style={styles.value}>未提供</Text>}
      </InfoRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  label: { width: 56, color: colors.muted, fontSize: 12, lineHeight: 18 },
  valueArea: { flex: 1, gap: 3 },
  value: { color: colors.ink, fontSize: 12, fontWeight: '500', lineHeight: 18 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeName: { flexShrink: 1, color: colors.brown },
  distance: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  locate: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  locateText: { color: colors.brown, fontSize: 11, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  attribution: { color: colors.muted, fontSize: 9 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 17 },
});
