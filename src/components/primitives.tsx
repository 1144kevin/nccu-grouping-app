import { AppText as Text } from '@/components/app-text';
import { BrandLogo } from '@/components/brand-logo';
import { PageLoading } from '@/components/page-loading';
import { useNavigationStore } from '@/store/navigation-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  children,
  scroll = false,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
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
    <SafeAreaView edges={['top']} style={styles.safe}>
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
  return (
    <View style={styles.header}>
      <IconButton icon="menu" label="開啟選單" onPress={openDrawer} />
      {title ? (
        <Text style={styles.headerTitle}>{title}</Text>
      ) : (
        <Link href="/" asChild>
          <Pressable
            accessibilityLabel="返回首頁"
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

export function Avatar({ name, badge, size = 48 }: { name: string; badge: string; size?: number }) {
  const palette = ['#CDE2EA', '#E8E1B4', '#E7CDC3', '#D2DDC9'];
  const index =
    [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length;
  return (
    <View
      accessibilityLabel={`${name} 的頭像`}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette[index] },
      ]}
    >
      <Text fixedSize style={{ fontSize: size * 0.44 }}>
        {badge}
      </Text>
    </View>
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
      <Text style={styles.pillText}>{children}</Text>
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
        <Text style={[styles.primaryButtonText, textColor ? { color: textColor } : undefined]}>
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
  title,
  action,
  loading = false,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  if (loading) return <PageLoading accessibilityLabel={title} />;
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={38} color={colors.subtle} />
      <Text style={styles.emptyText}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  screenContent: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  header: {
    height: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  pillYellow: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  pillDanger: { borderColor: '#F2C9C9', backgroundColor: '#FFF0F0' },
  pillSuccess: { borderColor: '#BFDDCA', backgroundColor: '#EDF8F1' },
  pillText: { fontFamily: typography.regular, fontSize: 14, color: colors.ink },
  primaryButton: {
    minHeight: 43,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
  },
  secondaryButton: { backgroundColor: colors.surface },
  disabledButton: { backgroundColor: '#E5E5E3' },
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
