import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { googleMapsUrl } from '@/lib/location';
import { searchPlaces, type PlaceResult } from '@/lib/place-search';
import { useLocationStore } from '@/store/location-store';
import type { PostLocation } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

export function LocationPicker({ value, onChange }: { value?: PostLocation; onChange: (value?: PostLocation) => void }) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const requestId = useRef(0);
  const { loading, error, requestLocation } = useLocationStore();
  useEffect(() => () => { requestId.current += 1; }, []);

  function edit(text: string) {
    requestId.current += 1;
    setQuery(text);
    setResults([]);
    setMessage('');
    setSearching(false);
    onChange(undefined);
  }

  async function search() {
    if (query.trim().length < 2 || searching) return;
    const id = ++requestId.current;
    setSearching(true);
    setMessage('');
    setResults([]);
    onChange(undefined);
    try {
      const found = await searchPlaces(query);
      if (id !== requestId.current) return;
      setResults(found);
      if (!found.length) setMessage('找不到這個地點，請加上縣市、路名或改用完整地址。');
    } catch {
      if (id === requestId.current) setMessage('地點搜尋暫時無法使用，請稍後重試，或使用目前位置。');
    } finally { if (id === requestId.current) setSearching(false); }
  }

  async function useCurrentLocation() {
    const id = ++requestId.current;
    setSearching(false);
    setResults([]);
    setMessage('');
    onChange(undefined);
    const coordinates = await requestLocation();
    if (id !== requestId.current || !coordinates) return;
    const name = query.trim() || '目前位置';
    setQuery(name);
    onChange({ name, ...coordinates });
  }

  async function openMap() {
    if (!value) return;
    try { await Linking.openURL(googleMapsUrl(value)); }
    catch { setMessage('無法開啟 Google Maps，請稍後再試。'); }
  }

  return (
    <View style={styles.container}>
      <TextInput accessibilityLabel="地點名稱或地址" maxLength={100} value={query} editable={!loading} onChangeText={edit} onSubmitEditing={search} returnKeyType="search" placeholder="輸入地點名稱或完整地址" placeholderTextColor={colors.subtle} style={styles.input} />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={query.trim().length < 2 || searching || loading} onPress={search} style={[styles.button, styles.searchButton, (query.trim().length < 2 || searching || loading) && styles.disabled]}><MaterialCommunityIcons name="magnify" size={17} color={colors.ink} /><Text style={styles.buttonText}>{searching ? '搜尋中…' : '搜尋地點'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={loading} onPress={useCurrentLocation} style={styles.button}><MaterialCommunityIcons name="crosshairs-gps" size={17} color={colors.brown} /><Text style={styles.buttonText}>{loading ? '定位中…' : '使用目前位置'}</Text></Pressable>
      </View>
      {results.length > 0 ? <View style={styles.results}><Text style={styles.hint}>請選擇正確的取餐地點</Text>{results.map((place) => <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`選擇地點 ${place.name} ${place.address}`} onPress={() => { requestId.current += 1; setQuery(place.name); setResults([]); setMessage(''); onChange(place); }} style={({ pressed }) => [styles.result, pressed && styles.disabled]}><Text style={styles.resultName}>{place.name}</Text><Text style={styles.hint}>{place.address}</Text></Pressable>)}</View> : null}
      {value ? <View style={styles.selected}><Text style={styles.confirmed}>✓ {value.name}</Text>{value.address ? <Text style={styles.hint}>{value.address}</Text> : null}<Pressable accessibilityRole="link" onPress={openMap} style={styles.mapLink}><Text style={styles.linkText}>在 Google Maps 查看</Text></Pressable></View> : <Text style={styles.hint}>搜尋後選擇地點即可，不需要連結或座標。</Text>}
      {message || error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{message || error}</Text> : null}
      <Text style={styles.hint}>地點會公開顯示於貼文。</Text>
      <Text accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => setMessage('無法開啟資料來源頁面。')); }} style={styles.attribution}>地點搜尋：Photon · © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 15 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  searchButton: { backgroundColor: colors.yellow },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  confirmed: { fontSize: 15, fontWeight: '600', color: colors.success },
  results: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  result: { paddingVertical: spacing.md, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  selected: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, gap: 4 },
  mapLink: { minHeight: 32, justifyContent: 'center' },
  linkText: { fontSize: 14, color: colors.brown },
  attribution: { fontSize: 12, color: colors.muted },
});
