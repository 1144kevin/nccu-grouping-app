import { AppText as Text } from '@/components/app-text';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo, Animated, Keyboard, PanResponder, Platform, Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, typography } from '@/theme/tokens';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabs: Record<string, { label: string; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }> = {
  index: { label: '首頁', icon: 'home' },
  orders: { label: '拼單', icon: 'format-list-bulleted' },
  create: { label: '發佈', icon: 'plus' },
  messages: { label: '訊息', icon: 'message' },
  profile: { label: '個人檔案', icon: 'account' },
};

function GlassSurface({ children, solid, style }: PropsWithChildren<{ solid: boolean; style?: ViewStyle }>) {
  if (!solid && isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" colorScheme="light" style={[styles.surface, style]}>{children}</GlassView>;
  }
  return <View style={[styles.surface, styles.fallback, Platform.OS === 'web' && !solid && styles.webGlass, solid && styles.solid, style]}>{children}</View>;
}

export function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const track = useRef<View>(null);
  const bounds = useRef({ left: 0, width: 0 });
  const [selectionX] = useState(() => new Animated.Value(0));
  const [dragProgress] = useState(() => new Animated.Value(0));
  const dragging = dragIndex !== null;
  const pointer = useRef({ id: -1, x: 0, y: 0, dragging: false });
  const suppressPress = useRef(false);
  const routes = useMemo(() => state.routes.filter((route) => tabs[route.name]), [state.routes]);
  const focusedIndex = routes.findIndex((route) => route.key === state.routes[state.index].key);
  const tabWidth = width / routes.length;

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'ios') AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (active) setReduceTransparency(value); });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { active = false; motion.remove(); transparency.remove(); show.remove(); hide.remove(); };
  }, []);

  const open = useCallback((route: typeof state.routes[number]) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.routes[state.index].key !== route.key && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  }, [navigation, state]);

  useEffect(() => {
    if (dragIndex !== null || !width) return;
    const target = Math.max(0, focusedIndex) * tabWidth;
    if (reduceMotion) { selectionX.setValue(target); return; }
    const animation = Animated.spring(selectionX, { toValue: target, damping: 24, stiffness: 280, mass: 0.8, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [dragIndex, focusedIndex, reduceMotion, selectionX, tabWidth, width]);

  useEffect(() => {
    const target = dragging ? 1 : 0;
    if (reduceMotion) { dragProgress.setValue(target); return; }
    const animation = Animated.spring(dragProgress, { toValue: target, damping: 19, stiffness: 320, mass: 0.65, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [dragging, dragProgress, reduceMotion]);

  const preview = useCallback((pageX: number) => {
      const size = bounds.current.width / routes.length;
      if (!size) return null;
      const x = Math.max(0, Math.min(bounds.current.width - 0.01, pageX - bounds.current.left));
      const index = Math.floor(x / size);
      selectionX.setValue(Math.max(0, Math.min(bounds.current.width - size, x - size / 2)));
      setDragIndex(index);
      return index;
  }, [routes.length, selectionX]);

  // PanResponder stores callbacks here; refs are read only when a gesture occurs.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: (_, gesture) => { selectionX.stopAnimation(); preview(gesture.moveX); },
      onPanResponderMove: (_, gesture) => { preview(gesture.moveX); },
      onPanResponderRelease: (_, gesture) => {
        const index = preview(gesture.moveX);
        setDragIndex(null);
        if (index !== null) open(routes[index]);
      },
      onPanResponderTerminate: () => setDragIndex(null),
      onPanResponderTerminationRequest: () => false,
    }), [open, preview, routes, selectionX]);

  const webPointer: Pick<ViewProps, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> = {
    onPointerDown: (event) => {
      const { pointerId, pageX, pageY, button } = event.nativeEvent;
      if (button !== 0 || pointer.current.id !== -1) return;
      suppressPress.current = false;
      pointer.current = { id: pointerId, x: pageX, y: pageY, dragging: false };
      track.current?.measureInWindow((left, _top, measuredWidth) => { bounds.current = { left, width: measuredWidth }; });
    },
    onPointerMove: (event) => {
      const { pointerId, pageX, pageY } = event.nativeEvent;
      const current = pointer.current;
      if (current.id !== pointerId) return;
      const dx = Math.abs(pageX - current.x);
      if (!current.dragging && dx > 6 && dx > Math.abs(pageY - current.y)) {
        current.dragging = true;
        suppressPress.current = true;
        selectionX.stopAnimation();
        (event.currentTarget as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture(pointerId);
      }
      if (current.dragging) { event.preventDefault(); preview(pageX); }
    },
    onPointerUp: (event) => {
      if (pointer.current.id !== event.nativeEvent.pointerId) return;
      if (pointer.current.dragging) {
        const index = preview(event.nativeEvent.pageX);
        setDragIndex(null);
        if (index !== null) open(routes[index]);
      }
      pointer.current.id = -1;
      pointer.current.dragging = false;
      setTimeout(() => { suppressPress.current = false; }, 0);
    },
    onPointerCancel: () => { pointer.current.id = -1; pointer.current.dragging = false; suppressPress.current = false; setDragIndex(null); },
  };

  if (keyboardVisible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom: Math.max(insets.bottom, 12) }]}>
      <View pointerEvents="box-none" style={styles.dockRow}>
        <View style={styles.navigation}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <GlassSurface solid={reduceTransparency} style={styles.navigationBackground} />
          </View>
          <View
            ref={track}
            {...(Platform.OS === 'web' ? webPointer : pan.panHandlers)}
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              setWidth(nextWidth);
              track.current?.measureInWindow((left) => { bounds.current = { left, width: nextWidth }; });
            }}
            style={styles.track}
          >
          {width > 0 && (
            <Animated.View pointerEvents="none" style={[styles.selection, {
              width: tabWidth,
              transform: [
                { translateX: selectionX },
                { scaleX: dragProgress.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion ? 1 : 1.16] }) },
                { scaleY: dragProgress.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion ? 1 : 1.35] }) },
              ],
            }]}>
              <GlassSurface solid={reduceTransparency} style={{ ...styles.selectionMaterial, ...(dragging ? styles.selectionDragging : {}), ...(reduceTransparency ? { backgroundColor: '#E5E5E1' } : {}) }}>
                <Animated.View style={[{ opacity: dragProgress }]} />
              </GlassSurface>
            </Animated.View>
          )}
          {routes.map((route, index) => {
            const focused = (dragIndex ?? focusedIndex) === index;
            const tab = tabs[route.name];
            const badge = descriptors[route.key].options.tabBarBadge;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: state.routes[state.index].key === route.key }}
                accessibilityLabel={tab.label + (badge ? '，' + badge + ' 則待處理' : '')}
                onPress={() => { if (!suppressPress.current) open(route); }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <Animated.View style={[styles.tabContents, { transform: [
                  { scale: focused ? dragProgress.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion ? 1 : 1.1] }) : 1 },
                ] }]}>
                <View>
                  <MaterialCommunityIcons name={tab.icon} size={23} color={focused ? colors.ink : '#62615D'} />
                  {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{Number(badge) > 99 ? '99+' : badge}</Text></View> : null}
                </View>
                <Text numberOfLines={1} style={[styles.label, focused && styles.selectedLabel]}>{tab.label}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { overflow: 'visible', zIndex: 10, position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  dockRow: { overflow: 'visible', width: '100%', maxWidth: 496, flexDirection: 'row', alignItems: 'center', gap: 10 },
  surface: { borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', boxShadow: '0px 6px 24px rgba(32,30,24,0.12)' },
  fallback: { backgroundColor: 'rgba(248,248,246,0.95)' },
  webGlass: { backgroundColor: 'rgba(250,250,248,0.72)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)' } as ViewStyle,
  solid: { backgroundColor: '#F5F5F3', borderColor: '#DDDCD8' },
  navigation: { overflow: 'visible', flex: 1, minWidth: 0, height: 66, padding: 5, borderWidth: 1, borderColor: 'transparent' },
  navigationBackground: { flex: 1 },
  track: { overflow: 'visible', flex: 1, flexDirection: 'row', alignItems: 'center', touchAction: 'pan-y', userSelect: 'none' } as ViewStyle,
  tab: { overflow: 'visible', zIndex: 1, flex: 1, minWidth: 0, minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 3 },
  selection: { overflow: 'visible', position: 'absolute', top: 0, bottom: 0 },
  selectionMaterial: { flex: 1, borderRadius: 28, backgroundColor: 'rgba(210,210,205,0.42)', borderColor: 'rgba(255,255,255,0.65)', boxShadow: 'none' },
  selectionDragging: { backgroundColor: 'rgba(255,255,255,0.34)', borderColor: 'rgba(255,255,255,0.95)', boxShadow: '0px 5px 18px rgba(25,25,20,0.2)' },
  tabContents: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { color: '#62615D', fontFamily: typography.regular, fontSize: 12, fontWeight: '500' },
  selectedLabel: { color: colors.ink, fontWeight: '700' },
  pressed: { backgroundColor: 'rgba(190,190,185,0.3)' },
  badge: { position: 'absolute', top: -5, left: 15, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#D92738', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 16, color: '#FFFFFF', fontWeight: '700' },
});
