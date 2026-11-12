import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type Ref } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const vv = window.visualViewport;
      let baseHeight = window.innerHeight;
      const update = () => {
        if (vv.height > baseHeight) baseHeight = vv.height;
        setOpen(baseHeight - vv.height > 120);
      };
      update();
      vv.addEventListener('resize', update);
      return () => vv.removeEventListener('resize', update);
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return open;
}

// UIKit adjusts the scroll offset to the focused field as well as its bottom inset.
// Do not put a KeyboardAvoidingView around this: that would count the keyboard twice.
export function KeyboardScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  return <ScrollView
    {...props}
    ref={ref}
    automaticallyAdjustKeyboardInsets={props.automaticallyAdjustKeyboardInsets ?? Platform.OS === 'ios'}
    keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
    keyboardDismissMode={props.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
  />;
}

// For a fixed chat composer or a modal, not a scrolling form. KAV uses parent-relative
// layout coordinates, so account for the actual window position (including the Auth banner).
export function KeyboardViewport({ children }: PropsWithChildren) {
  const viewport = useRef<View>(null);
  const mounted = useRef(true);
  const [top, setTop] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const measure = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    viewport.current?.measureInWindow((_x, y) => {
      if (mounted.current && Number.isFinite(y)) setTop(Math.max(0, y));
    });
  }, []);
  return <View testID="keyboard-viewport" ref={viewport} collapsable={false} onLayout={measure} style={styles.fill}>
    <KeyboardAvoidingView style={styles.fill} enabled={Platform.OS === 'ios'} behavior="padding" keyboardVerticalOffset={top}>
      {children}
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0, overflow: 'hidden' } });
