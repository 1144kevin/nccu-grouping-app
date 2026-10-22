import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';

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

const styles = StyleSheet.create({ fill: { flex: 1 } });
