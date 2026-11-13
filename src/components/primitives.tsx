import { AppText as Text } from '@/components/app-text';
import { BrandLogo } from '@/components/brand-logo';
import { PageLoading } from '@/components/page-loading';
import { useNavigationStore } from '@/store/navigation-store';
import { colors, radius, spacing, typography, yellowSurface, neutralSurface } from '@/theme/tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import {
  useEffect,
  useState,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePizzaLogoPress } from '@/components/pizza-shower';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useAuthStore } from '@/store/auth-store';
import { CORE_SUPABASE_MODE } from '@/lib/core-api';
import { profileSocial } from '@/lib/profile-social';
import { useNotificationBadge } from '@/lib/notification-badge';
import { profileAvatarImage } from '@/lib/profile-avatars';

function isIOSStandaloneWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone =
    nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
  if (!standalone) return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function Screen({
  children,
  scroll = false,
  style,
  pinKeyboardHeader = false,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; pinKeyboardHeader?: boolean }>) {
  const [viewportBox, setViewportBox] = useState<{ height: number; offsetTop: number }>();
  const [iosStandaloneTopPad, setIosStandaloneTopPad] = useState(false);
  useEffect(() => {
    if (isIOSStandaloneWeb()) setIosStandaloneTopPad(true);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || !pinKeyboardHeader || typeof window === 'undefined' || !window.visualViewport) return;
    const current = window.visualViewport;
    const update = () => {
      if (typeof window.scrollTo === 'function' && window.scrollY) {
        window.scrollTo(0, 0);
      }
      setViewportBox({
        height: current.height,
        offsetTop: Math.max(0, current.offsetTop ?? 0),
      });
    };
    update();
    current.addEventListener('resize', update);
    current.addEventListener?.('scroll', update);
    window.addEventListener?.('scroll', update);
    return () => {
      current.removeEventListener('resize', update);
      current.removeEventListener?.('scroll', update);
      window.removeEventListener?.('scroll', update);
    };
  }, [pinKeyboardHeader]);
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, style]}>{children}</View>
  );
  return (
    <SafeAreaView
      testID={pinKeyboardHeader ? 'fixed-chat-screen' : undefined}
      edges={['top']}
      style={[
        styles.safe,
        pinKeyboardHeader &&
          Platform.OS === 'web' &&
          ({
            position: 'fixed',
            top: viewportBox?.offsetTop ?? 0,
            height: viewportBox?.height ?? '100dvh',
            left: 0,
            right: 0,
            marginHorizontal: 'auto',
            backgroundColor: colors.background,
            overflow: 'hidden',
          } as unknown as ViewStyle),
      ]}
    >
      {iosStandaloneTopPad ? <View style={styles.iosStandaloneSpacer} /> : null}
      {content}
    </SafeAreaView>
  );
}

export function AppHeader({
  title,
  searchScope = 'all',
}: {
  title?: string;
  searchScope?: 'all' | 'posts' | 'orders' | 'messages' | 'history';
}) {
  const openDrawer = useNavigationStore((state) => state.openDrawer);
  const onLogoPress = usePizzaLogoPress();
  const notifications = useNotificationBadge();
  return (
    <View style={styles.header}>
      <View>
        <IconButton
          icon="menu"
          label={notifications.count ? `開啟選單，${notifications.count} 則未讀通知` : '開啟選單'}
          onPress={openDrawer}
        />
        {notifications.count > 0 ? (
          <View pointerEvents="none" style={styles.menuNotificationDot} />
        ) : null}
      </View>
      {title ? (
        <Text style={styles.headerTitle}>{title}</Text>
      ) : (
        <Link href="/" asChild>
          <Pressable
            accessibilityLabel="返回首頁"
            onPress={onLogoPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <BrandLogo size={30} />
          </Pressable>
        </Link>
      )}
      <IconButton
        icon="magnify"
        label="搜尋"
        onPress={() => router.push({ pathname: '/search', params: { scope: searchScope } })}
      />
    </View>
  );
}

export function DetailHeader({
  title,
  right,
  sideWidth = 40,
}: {
  title: string;
  right?: ReactNode;
  sideWidth?: number;
}) {
  return (
    <View style={styles.header}>
      <View style={{ width: sideWidth }}>
        <IconButton
          icon="chevron-left"
          label="返回"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
      </View>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={[styles.headerRight, { width: sideWidth }]}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = colors.ink,
  disabled = false,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={disabled ? colors.subtle : color} />
    </Pressable>
  );
}

type AvatarProps = {
  name: string;
  badge: string;
  size?: number;
  userId?: string;
  uri?: string;
  onPress?: () => void;
  square?: boolean;
  skipAccountPhoto?: boolean;
};
export function Avatar(props: AvatarProps) {
  return props.userId &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(props.userId) &&
    CORE_SUPABASE_MODE &&
    !props.uri && !props.skipAccountPhoto ? (
    <AccountAvatar {...props} />
  ) : (
    <AvatarBody {...props} />
  );
}
function AccountAvatar(props: AvatarProps) {
  const actor = useAuthStore((state) => state.user?.id);
  const photo = useQuery({
    queryKey: ['core', actor, 'avatar', props.userId],
    queryFn: () => profileSocial.avatar(props.userId!),
    enabled: !!actor,
    staleTime: 300_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
  return (
    <AvatarBody
      {...props}
      uri={photo.data ? `data:image/jpeg;base64,${photo.data.content_base64}` : undefined}
    />
  );
}
function AvatarBody({ name, badge, size = 48, uri: source, onPress, square = false }: AvatarProps) {
  const preset = profileAvatarImage(badge);
  const palette = ['#CDE2EA', '#E8E1B4', '#E7CDC3', '#D2DDC9'];
  const index =
    [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length;
  const avatar = (
    <View
      accessibilityLabel={`${name} 的頭像`}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: square ? 0 : size / 2,
          backgroundColor: !source && preset ? colors.surface : palette[index],
          overflow: 'hidden',
        },
      ]}
    >
      {source ? (
        <Image source={{ uri: source }} contentFit="cover" style={{ width: size, height: size }} />
      ) : preset ? (
        <Image source={preset} contentFit="cover" style={{ width: size, height: size }} />
      ) : (
        <Text fixedSize style={{ fontSize: size * 0.44 }}>
          {badge}
        </Text>
      )}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看 ${name} 的個人資料`}
      onPress={onPress}
    >
      {avatar}
    </Pressable>
  ) : (
    avatar
  );
}

export function Pill({
  icon,
  children,
  tone = 'plain',
}: PropsWithChildren<{
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  tone?: 'plain' | 'yellow' | 'danger' | 'success';
}>) {
  const toneStyle =
    tone === 'yellow'
      ? styles.pillYellow
      : tone === 'danger'
        ? styles.pillDanger
        : tone === 'success'
          ? styles.pillSuccess
          : undefined;
  return (
    <View style={[styles.pill, toneStyle]}>
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={13}
          color={tone === 'plain' ? colors.yellow : colors.ink}
        />
      )}
      <Text style={[styles.pillText, tone === 'success' && { color: colors.success }]}>
        {children}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  secondary = false,
  loading = false,
  style,
  textColor,
  accessibilityLabel,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textColor?: string;
  accessibilityLabel?: string;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        !secondary && yellowSurface,
        secondary && styles.secondaryButton,
        (disabled || loading) && styles.disabledButton,
        style,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {loading ? (
          <ActivityIndicator
            accessible
            size="small"
            color={textColor ?? colors.muted}
            accessibilityLabel="正在處理"
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
          />
        ) : null}
        <Text
          style={[
            styles.primaryButtonText,
            { color: secondary ? colors.ink : colors.onYellow },
            (disabled || loading) && { color: colors.muted },
            textColor ? { color: textColor } : undefined,
          ]}
        >
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  icon,
  iconNode,
  title,
  action,
  loading = false,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconNode?: ReactNode;
  title: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  if (loading) return <PageLoading accessibilityLabel={title} />;
  return (
    <View style={styles.empty}>
      {iconNode ?? <MaterialCommunityIcons name={icon} size={38} color={colors.subtle} />}
      <Text style={styles.emptyText}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  menuNotificationDot: {
    position: 'absolute',
    top: 4,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2845',
  },
  safe: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  iosStandaloneSpacer: {
    height: 6,
    backgroundColor: colors.background,
  },
  screenContent: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  header: {
    height: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 2,
  },
  headerTitle: {
    fontFamily: typography.rounded,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: { width: 40, alignItems: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.5 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    minHeight: 30,
    paddingHorizontal: 11,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillYellow: { borderColor: colors.yellow, ...yellowSurface, backgroundColor: colors.yellowSoft },
  pillDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  pillSuccess: { borderColor: colors.success, backgroundColor: colors.successSoft },
  pillText: { fontFamily: typography.regular, fontSize: 14, color: colors.ink },
  primaryButton: {
    minHeight: 43,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
  },
  secondaryButton: { ...neutralSurface, backgroundColor: colors.surface },
  disabledButton: { ...neutralSurface, backgroundColor: colors.surface },
  primaryButtonText: {
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42 },
  sectionTitle: {
    flex: 1,
    fontFamily: typography.rounded,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  empty: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: typography.regular,
    fontSize: 16,
    textAlign: 'center',
  },
});
