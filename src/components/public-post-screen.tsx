import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/app-text';
import { Avatar, PrimaryButton, Screen } from '@/components/primitives';
import { BrandLogo } from '@/components/brand-logo';
import { PageLoading } from '@/components/page-loading';
import { PhotoCarousel } from '@/components/post-photo-carousel';
import { ReputationBadge } from '@/components/reputation-badge';
import { postSharingApi, sharedImageURL, SHARE_TOKEN } from '@/lib/post-sharing';
import { rememberSharedPost } from '@/lib/post-login-return';
import { useAuthStore } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export function PublicPostScreen({ token }: { token: string }) {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const post = useQuery({
    queryKey: ['public-post', token],
    queryFn: () => postSharingApi.read(token),
    enabled: SHARE_TOKEN.test(token),
    retry: false,
    staleTime: 0,
  });
  const data = post.data;
  useEffect(() => {
    if (user?.profile_setup_required && data) rememberSharedPost(data.id);
  }, [user?.profile_setup_required, data]);
  const signIn = () => {
    if (data) rememberSharedPost(data.id);
    router.push('/sign-in');
  };
  if (user && data)
    return <Redirect href={user.profile_setup_required ? '/edit-profile' : `/order/${data.id}`} />;
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="註冊或登入政缺一咖"
          onPress={signIn}
        >
          <BrandLogo size={32} />
        </Pressable>
        <Text style={styles.heading}>政缺一咖</Text>
        <Pressable accessibilityRole="button" onPress={signIn}>
          <Text style={styles.login}>登入</Text>
        </Pressable>
      </View>
      {!SHARE_TOKEN.test(token) || post.error ? (
        <View style={styles.content}>
          <Text style={styles.heading}>這篇貼文目前無法查看</Text>
          <Text style={styles.hint}>連結可能已失效，或拼單已取消。</Text>
        </View>
      ) : !data ? (
        <PageLoading accessibilityLabel="正在載入分享貼文" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看 ${data.author_name} 的公開資料`}
            onPress={signIn}
            style={styles.author}
          >
            <Avatar name={data.author_name} badge={data.author_badge} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{data.author_name}</Text>
              <Text style={styles.hint}>
                {new Date(data.created_at).toLocaleDateString('zh-TW')}
              </Text>
            </View>
            <ReputationBadge level={data.author_level} />
          </Pressable>
          <Text style={styles.body}>{data.content}</Text>
          <PhotoCarousel
            photos={data.images.map((image) => ({
              ...image,
              uri: sharedImageURL(token, image.id),
            }))}
            onPhotoPress={signIn}
          />
          <View style={styles.tags}>
            {data.tags.map((tag) => (
              <Pressable key={tag} accessibilityRole="button" onPress={signIn}>
                <Text style={styles.tag}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.info}>
            <Text style={styles.body}>取餐地點：{data.location_name}</Text>
            <Text style={styles.body}>
              每人金額：{data.price_per_person === null ? '待協調' : `NT$ ${data.price_per_person}`}
            </Text>
            <Text style={styles.body}>
              截止時間：{new Date(data.deadline_at).toLocaleString('zh-TW')}
            </Text>
            <Text style={styles.body}>
              {data.joined} / {data.capacity} 人 ·{' '}
              {data.status === 'expired' ? '已截止' : data.status === 'full' ? '已額滿' : '進行中'}
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <PrimaryButton onPress={signIn}>想被揪</PrimaryButton>
            <PrimaryButton secondary onPress={signIn}>
              私訊主揪
            </PrimaryButton>
            <PrimaryButton secondary onPress={signIn}>
              分享貼文
            </PrimaryButton>
          </View>
        </ScrollView>
      )}
      <View style={[styles.prompt, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Text style={styles.name}>想一起拼單？</Text>
        <Text style={styles.hint}>註冊或登入，就能加入拼單、私訊主揪。</Text>
        <PrimaryButton onPress={signIn}>註冊／登入</PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heading: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.ink },
  login: { color: colors.brown, fontWeight: '700', padding: 8 },
  content: { padding: spacing.lg, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 20, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { color: colors.brown, fontSize: 15, fontWeight: '600' },
  info: { paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  prompt: {
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
