import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BurgerLevelIcon, type BurgerLevel } from '@/components/burger-level-icon';

const ShowerContext = createContext<() => void>(() => undefined);
type Particle = {
  id: number;
  progress: Animated.Value;
  x: number;
  y: number;
  spin: number;
  level: BurgerLevel;
};

export function BurgerShowerProvider({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const emitter = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animations = useRef(new Set<Animated.CompositeAnimation>());
  const mounted = useRef(true);
  const nextId = useRef(0);
  const taps = useRef({ count: 0, time: 0 });
  useEffect(() => {
    const running = animations.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (emitter.current) clearInterval(emitter.current);
      if (stopAt.current) clearTimeout(stopAt.current);
      running.forEach((animation) => animation.stop());
    };
  }, []);
  const trigger = useCallback(() => {
    if (emitter.current) return;
    const emit = () => {
      const batch = Array.from({ length: 3 }, (): Particle => ({
        id: nextId.current++,
        progress: new Animated.Value(0),
        x: (Math.random() - 0.5) * Math.min(width * 1.5, 900),
        y: height * (0.55 + Math.random() * 0.5),
        spin: (Math.random() - 0.5) * 600,
        level: (1 + Math.floor(Math.random() * 5)) as BurgerLevel,
      }));
      setParticles((old) => [...old, ...batch]);
      batch.forEach((particle) => {
        const animation = Animated.timing(particle.progress, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        animations.current.add(animation);
        animation.start(() => {
          animations.current.delete(animation);
          if (mounted.current) setParticles((old) => old.filter((item) => item.id !== particle.id));
        });
      });
    };
    emit();
    emitter.current = setInterval(emit, 180);
    stopAt.current = setTimeout(() => {
      if (emitter.current) clearInterval(emitter.current);
      emitter.current = null;
      animations.current.forEach((animation) => animation.stop());
      animations.current.clear();
      setParticles([]);
    }, 5000);
  }, [height, width]);
  const onLogoPress = useCallback(() => {
    const now = Date.now();
    taps.current.count = now - taps.current.time < 1000 ? taps.current.count + 1 : 1;
    taps.current.time = now;
    if (taps.current.count >= 10) {
      taps.current.count = 0;
      trigger();
    }
  }, [trigger]);
  return (
    <ShowerContext.Provider value={onLogoPress}>
      {children}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}
      >
        {particles.map((particle) => (
          <Animated.View
            pointerEvents="none"
            key={particle.id}
            testID="burger-confetti"
            style={{
              position: 'absolute',
              top: 45,
              left: width / 2 - 20,
              opacity: particle.progress.interpolate({
                inputRange: [0, 0.75, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateX: particle.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.x],
                  }),
                },
                {
                  translateY: particle.progress.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, -35, particle.y],
                  }),
                },
                {
                  rotate: particle.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${particle.spin}deg`],
                  }),
                },
              ],
            }}
          >
            <BurgerLevelIcon level={particle.level} size={40} />
          </Animated.View>
        ))}
      </View>
    </ShowerContext.Provider>
  );
}

export function useBurgerLogoPress() {
  return useContext(ShowerContext);
}
