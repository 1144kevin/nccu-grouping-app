import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { CHAT_ACTION_WIDTH, chatSwipeTarget } from '@/lib/chat-swipe';
import type { ChatSwipeRowProps } from './chat-swipe-row.types';

export function ChatSwipeRow({ children, leftActions, rightActions, onOpenStart, onOpen, onClose, onGestureActiveChange, ref }: ChatSwipeRowProps) {
  const [translation] = useState(() => new Animated.Value(0));
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const position = useRef(0);
  const initial = useRef(0);
  const suppressPress = useRef(false);
  const gestureActive = useRef(false);
  const callbacks = useRef({ onOpenStart, onOpen, onClose, onGestureActiveChange });
  useEffect(() => { callbacks.current = { onOpenStart, onOpen, onClose, onGestureActiveChange }; }, [onOpenStart, onOpen, onClose, onGestureActiveChange]);

  useEffect(() => () => {
    if (gestureActive.current) callbacks.current.onGestureActiveChange?.(false);
  }, []);

  const endGesture = useCallback(() => {
    if (gestureActive.current) callbacks.current.onGestureActiveChange?.(false);
    gestureActive.current = false;
  }, []);

  const settle = useCallback((next: number) => {
    position.current = next;
    setSide(next > 0 ? 'left' : next < 0 ? 'right' : null);
    Animated.timing(translation, { toValue: next, duration: 160, useNativeDriver: true }).start();
    if (next) callbacks.current.onOpen(next > 0 ? 'left' : 'right');
    else callbacks.current.onClose();
  }, [translation]);

  useImperativeHandle(ref, () => ({
    close: () => { endGesture(); settle(0); },
    shouldIgnorePress: () => suppressPress.current,
  }), [endGesture, settle]);

  // PanResponder stores callbacks; refs are only read after touch events.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => { suppressPress.current = false; return false; },
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => {
      initial.current = position.current;
      suppressPress.current = true;
      translation.stopAnimation();
      callbacks.current.onOpenStart();
      gestureActive.current = true;
      callbacks.current.onGestureActiveChange?.(true);
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.max(-CHAT_ACTION_WIDTH, Math.min(CHAT_ACTION_WIDTH, initial.current + gesture.dx));
      translation.setValue(next);
      setSide(next > 0 ? 'left' : next < 0 ? 'right' : null);
    },
    onPanResponderRelease: (_, gesture) => { settle(chatSwipeTarget(initial.current, gesture.dx)); endGesture(); },
    onPanResponderTerminate: () => { settle(initial.current); endGesture(); },
    onPanResponderTerminationRequest: () => false,
  }), [endGesture, settle, translation]);

  return (
    <View style={styles.container}>
      <View pointerEvents={side === 'left' ? 'auto' : 'none'} accessibilityElementsHidden={side !== 'left'} style={[styles.actions, styles.left]}>{leftActions}</View>
      <View pointerEvents={side === 'right' ? 'auto' : 'none'} accessibilityElementsHidden={side !== 'right'} style={[styles.actions, styles.right]}>{rightActions}</View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: translation }] }}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  actions: { position: 'absolute', top: 0, bottom: 0, width: CHAT_ACTION_WIDTH },
  left: { left: 0 },
  right: { right: 0 },
});
