import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { Avatar, DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { CoreEditProfileScreen } from '@/components/core-edit-profile';
import { colors, radius, spacing, typography, yellowSurface } from '@/theme/tokens';
import { PROFILE_AVATARS } from '@/lib/profile-avatars';
import { Image } from 'expo-image';


export default function EditProfileScreen() {
  return CORE_API_ENABLED ? <CoreEditProfileScreen /> : <DemoEditProfileScreen />;
}

function DemoEditProfileScreen() {
  const currentUser = useAppStore((state) => state.currentUser);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio);
  const [badge, setBadge] = useState(currentUser.badge);
  const valid = name.trim().length >= 2 && name.trim().length <= 24 && bio.trim().length <= 100;

  function save() {
    if (!valid) return;
    updateProfile({ name: name.trim(), bio: bio.trim(), badge });
    Alert.alert('已更新個人資料', '新的資料已套用到個人頁與選單。', [
      { text: '完成', onPress: () => router.back() },
    ]);
  }

  return (
    <Screen>
      <DetailHeader title="編輯個人資料" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.preview}>
          <Avatar name={name || currentUser.name} badge={badge} size={78} />
          <Text style={styles.previewName}>{name.trim() || '你的名稱'}</Text>
          <Text style={styles.previewBio}>{bio.trim() || '尚未填寫個人介紹'}</Text>
        </View>
        <Text style={styles.label}>頭像</Text>
        <View style={styles.badges}>
          {PROFILE_AVATARS.map((item) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`頭像 ${item.label}`}
              accessibilityState={{ checked: badge === item.badge }}
              key={item.badge}
              onPress={() => setBadge(item.badge)}
              style={[styles.badge, badge === item.badge && styles.badgeActive]}
            >
              <Image source={item.image} contentFit="cover" style={{ width: 42, height: 42, borderRadius: 21 }} />
              {badge === item.badge ? (
                <View style={styles.check}>
                  <MaterialCommunityIcons name="check" size={10} color={colors.ink} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>顯示名稱</Text>
        <TextInput
          maxLength={24}
          value={name}
          onChangeText={setName}
          placeholder="輸入顯示名稱"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
        <Text style={styles.counter}>{name.length}/24</Text>
        <Text style={styles.label}>個人介紹</Text>
        <TextInput
          multiline
          maxLength={100}
          value={bio}
          onChangeText={setBio}
          placeholder="簡單介紹你的拼單習慣"
          placeholderTextColor={colors.subtle}
          style={[styles.input, styles.bio]}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{bio.length}/100</Text>
        <PrimaryButton disabled={!valid} onPress={save}>
          儲存變更
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  preview: { alignItems: 'center', paddingVertical: spacing.lg },
  previewName: {
    marginTop: spacing.md,
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 18,
    fontWeight: '800',
  },
  previewBio: {
    maxWidth: 300,
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    backgroundColor: colors.surface,
  },
  badgeActive: { borderColor: colors.yellow, ...yellowSurface, backgroundColor: colors.yellowSoft },
  badgeText: { fontSize: 21 },
  check: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    ...yellowSurface,
    backgroundColor: colors.yellow,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  bio: { minHeight: 100, paddingTop: spacing.md },
  counter: { marginTop: 4, color: colors.subtle, fontSize: 12, textAlign: 'right' },
});
