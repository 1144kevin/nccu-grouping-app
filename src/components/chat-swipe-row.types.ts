import type { ReactNode, Ref } from 'react';

export type ChatSwipeHandle = { close: () => void; shouldIgnorePress: () => boolean };
export type ChatSwipeRowProps = {
  children: ReactNode;
  leftActions: ReactNode;
  rightActions: ReactNode;
  onOpenStart: () => void;
  onGestureActiveChange?: (active: boolean) => void;
  onOpen: (side: 'left' | 'right') => void;
  onClose: () => void;
  ref?: Ref<ChatSwipeHandle>;
};
