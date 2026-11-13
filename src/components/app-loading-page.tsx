import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PizzaLevelIcon, type PizzaLevel } from '@/components/pizza-level-icon';
import { AppText as Text } from '@/components/app-text';
import { colors } from '@/theme/tokens';

const BAR_WIDTH = 240;
const ICON_SIZE = 44;
const TRAVEL_WIDTH = BAR_WIDTH - ICON_SIZE;

export function AppLoadingPage({
  ready = false,
  onComplete,
  accessibilityLabel = '正在確認登入',
}: {
  ready?: boolean;
  onComplete?: () => void;
  accessibilityLabel?: string;
}) {
  const [progress, setProgress] = useState(0.06);
  const progressAnim = useRef(new Animated.Value(0.06)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

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

    const listener = progressAnim.addListener(({ value }) => {
      setProgress(value);
    });

    const initialTween = !ready
      ? Animated.timing(progressAnim, {
          toValue: 0.85,
          duration: 2200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      : null;
    initialTween?.start();

    return () => {
      spinLoop.stop();
      initialTween?.stop();
      progressAnim.removeListener(listener);
    };
  }, [progressAnim, spinAnim]);

  useEffect(() => {
    if (!ready || completedRef.current) return;
    let cancelled = false;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTween: Animated.CompositeAnimation | undefined;
    progressAnim.stopAnimation((current) => {
      if (cancelled || completedRef.current) return;
      const remaining = Math.max(0, 1 - current);
      const duration = Math.max(220, Math.round(remaining * 450));
      finishTween = Animated.timing(progressAnim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      finishTween.start(({ finished }) => {
        if (!finished || cancelled || completedRef.current) return;
        completedRef.current = true;
        doneTimer = setTimeout(() => {
          if (!cancelled) onCompleteRef.current?.();
        }, 60);
      });
    });
    return () => {
      cancelled = true;
      finishTween?.stop();
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [progressAnim, ready]);

  // PizzaLevel 1..5 corresponds to UI Lv.0..Lv.4, so Lv.1..Lv.3 are levels 2, 3, 4.
  const level: PizzaLevel = progress < 0.34 ? 2 : progress < 0.68 ? 3 : 4;
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
