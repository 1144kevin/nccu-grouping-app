import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FRUIT_AVATARS, ORANGE_AVATARS, PROFILE_AVATARS } from '@/lib/profile-avatars';
import { AppText as Text } from './app-text';
import { colors, spacing } from '@/theme/tokens';

export function ProfileAvatarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      {[
        { label: '校園頭像', items: PROFILE_AVATARS },
        { label: '水果人', items: FRUIT_AVATARS },
        { label: '橘子寶寶', items: ORANGE_AVATARS },
      ].map((group) => (
        <View key={group.label} style={{ gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{group.label}</Text>
          <ScrollView
            horizontal
            accessibilityLabel={group.label}
            style={styles.scroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.options}
          >
            {group.items.map((item) => (
              <Pressable
                key={item.badge}
                accessibilityRole="radio"
                accessibilityLabel={`頭像 ${item.label}`}
                accessibilityState={{ checked: value === item.badge }}
                disabled={disabled}
                onPress={() => onChange(item.badge)}
                style={styles.option}
              >
                <View style={[styles.circle, value === item.badge && styles.selected]}>
                  <Image
                    source={item.image}
                    contentFit={item.badge.startsWith('fruit-') ? 'cover' : 'contain'}
                    style={styles.image}
                  />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -spacing.lg,
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  option: {
    width: 69,
    alignItems: 'center',
  },
  circle: {
    width: 69,
    height: 69,
    borderRadius: 35,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: colors.yellow,
  },
  image: {
    width: 63,
    height: 63,
  },
});
