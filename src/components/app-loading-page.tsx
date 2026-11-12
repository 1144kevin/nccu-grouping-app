import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PizzaLevelIcon, type PizzaLevel } from '@/components/pizza-level-icon';
import { AppText as Text } from '@/components/app-text';
import { colors } from '@/theme/tokens';

const BAR_WIDTH = 240;
const ICON_SIZE = 44;
const TRAVEL_WIDTH = BAR_WIDTH - ICON_SIZE;

export function AppLoadingPage({ accessibilityLabel = '正在確認登入' }: { accessibilityLabel?: string }) {
  const [progress, setProgress] = useState(0.06);
  const progressAnim = useRef(new Animated.Value(0.06)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    spinLoop.start();

    const progressTween = Animated.timing(progressAnim, {
      toValue: 0.94,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    const listener = progressAnim.addListener(({ value }) => {
      setProgress(value);
    });
    progressTween.start();

    return () => {
      spinLoop.stop();
      progressTween.stop();
      progressAnim.removeListener(listener);
    };
  }, [progressAnim, spinAnim]);

  const level: PizzaLevel = progress < 0.34 ? 1 : progress < 0.68 ? 2 : 3;
  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const translateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL_WIDTH],
  });
  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View style={styles.stage}>
        <View style={styles.pizzaTrack}>
          <Animated.View style={[styles.pizzaMover, { transform: [{ translateX }] }]}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <PizzaLevelIcon level={level} size={ICON_SIZE} />
            </Animated.View>
          </Animated.View>
        </View>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: fillWidth }]} />
        </View>
        <Text style={styles.label}>載入中...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stage: {
    width: BAR_WIDTH,
    alignItems: 'center',
    gap: 10,
  },
  pizzaTrack: {
    width: BAR_WIDTH,
    height: ICON_SIZE,
    justifyContent: 'center',
  },
  pizzaMover: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.yellow,
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
});
