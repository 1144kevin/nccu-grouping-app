import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { PrimaryButton } from '@/components/primitives';
import { PickupMap } from '@/components/pickup-map';
import { campusPickupPlaces, type CampusPickupPlace } from '@/data/campus-pickup-places';
import { googleMapsDirectionsUrl, postLocationSchema } from '@/lib/location';
import { pickupAddress, splitPickupAddress } from '@/lib/pickup-details';
import { pickupFavorites } from '@/lib/pickup-favorites-storage';
import type { PickupFavorite } from '@/lib/pickup-favorites';
import { searchPlaces, type PlaceResult } from '@/lib/place-search';
import { useLocationStore } from '@/store/location-store';
import { useAuthStore } from '@/store/auth-store';
import type { Coordinates, PostLocation } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = { value?: PostLocation; onChange: (value?: PostLocation) => void; disabled?: boolean };
export function LocationPicker(props: Props) {
  const actor = useAuthStore((s) => s.user?.id);
  return <PickerSession key={actor ?? 'guest'} {...props} actor={actor} />;
}

function PickerSession({ value, onChange, disabled = false, actor }: Props & { actor?: string }) {
  const original = splitPickupAddress(value?.address);
  const [draft, setDraft] = useState<PostLocation | undefined>(value ? {
    name: value.name, latitude: value.latitude, longitude: value.longitude,
    address: original.address, ...(value.source === 'openstreetmap' ? { source: value.source } : {}),
  } : undefined);
  const [name, setName] = useState(value?.name ?? '');
  const [note, setNote] = useState(original.note);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [favorites, setFavorites] = useState<PickupFavorite[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [custom, setCustom] = useState(false);
  const [askSave, setAskSave] = useState<PostLocation>();
  const [saving, setSaving] = useState(false);
  const [map, setMap] = useState<{ initial: Coordinates; name: string; mustPick?: boolean }>();
  const request = useRef(0);
  const mounted = useRef(false);
  const { loading, error, requestLocation } = useLocationStore();
  useEffect(() => {
    mounted.current = true;
    if (actor) {
      void pickupFavorites.list(actor).then((items) => {
        if (mounted.current) { setFavorites(items); setFavoritesReady(true); }
      }).catch(() => {
        if (mounted.current) setMessage('常用地點讀取失敗，仍可選點與發文。');
      });
    }
    return () => { mounted.current = false; };
  }, [actor]);
  const live = () => mounted.current && useAuthStore.getState().user?.id === actor;
  function invalidate() { request.current++; onChange(undefined); setAskSave(undefined); }
  function choose(place: PostLocation, isCustom = false) {
    request.current++;
    const details = splitPickupAddress(place.address);
    setDraft({ name: place.name, latitude: place.latitude, longitude: place.longitude,
      address: details.address, ...(place.source ? { source: place.source } : {}) });
    setName(place.name); setNote(details.note); setCustom(isCustom);
    setResults([]); setSearching(false); setMessage('請核對位置與說明，再按「確認取餐地點」。');
    invalidate();
  }
  function campus(place: CampusPickupPlace) {
    if (place.requiresPin) { setMap({ initial: place, name: place.name, mustPick: true }); return; }
    choose(place);
  }
  async function search() {
    if (query.trim().length < 2 || disabled) return;
    const id = ++request.current;
    setSearching(true); setResults([]); setMessage('');
    try {
      const found = await searchPlaces(query);
      if (!live() || id !== request.current) return;
      setResults(found);
      if (!found.length) setMessage('找不到地點，可改用常用地點、地圖選點或目前定位。');
    } catch {
      if (live() && id === request.current) setMessage('搜尋暫時無法使用，可改用常用地點或地圖選點。');
    } finally { if (live() && id === request.current) setSearching(false); }
  }
  async function locate() {
    const id = ++request.current;
    setSearching(false); setResults([]); setMessage('');
    const coordinates = await requestLocation();
    if (!live() || id !== request.current || !coordinates) return;
    choose({ name: '目前位置', ...coordinates }, true);
  }
  function confirm() {
    if (!draft || disabled) return;
    try {
      const location = postLocationSchema.parse({ ...draft, name: name.trim(), address: pickupAddress(draft.address ?? '', note) });
      onChange(location); setMessage('已確認取餐地點。');
      if (custom) setAskSave(location);
    } catch { setMessage('請填寫地點名稱；地址與補充說明合計最多 500 字。'); }
  }
  async function saveFavorite() {
    if (!actor || !askSave || !favoritesReady || disabled || saving) return;
    const stamp = request.current;
    setSaving(true);
    try {
      const items = await pickupFavorites.add(actor, askSave);
      if (live()) {
        setFavorites(items);
        if (stamp === request.current) {
          setCustom(false); setAskSave(undefined);
          setMessage('已加入我的常用地點（本裝置），相同位置不重複新增。');
        }
      }
    } catch (e) {
      if (live()) setMessage(e instanceof Error && e.message === 'favorite_limit'
        ? '常用地點最多 20 個，請先移除一個。' : '常用地點儲存失敗，取餐地點仍保留，可重試。');
    } finally { if (live()) setSaving(false); }
  }
  async function removeFavorite(id: string) {
    if (!actor || disabled || saving) return;
    setSaving(true);
    try { const items = await pickupFavorites.remove(actor, id); if (live()) setFavorites(items); }
    catch { if (live()) setMessage('無法移除常用地點，請重試。'); }
    finally { if (live()) setSaving(false); }
  }
  async function openMaps() {
    if (!value) return;
    try { await Linking.openURL(googleMapsDirectionsUrl(value)); }
    catch { if (live()) setMessage('無法開啟 Google Maps，請重試。'); }
  }
  return <View style={styles.container}>
    <Text style={styles.label}>常用校園地點</Text>
    <View style={styles.actions}>{campusPickupPlaces.map((p) => <PrimaryButton key={p.id} secondary disabled={disabled} onPress={() => campus(p)}>{p.name}</PrimaryButton>)}</View>
    <Text style={styles.hint}>校園點為參考位置，請核對入口；可用地圖微調實際取餐處。</Text>
    {favorites.length ? <><Text style={styles.label}>我的常用地點（本裝置）</Text>{favorites.map((p) => <View key={p.id} style={styles.actions}>
      <PrimaryButton secondary disabled={disabled} onPress={() => choose(p.location)}>{p.location.name}</PrimaryButton>
      <PrimaryButton secondary disabled={disabled || saving} onPress={() => { void removeFavorite(p.id); }}>移除 {p.location.name}</PrimaryButton>
    </View>)}</> : null}
    <TextInput accessibilityLabel="地點名稱或地址" placeholder="搜尋其他地點或完整地址" maxLength={100} value={query} editable={!disabled} onChangeText={(t) => {
      request.current++; setQuery(t); setResults([]); setSearching(false); invalidate();
    }} onSubmitEditing={() => { void search(); }} style={styles.input} />
    <View style={styles.actions}>
      <PrimaryButton secondary disabled={disabled || searching || query.trim().length < 2} onPress={() => { void search(); }}>{searching ? '搜尋中…' : '搜尋地點'}</PrimaryButton>
      <PrimaryButton secondary disabled={disabled || loading} onPress={() => { void locate(); }}>{loading ? '定位中…' : '使用目前位置'}</PrimaryButton>
      <PrimaryButton secondary disabled={disabled} onPress={() => setMap({ initial: draft ?? campusPickupPlaces[0], name: name || '自訂取餐地點', mustPick: !draft })}>在地圖上選點／微調</PrimaryButton>
    </View>
    {results.map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`選擇地點 ${p.name}`} disabled={disabled} onPress={() => choose(p)} style={styles.selected}>
      <Text>{p.name}</Text><Text style={styles.hint}>{p.address}</Text>
    </Pressable>)}
    {draft ? <View style={styles.selected}>
      <TextInput accessibilityLabel="取餐地點名稱" value={name} maxLength={100} editable={!disabled} onChangeText={(t) => { setName(t); invalidate(); }} style={styles.input} />
      <Text style={styles.hint}>已選位置：{draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</Text>
      {draft.address ? <Text style={styles.hint}>{draft.address}</Text> : null}
      <TextInput accessibilityLabel="補充取餐地點說明" placeholder="例如：一樓入口右側桌子、穿藍色上衣" multiline maxLength={300} value={note} editable={!disabled} onChangeText={(t) => { setNote(t); invalidate(); }} style={styles.input} />
      <PrimaryButton disabled={disabled || !name.trim()} onPress={confirm}>確認取餐地點</PrimaryButton>
    </View> : <Text style={styles.hint}>選擇常用地點、搜尋、定位或地圖點選，不必輸入經緯度。</Text>}
    {value ? <><Text style={styles.confirmed}>✓ 已確認：{value.name}</Text><PrimaryButton secondary disabled={disabled} onPress={() => { void openMaps(); }}>用 Google Maps 導航</PrimaryButton></> : null}
    {askSave ? <View style={styles.selected}>
      <Text>要將「{askSave.name}」加入我的常用地點嗎？</Text>
      <Text style={styles.hint}>只保存在本裝置並依帳號分開，不影響校園共用地點。</Text>
      <View style={styles.actions}><PrimaryButton disabled={disabled || saving || !actor || !favoritesReady} onPress={() => { void saveFavorite(); }}>加入我的常用地點</PrimaryButton>
        <PrimaryButton secondary disabled={saving} onPress={() => { setAskSave(undefined); setCustom(false); }}>暫時不用</PrimaryButton></View>
      {!actor ? <Text style={styles.hint}>登入後才可保存個人常用地點。</Text> : null}
    </View> : null}
    {message || error ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{message || error}</Text> : null}
    <Text style={styles.hint}>確認的地點與說明會公開顯示於貼文；定位僅在按鈕操作後取得。</Text>
    <Text accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => setMessage('無法開啟來源頁面。')); }} style={styles.hint}>搜尋與地圖 © OpenStreetMap contributors · 校園參考點：政大校園導覽</Text>
    {map ? <MapSelection key={`${map.initial.latitude}:${map.initial.longitude}:${map.name}`} initial={map.initial} mustPick={map.mustPick} name={map.name}
      onCancel={() => setMap(undefined)} onConfirm={(point, moved) => {
        if (disabled) return;
        if (!moved && !map.mustPick) { setMap(undefined); return; }
        const label = map.name;
        setMap(undefined);
        choose({ name: label, ...point, source: 'openstreetmap' }, moved || custom);
      }} /> : null}
  </View>;
}

function MapSelection({ initial, mustPick, name, onCancel, onConfirm }: {
  initial: Coordinates; mustPick?: boolean; name: string; onCancel: () => void;
  onConfirm: (point: Coordinates, moved: boolean) => void;
}) {
  const [point, setPoint] = useState(initial);
  const [moved, setMoved] = useState(false);
  return <Modal visible animationType="slide" onRequestClose={onCancel}>
    <KeyboardScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, gap: 16 }}>
      <Text style={styles.label}>選擇取餐位置：{name}</Text>
      {mustPick ? <Text>請點選或拖動圖釘，標出實際取餐位置後再確認。</Text> : null}
      <PickupMap initial={initial} onPick={(next) => { setPoint(next); setMoved(true); }} />
      <Text>圖釘位置：{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Text>
      <PrimaryButton disabled={mustPick && !moved} onPress={() => onConfirm(point, moved)}>使用此位置</PrimaryButton>
      <PrimaryButton secondary onPress={onCancel}>取消選點</PrimaryButton>
    </KeyboardScrollView>
  </Modal>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.ink },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selected: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  confirmed: { color: colors.success, fontSize: 14, fontWeight: '600' },
});
