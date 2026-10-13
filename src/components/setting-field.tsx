import type { ComponentProps, PropsWithChildren } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export function SettingField({ icon, title, children }: PropsWithChildren<{ icon: ComponentProps<typeof MaterialCommunityIcons>['name']; title: string }>) {
  return <View style={styles.row}><View style={styles.icon}><MaterialCommunityIcons name={icon} size={19} color={colors.brown} /></View><View style={styles.body}><Text style={styles.label}>{title}</Text>{children}</View></View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.yellowSoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: spacing.sm },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
});
