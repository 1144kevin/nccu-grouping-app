import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { defaultStealthPreferences, stealthTones } from '@/lib/stealth-preferences';
import { useStealthPreferencesStore } from '@/store/stealth-preferences-store';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export default function StealthPreferencesScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  return <PreferencesForm key={actor} actor={actor} />;
}

function PreferencesForm({ actor }: { actor?: string }) {
  const initial =
    useStealthPreferencesStore.getState().accounts[actor ?? ''] ?? defaultStealthPreferences;
  const [tone, setTone] = useState(initial.tone);
  const [context, setContext] = useState(initial.context);
  return (
    <Screen>
      <DetailHeader title="分身偏好" />
      <KeyboardScrollView contentContainerStyle={styles.page}>
        <View style={styles.section}>
          <Text style={styles.label}>希望怎麼跟你聊？</Text>
          <View style={styles.tones}>
            {stealthTones.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ checked: tone === item.value }}
                onPress={() => setTone(item.value)}
                style={[styles.tone, tone === item.value && styles.selected]}
              >
                <Text style={styles.toneText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>讓分身多認識你一點</Text>
          <TextInput
            accessibilityLabel="平常的偏好"
            multiline
            maxLength={500}
            value={context}
            onChangeText={setContext}
            placeholder="例如：平常喝無糖、預算約 100 元、常在東側門，不太方便出門取餐。"
            style={styles.input}
          />
          <Text style={styles.hint}>
            沒說清楚時，用來提供建議；這次需求仍以聊天與最後確認為準。
          </Text>
        </View>
        <PrimaryButton
          disabled={!actor}
          onPress={() => {
            if (!actor || useAuthStore.getState().user?.id !== actor) return;
            useStealthPreferencesStore.getState().save(actor, { tone, context: context.trim() });
            if (router.canGoBack()) router.back();
            else router.replace('/stealth');
          }}
        >
          儲存偏好
        </PrimaryButton>
        <Text style={styles.storage}>只儲存在這個瀏覽器／裝置，依帳號分開。</Text>
      </KeyboardScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, gap: 28 },
  section: { gap: 14 },
  label: { fontSize: 17, lineHeight: 26, fontWeight: '600', color: colors.ink },
  tones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tone: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  selected: { borderColor: colors.ink, backgroundColor: colors.background },
  toneText: { fontSize: 14, color: colors.ink },
  input: {
    minHeight: 150,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    lineHeight: 25,
    color: colors.ink,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 13, lineHeight: 22, color: colors.muted },
  storage: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
