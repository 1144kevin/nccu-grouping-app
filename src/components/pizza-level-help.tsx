import { Image } from 'expo-image';
import { levelLabel } from '@/lib/level-label';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PizzaLevelIcon, pizzaLevels } from '@/components/pizza-level-icon';
import { PrimaryButton } from '@/components/primitives';
import { colors, radius, typography } from '@/theme/tokens';

export function PizzaLevelHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.help}>
          <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
            <Text style={styles.heading}>把披薩大拼起來</Text>
            <Text style={styles.body}>
              全員確認完成後，主揪 +5 分、團員 +3 分；每收到 10 個讚再 +1 分，上限 100
              分。尚未完成、取消與示範拼單不計分。
            </Text>
            <Text style={styles.body}>熟度反映已確認的參與紀錄，不是付款保證。</Text>
            <View style={styles.list}>
              {pizzaLevels.map((item) => (
                <View key={item.level} style={[styles.card, { backgroundColor: item.background }]}>
                  {item.level === 5 ? (
                    <Image
                      source={require('../../assets/images/pizza/crown.svg')}
                      contentFit="contain"
                      style={styles.crown}
                    />
                  ) : null}
                  <PizzaLevelIcon level={item.level} size={64} />
                  <View style={styles.text}>
                    <View style={styles.cardHeading}>
                      <View style={[styles.pill, { backgroundColor: item.pillBackground }]}>
                        <Text style={[styles.pillText, { color: item.pillText }]}>
                          {levelLabel(item.level)}
                        </Text>
                      </View>
                      <Text style={styles.title}>{item.title}</Text>
                    </View>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <PrimaryButton onPress={onClose}>知道了</PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000055',
    padding: 24,
  },
  help: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 20,
    gap: 14,
  },
  scroll: { flexShrink: 1 },
  content: { gap: 14 },
  heading: { color: colors.ink, fontFamily: typography.rounded, fontSize: 22, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { gap: 8, paddingRight: 5 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  crown: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 30,
    height: 24,
    transform: [{ rotate: '45deg' }],
  },
  text: { flex: 1, gap: 4 },
  cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '700' },
  title: { color: '#1F2328', fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  description: { color: '#5B6470', fontSize: 13, lineHeight: 19 },
});
