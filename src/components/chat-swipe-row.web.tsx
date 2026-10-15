import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';
import type { ChatSwipeRowProps } from './chat-swipe-row.types';

import { CHAT_ACTION_WIDTH as actionWidth, chatSwipeTarget } from '@/lib/chat-swipe';

export function ChatSwipeRow({ children, leftActions, rightActions, onOpenStart, onOpen, onClose, onGestureActiveChange, ref }: ChatSwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const position = useRef(0);
  const gesture = useRef({ id: -1, x: 0, y: 0, initial: 0, dragging: false });
  const suppressClick = useRef(false);
  const callbacks = useRef({ onOpenStart, onOpen, onClose, onGestureActiveChange });
  useEffect(() => { callbacks.current = { onOpenStart, onOpen, onClose, onGestureActiveChange }; }, [onOpenStart, onOpen, onClose, onGestureActiveChange]);

  useEffect(() => () => {
    if (gesture.current.dragging) callbacks.current.onGestureActiveChange?.(false);
  }, []);

  function endGesture() {
    if (gesture.current.dragging) callbacks.current.onGestureActiveChange?.(false);
    gesture.current.dragging = false;
    gesture.current.id = -1;
  }

  function settle(next: number) {
    position.current = next;
    setOffset(next);
    setDragging(false);
    if (next) callbacks.current.onOpen(next > 0 ? 'left' : 'right');
    else callbacks.current.onClose();
  }

  useImperativeHandle(ref, () => ({
    close: () => {
      position.current = 0;
      setOffset(0);
      setDragging(false);
      if (gesture.current.dragging) callbacks.current.onGestureActiveChange?.(false);
      gesture.current.dragging = false;
      gesture.current.id = -1;
      callbacks.current.onClose();
    },
    shouldIgnorePress: () => false,
  }), []);

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (current.id !== event.pointerId) return;
    const dx = event.pageX - current.x;
    if (!current.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.pageY - current.y)) {
      current.dragging = true;
      suppressClick.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      callbacks.current.onOpenStart();
      callbacks.current.onGestureActiveChange?.(true);
    }
    if (!current.dragging) return;
    event.preventDefault();
    const next = Math.max(-actionWidth, Math.min(actionWidth, current.initial + dx));
    position.current = next;
    setOffset(next);
  }

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none' }}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (event.button !== 0 || gesture.current.id !== -1 || !(event.target as HTMLElement).closest('[data-swipe-content]')) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.pageX, y: event.pageY, initial: position.current, dragging: false };
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        if (gesture.current.id !== event.pointerId) return;
        if (gesture.current.dragging) {
          settle(chatSwipeTarget(gesture.current.initial, event.pageX - gesture.current.x));
        }
        endGesture();

      }}
      onPointerCancel={() => {
        if (gesture.current.dragging) settle(gesture.current.initial);
        endGesture();
        suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: actionWidth, display: 'flex' }} aria-hidden={offset <= 0}>{leftActions}</div>
      <div style={{ position: 'absolute', inset: '0 0 0 auto', width: actionWidth, display: 'flex' }} aria-hidden={offset >= 0}>{rightActions}</div>
      <div data-swipe-content style={{ position: 'relative', transform: 'translateX(' + offset + 'px)', transition: dragging ? 'none' : 'transform 180ms ease-out' }}>
        {children}
      </div>
    </div>
  );
}
