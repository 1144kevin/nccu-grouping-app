import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/primitives';
import { PickupMap } from '@/components/pickup-map';
import { campusPickupPlaces, type CampusPickupPlace } from '@/data/campus-pickup-places';
import { distanceKm, googleMapsDirectionsUrl, postLocationSchema } from '@/lib/location';
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
  const [draft, setDraft] = useState<PostLocation | undefined>(
    value
      ? {
          name: value.name,
          latitude: value.latitude,
          longitude: value.longitude,
          address: original.address,
          ...(value.source === 'openstreetmap' ? { source: value.source } : {}),
        }
      : undefined,
  );
  const [name, setName] = useState(value?.name ?? '');
  const [note, setNote] = useState(original.note);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(!value);
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
      void pickupFavorites
        .list(actor)
        .then((items) => {
          if (mounted.current) {
            setFavorites(items);
            setFavoritesReady(true);
          }
        })
        .catch(() => {
          if (mounted.current) setMessage('常用地點讀取失敗，仍可選點與發文。');
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [actor]);
  const live = () => mounted.current && useAuthStore.getState().user?.id === actor;
  function invalidate() {
    request.current++;
    onChange(undefined);
    setAskSave(undefined);
  }
  function choose(place: PostLocation, isCustom = false) {
    request.current++;
    const details = splitPickupAddress(place.address);
    setDraft({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      address: details.address,
      ...(place.source ? { source: place.source } : {}),
    });
    setName(place.name);
    setNote(details.note);
    setCustom(isCustom);
    setEditing(true);
    setResults([]);
    setSearching(false);
    setMessage('');
    invalidate();
  }
  function campus(place: CampusPickupPlace) {
    choose(place);
    onChange(postLocationSchema.parse(place));
    setEditing(false);
  }
  async function search() {
    if (query.trim().length < 2 || disabled) return;
    const id = ++request.current;
    setSearching(true);
    setResults([]);
    setMessage('');
    try {
      const found = await searchPlaces(query);
      if (!live() || id !== request.current) return;
      setResults(found);
      if (!found.length) setMessage('找不到地點，可改用常用地點、地圖選點或目前定位。');
    } catch {
      if (live() && id === request.current)
        setMessage('搜尋暫時無法使用，可改用常用地點或地圖選點。');
    } finally {
      if (live() && id === request.current) setSearching(false);
    }
  }
  async function locate() {
    const id = ++request.current;
    setSearching(false);
    setResults([]);
    setMessage('');
    const coordinates = await requestLocation();
    if (!live() || id !== request.current || !coordinates) return;
    choose({ name: '目前位置', ...coordinates }, true);
  }
  function confirm() {
    if (!draft || disabled) return;
    try {
      const location = postLocationSchema.parse({
        ...draft,
        name: name.trim(),
        address: pickupAddress(draft.address ?? '', note),
      });
      onChange(location);
      setMessage('');
      setEditing(false);
      if (custom) setAskSave(location);
    } catch {
      setMessage('請填寫地點名稱；地址與補充說明合計最多 500 字。');
    }
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
          setCustom(false);
          setAskSave(undefined);
          setMessage('已加入我的常用地點（本裝置），相同位置不重複新增。');
        }
      }
    } catch (e) {
      if (live())
        setMessage(
          e instanceof Error && e.message === 'favorite_limit'
            ? '常用地點最多 20 個，請先移除一個。'
            : '常用地點儲存失敗，取餐地點仍保留，可重試。',
        );
    } finally {
      if (live()) setSaving(false);
    }
  }
  async function removeFavorite(id: string) {
    if (!actor || disabled || saving) return;
    setSaving(true);
    try {
      const items = await pickupFavorites.remove(actor, id);
      if (live()) setFavorites(items);
    } catch {
      if (live()) setMessage('無法移除常用地點，請重試。');
    } finally {
      if (live()) setSaving(false);
    }
  }
  async function openMaps() {
    if (!value) return;
    try {
      await Linking.openURL(googleMapsDirectionsUrl(value));
    } catch {
      if (live()) setMessage('無法開啟 Google Maps，請重試。');
    }
  }
  return (
    <View style={styles.container}>
      <Text style={styles.label}>常用校園地點</Text>
      <View style={styles.actions}>
        {campusPickupPlaces.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => campus(p)}
            style={[styles.placeChip, draft?.name === p.name && styles.activeChip]}
          >
            <Text style={styles.chipLabel}>{p.name}</Text>
          </Pressable>
        ))}
      </View>
      {favorites.length ? (
        <>
          <Text style={styles.label}>我的常用地點（本裝置）</Text>
          <View style={styles.actions}>
            {favorites.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => {
                    choose(p.location);
                    onChange(p.location);
                    setEditing(false);
                  }}
                  style={[
                    styles.placeChip,
                    value && distanceKm(p.location, value) < 0.005 && styles.activeChip,
                  ]}
                  accessibilityState={{
                    selected: !!value && distanceKm(p.location, value) < 0.005,
                  }}
                >
                  <Text style={styles.chipLabel}>{p.location.name}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除 ${p.location.name}`}
                  disabled={disabled || saving}
                  onPress={() => {
                    void removeFavorite(p.id);
                  }}
                  style={styles.smallButton}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <TextInput
        accessibilityLabel="地點名稱或地址"
        placeholder="搜尋地點或地址"
        maxLength={100}
        value={query}
        editable={!disabled}
        onChangeText={(t) => {
          request.current++;
          setQuery(t);
          setResults([]);
          setSearching(false);
          invalidate();
        }}
        onSubmitEditing={() => {
          void search();
        }}
        style={styles.input}
      />
      <View style={styles.actions}>
        <PrimaryButton
          style={styles.toolButton}
          disabled={disabled || searching || query.trim().length < 2}
          onPress={() => {
            void search();
          }}
          loading={searching}
        >
          {searching ? '搜尋中' : '搜尋地點'}
        </PrimaryButton>
        <PrimaryButton
          style={styles.toolButton}
          secondary
          disabled={disabled || loading}
          onPress={() => {
            void locate();
          }}
          loading={loading}
        >
          {loading ? '定位中' : '使用目前位置'}
        </PrimaryButton>
        <PrimaryButton
          style={styles.toolButton}
          secondary
          disabled={disabled}
          onPress={() =>
            setMap({
              initial: draft ?? campusPickupPlaces[0],
              name: name || '自訂取餐地點',
              mustPick: !draft,
            })
          }
          accessibilityLabel="在地圖上選點／微調"
        >
          地圖選點
        </PrimaryButton>
      </View>
      {results.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`選擇地點 ${p.name}`}
          disabled={disabled}
          onPress={() => choose(p, true)}
          style={styles.selected}
        >
          <Text>{p.name}</Text>
          <Text style={styles.hint}>{p.address}</Text>
        </Pressable>
      ))}
      {value && !editing ? (
        <View style={styles.selected}>
          <View style={styles.actions}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
            <Text style={[styles.confirmed, { flex: 1 }]}>{value.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="編輯取餐地點說明"
              disabled={disabled}
              onPress={() => setEditing(true)}
              style={styles.smallButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.brown} />
            </Pressable>
          </View>
          {original.address ? <Text style={styles.hint}>{original.address}</Text> : null}
          {original.note ? <Text style={styles.hint}>{original.note}</Text> : null}
          {actor &&
          favoritesReady &&
          !askSave &&
          !favorites.some((p) => distanceKm(p.location, value) < 0.005) ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled || saving}
              onPress={() => setAskSave(value)}
            >
              <Text style={{ color: colors.brown, paddingVertical: 6 }}>加入我的常用地點</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="用 Google Maps 導航"
            disabled={disabled}
            onPress={() => {
              void openMaps();
            }}
          >
            <Text style={{ color: colors.brown, paddingVertical: 6 }}>在 Google Maps 開啟 ↗</Text>
          </Pressable>
        </View>
      ) : draft ? (
        <View style={styles.selected}>
          <TextInput
            accessibilityLabel="取餐地點名稱"
            value={name}
            maxLength={100}
            editable={!disabled}
            onChangeText={(t) => {
              setName(t);
              invalidate();
            }}
            style={styles.input}
          />

          {draft.address ? <Text style={styles.hint}>{draft.address}</Text> : null}
          <TextInput
            accessibilityLabel="補充取餐地點說明"
            placeholder="例如：一樓入口右側桌子、穿藍色上衣"
            multiline
            maxLength={300}
            value={note}
            editable={!disabled}
            onChangeText={(t) => {
              setNote(t);
              invalidate();
            }}
            style={styles.input}
          />
          <PrimaryButton disabled={disabled || !name.trim()} onPress={confirm}>
            確認取餐地點
          </PrimaryButton>
        </View>
      ) : null}
      {askSave ? (
        <View style={styles.selected}>
          <Text>要將「{askSave.name}」加入我的常用地點嗎？</Text>
          <Text style={styles.hint}>儲存於此帳號的本裝置。</Text>
          <View style={styles.actions}>
            <PrimaryButton
              disabled={disabled || saving || !actor || !favoritesReady}
              onPress={() => {
                void saveFavorite();
              }}
            >
              加入我的常用地點
            </PrimaryButton>
            <PrimaryButton
              secondary
              disabled={saving}
              onPress={() => {
                setAskSave(undefined);
                setCustom(false);
              }}
            >
              暫時不用
            </PrimaryButton>
          </View>
          {!actor ? <Text style={styles.hint}>登入後才可保存個人常用地點。</Text> : null}
        </View>
      ) : null}
      {message || error ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {message || error}
        </Text>
      ) : null}

      <Text
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() =>
            setMessage('無法開啟來源頁面。'),
          );
        }}
        style={styles.hint}
      >
        © OpenStreetMap contributors
      </Text>
      {map ? (
        <MapSelection
          key={`${map.initial.latitude}:${map.initial.longitude}:${map.name}`}
          initial={map.initial}
          mustPick={map.mustPick}
          name={map.name}
          onCancel={() => setMap(undefined)}
          onConfirm={(point, moved) => {
            if (disabled) return;
            if (!moved && !map.mustPick) {
              setMap(undefined);
              return;
            }
            const label = map.name;
            setMap(undefined);
            choose({ name: label, ...point, source: 'openstreetmap' }, moved || custom);
          }}
        />
      ) : null}
    </View>
  );
}

function MapSelection({
  initial,
  mustPick,
  name,
  onCancel,
  onConfirm,
}: {
  initial: Coordinates;
  mustPick?: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: (point: Coordinates, moved: boolean) => void;
}) {
  const [point, setPoint] = useState(initial);
  const [moved, setMoved] = useState(false);
  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <KeyboardScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, gap: 16 }}>
        <Text style={styles.label}>選擇取餐位置：{name}</Text>
        {mustPick ? <Text>請點選或拖動圖釘，標出實際取餐位置後再確認。</Text> : null}
        <PickupMap
          initial={initial}
          onPick={(next) => {
            setPoint(next);
            setMoved(true);
          }}
        />
        <Text>
          圖釘位置：{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
        </Text>
        <PrimaryButton disabled={mustPick && !moved} onPress={() => onConfirm(point, moved)}>
          使用此位置
        </PrimaryButton>
        <PrimaryButton secondary onPress={onCancel}>
          取消選點
        </PrimaryButton>
      </KeyboardScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  placeChip: {
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  activeChip: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  chipLabel: { color: colors.ink, fontSize: 13 },
  smallButton: { minWidth: 36, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  toolButton: { minHeight: 38, paddingHorizontal: 12 },
  container: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.ink,
  },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selected: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  confirmed: { color: colors.success, fontSize: 14, fontWeight: '600' },
});
