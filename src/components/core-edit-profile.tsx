import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { Avatar, DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreApi, coreError, type CoreUser } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { applyProfileUpdate, useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, yellowSurface } from '@/theme/tokens';
import { pickPersonalImage } from '@/lib/pick-personal-image';
import type { PickedPostImage } from '@/lib/pick-post-images';
import { profileSocial } from '@/lib/profile-social';
import { newRequestKey } from '@/lib/core-api';
import { queryClient } from '@/lib/query-client';
import { PROFILE_AVATARS } from '@/lib/profile-avatars';
import { Image } from 'expo-image';

export function CoreEditProfileScreen({ onboarding }: { onboarding?: boolean } = {}) {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  return (
    <ProfileForm
      key={user.id}
      user={user}
      onboarding={onboarding ?? !!user.profile_setup_required}
    />
  );
}

function ProfileForm({ user, onboarding }: { user: CoreUser; onboarding: boolean }) {
  const [name, setName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [badge, setBadge] = useState<NonNullable<CoreUser['badge']>>(user.badge ?? '🍱');
  const [version, setVersion] = useState(user.version ?? 1);
  const [photo, setPhoto] = useState<PickedPostImage | null>(null);
  const [useIllustration, setUseIllustration] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [picking, setPicking] = useState(false);
  const avatarDraft = useRef<{ key: string; id?: string }>({ key: newRequestKey() });
  async function pick(camera: boolean) {
    setPhotoError('');
    setPicking(true);
    try {
      const selected = await pickPersonalImage(camera);
      if (selected) {
        setPhoto(selected);
        setUseIllustration(false);
        avatarDraft.current = { key: newRequestKey() };
      }
    } catch (error) {
      setPhotoError(coreError(error));
    } finally {
      setPicking(false);
    }
  }
  const mutation = useMutation({
    mutationFn: async () => {
      if (photo?.base64 && !avatarDraft.current.id)
        avatarDraft.current.id = (
          await profileSocial.upload('avatar', photo.base64, avatarDraft.current.key)
        ).id;
      if (useAuthStore.getState().user?.id !== user.id)
        throw new Error('invalid_or_expired_session');
      return coreApi.updateProfile({
        ...(photo && avatarDraft.current.id ? { avatar_id: avatarDraft.current.id } : useIllustration ? { avatar_id: null } : {}),
        display_name: name.trim(),
        bio: bio.trim(),
        badge,
        expected_version: version,
      });
    },
    onSuccess: async (updated) => {
      if (!applyProfileUpdate(updated)) return;
      if (photo || useIllustration)
        void queryClient.invalidateQueries({ queryKey: ['core', user.id, 'avatar', user.id] });
      await invalidateCore();
      if (useAuthStore.getState().user?.id === updated.id) {
        if (onboarding) router.replace('/');
        else if (router.canGoBack()) router.back();
        else router.replace('/profile');
      }
    },
  });
  const reload = useMutation({
    mutationFn: coreApi.me,
    onSuccess: (updated) => {
      if (!applyProfileUpdate(updated)) return;
      setName(updated.display_name);
      setBio(updated.bio ?? '');
      setBadge(updated.badge ?? '🍱');
      setVersion(updated.version ?? 1);
      setPhoto(null);
      setUseIllustration(false);
      avatarDraft.current = { key: newRequestKey() };
      mutation.reset();
    },
  });
  const busy = mutation.isPending || reload.isPending || picking;
  return (
    <Screen>
      {onboarding ? (
        <Text style={[styles.label, { padding: spacing.lg }]}>歡迎加入！先完成個人資料</Text>
      ) : (
        <DetailHeader title="編輯個人資料" />
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.preview}>
          <Avatar
            name={name || user.display_name}
            badge={badge}
            userId={user.id}
            uri={photo?.uri}
            skipAccountPhoto={useIllustration}
            size={88}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <PrimaryButton
              secondary
              disabled={busy}
              onPress={() => {
                void pick(true);
              }}
            >
              拍照
            </PrimaryButton>
            <PrimaryButton
              secondary
              disabled={busy}
              onPress={() => {
                void pick(false);
              }}
            >
              上傳照片
            </PrimaryButton>
          </View>
          {photoError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {photoError}
            </Text>
          ) : null}
        </View>
        <Text style={styles.hint}>顯示名稱、頭像與介紹會出現在公開個人資料；信箱不會公開。</Text>
        <Text style={styles.label}>頭像</Text>
        <View style={styles.badges}>
          {PROFILE_AVATARS.map((item) => (
            <Pressable
              key={item.badge}
              accessibilityRole="radio"
              accessibilityLabel={`頭像 ${item.label}`}
              accessibilityState={{ checked: item.badge === badge && !photo && (useIllustration || !user.avatar_id) }}
              disabled={busy}
              onPress={() => { setBadge(item.badge); setPhoto(null); setUseIllustration(true); }}
              style={[styles.badge, item.badge === badge && !photo && (useIllustration || !user.avatar_id) && styles.selected]}
            >
              <View style={styles.badgeImageWrap}>
                <Image source={item.image} contentFit="cover" style={{ width: 84, height: 84 }} />
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>顯示名稱</Text>
        <TextInput
          accessibilityLabel="顯示名稱"
          value={name}
          onChangeText={setName}
          maxLength={40}
          editable={!busy}
          style={styles.input}
        />
        <Text style={styles.label}>公開個人介紹</Text>
        <TextInput
          accessibilityLabel="個人介紹"
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          editable={!busy}
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        />
        {mutation.error || reload.error ? (
          <View>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(mutation.error ?? reload.error)}
            </Text>
            <PrimaryButton secondary disabled={busy} onPress={() => reload.mutate()}>
              重新載入已儲存資料
            </PrimaryButton>
          </View>
        ) : null}
        <PrimaryButton
          disabled={busy || !name.trim()}
          onPress={() => mutation.mutate()}
          loading={busy}
        >
          {busy ? '處理中' : onboarding ? '儲存並進入 App' : '儲存變更'}
        </PrimaryButton>
        {onboarding ? (
          <PrimaryButton
            secondary
            disabled={busy}
            onPress={() => {
              void useAuthStore.getState().logout();
            }}
          >
            登出
          </PrimaryButton>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  preview: { alignItems: 'center', padding: spacing.md },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  input: {
    minHeight: 46,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.ink,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: 92,
    height: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 46,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  selected: { ...yellowSurface, backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  error: { color: colors.danger, fontSize: 14 },
});
