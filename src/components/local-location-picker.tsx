import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { postLocationSchema } from '@/lib/location';
import type { PostLocation } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

export function LocalLocationPicker({ value, onChange }: { value?: PostLocation; onChange: (value?: PostLocation) => void }) {
  const [name, setName] = useState(value?.name ?? '');
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  function change(nextName: string, nextLat: string, nextLng: string) {
    setName(nextName); setLatitude(nextLat); setLongitude(nextLng);
    const parsed = postLocationSchema.safeParse({ name: nextName, latitude: Number(nextLat), longitude: Number(nextLng) });
    onChange(nextLat.trim() && nextLng.trim() && parsed.success ? parsed.data : undefined);
  }
  const inputStyle = { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.ink };
  return <View style={{ gap: spacing.sm }}>
    <Text style={{ color: colors.muted, fontSize: 13 }}>本機測試可手動填地點，無須搜尋服務或定位。</Text>
    <PrimaryButton secondary onPress={() => change('政大正門（測試取餐點）', '24.987', '121.576')}>使用政大正門測試地點</PrimaryButton>
    <TextInput accessibilityLabel="取餐地點名稱" placeholder="取餐地點名稱" value={name} onChangeText={(text) => change(text, latitude, longitude)} maxLength={100} style={inputStyle} />
    <TextInput accessibilityLabel="緯度" placeholder="緯度，例如 24.987" value={latitude} onChangeText={(text) => change(name, text, longitude)} keyboardType="numbers-and-punctuation" style={inputStyle} />
    <TextInput accessibilityLabel="經度" placeholder="經度，例如 121.576" value={longitude} onChangeText={(text) => change(name, latitude, text)} keyboardType="numbers-and-punctuation" style={inputStyle} />
  </View>;
}
