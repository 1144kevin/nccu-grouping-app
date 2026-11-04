import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PizzaLevelIcon, pizzaLevels } from '@/components/pizza-level-icon';
import { colors, typography } from '@/theme/tokens';

export function PizzaLevelList() {
  return (
    <View style={styles.list}>
      {pizzaLevels.map((item) => (
        <View key={item.level} style={styles.item}>
          <View>
            <PizzaLevelIcon level={item.level} size={48} />
            {item.level === 5 ? (
              <Image
                source={require('../../assets/images/pizza/crown.svg')}
                contentFit="contain"
                style={styles.crown}
              />
            ) : null}
          </View>
          <View style={[styles.pill, { backgroundColor: item.pillBackground }]}>
            <Text style={[styles.pillText, { color: item.pillText }]}>
              Lv.{item.level}
            </Text>
          </View>
          <Text style={styles.title}>{item.title}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 15, flexDirection: 'row', gap: 4 },
  item: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  crown: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  pill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '700' },
  title: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
