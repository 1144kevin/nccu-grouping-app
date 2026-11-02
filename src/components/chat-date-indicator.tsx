import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type ViewToken } from 'react-native';
import { AppText as Text } from './app-text';
import { dayKey, displayDay } from '@/lib/display-time';
import { colors } from '@/theme/tokens';

export function useChatDateIndicator(inverted = true) {
  const current = useRef('');
  const [label, setLabel] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.filter((v) => v.index != null);
      visible.sort((a, b) => (inverted ? b.index! - a.index! : a.index! - b.index!));
      current.current = visible[0]?.item?.created_at ?? '';
    },
    [inverted],
  );
  const onScroll = () => {
    const date = current.current;
    setLabel(date && dayKey(date) !== dayKey(new Date()) ? displayDay(date) : '');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel(''), 1400);
  };
  return {
    onViewableItemsChanged,
    onScroll,
    indicator: label ? (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          alignSelf: 'center',
          zIndex: 10,
          backgroundColor: '#EEEDE8',
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 14,
        }}
      >
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: colors.muted }}>
          {label}
        </Text>
      </View>
    ) : null,
  };
}
