import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { colors } from '@/theme/tokens';

const THRESHOLD = 64;

function scrollContainer(target: EventTarget | null, root: HTMLElement) {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== root) {
    if (/^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) return element;
    element = element.parentElement;
  }
  return root;
}

export function PullToRefresh({
  children,
  onRefresh,
}: PropsWithChildren<{ onRefresh: () => unknown | Promise<unknown> }>) {
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onRefresh);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    callback.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let mounted = true;
    let busy = false;
    let gesture: { x: number; y: number; scroll: HTMLElement; distance: number } | null = null;
    const start = (event: TouchEvent) => {
      if (busy || event.touches.length !== 1) return;
      const scroll = scrollContainer(event.target, element);
      if (scroll.scrollTop > 0) return;
      gesture = { x: event.touches[0].clientX, y: event.touches[0].clientY, scroll, distance: 0 };
    };
    const reset = () => {
      gesture = null;
      if (mounted) setDistance(0);
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const dx = Math.abs(event.touches[0].clientX - gesture.x);
      const dy = event.touches[0].clientY - gesture.y;
      if (Math.max(dx, Math.abs(dy)) < 8) return;
      // Keep horizontal photo swipes and ordinary feed scrolling untouched.
      if (dx > Math.abs(dy) || dy < 0 || gesture.scroll.scrollTop > 0) {
        reset();
        return;
      }
      if (event.cancelable) event.preventDefault();
      gesture.distance = Math.min(96, dy / 2);
      setDistance(gesture.distance);
    };
    const end = () => {
      const ready = gesture && gesture.distance >= THRESHOLD;
      reset();
      if (!ready || busy) return;
      busy = true;
      setRefreshing(true);
      void Promise.resolve()
        .then(() => callback.current())
        .catch(() => undefined)
        .finally(() => {
          busy = false;
          if (mounted) setRefreshing(false);
        });
    };
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchmove', move, { passive: false });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', reset);
    return () => {
      mounted = false;
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', reset);
    };
  }, []);
  const height = refreshing ? 56 : distance;
  return (
    <div
      ref={root}
      data-testid="web-pull-to-refresh"
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehaviorY: 'contain',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          height,
          flexShrink: 0,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {height > 0 ? (
          refreshing ? (
            <ActivityIndicator accessibilityLabel="正在重新載入首頁" color={colors.muted} />
          ) : (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 13 }}>
              {distance >= THRESHOLD ? '放開即可更新' : '下拉重新載入'}
            </Text>
          )
        ) : null}
      </View>
      {children}
    </div>
  );
}
