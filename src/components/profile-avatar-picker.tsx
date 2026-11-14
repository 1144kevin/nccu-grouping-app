import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PROFILE_AVATARS, PROFILE_AVATAR_GROUPS } from '@/lib/profile-avatars';
import { colors } from '@/theme/tokens';

export function ProfileAvatarPicker({ value, onChange, disabled = false }: { value: string | null; onChange: (value: string) => void; disabled?: boolean }) {
  return <View style={styles.groups}>
    {PROFILE_AVATAR_GROUPS.map(group => <View key={group} style={styles.row}>
      <Text style={styles.group}>{group}</Text>
      <ScrollView horizontal style={styles.scroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {PROFILE_AVATARS.filter(item => item.group === group).map(item => <Pressable
          key={item.badge} accessibilityRole="radio" accessibilityLabel={`頭像 ${item.label}`}
          accessibilityState={{ checked: value === item.badge }} disabled={disabled}
          onPress={() => onChange(item.badge)} style={styles.option}>
          <View style={[styles.circle, value === item.badge && styles.selected]}>
            <Image source={item.image} contentFit="contain" style={styles.image} />
          </View>
          <Text style={styles.caption}>{item.label}</Text>
        </Pressable>)}
      </ScrollView>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  groups: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { width: 72, color: colors.ink, fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  options: { gap: 8, paddingRight: 8 },
  option: { width: 69, alignItems: 'center', gap: 4 },
  circle: { width: 69, height: 69, borderRadius: 35, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F0', borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: colors.yellow },
  image: { width: 63, height: 63 },
  caption: { color: colors.ink, fontSize: 11, textAlign: 'center' },
});
