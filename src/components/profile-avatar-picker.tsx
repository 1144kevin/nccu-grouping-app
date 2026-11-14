import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FRUIT_AVATARS, ORANGE_AVATARS, PROFILE_AVATARS } from '@/lib/profile-avatars';
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
        { key: 'campus', items: PROFILE_AVATARS },
        { key: 'fruit', items: FRUIT_AVATARS },
        { key: 'orange', items: ORANGE_AVATARS },
      ].map((group) => (
        <View key={group.key}>
          <ScrollView
            horizontal
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
