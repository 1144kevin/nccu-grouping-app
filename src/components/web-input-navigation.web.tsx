import { useEffect } from 'react';
import '@/theme/web-inputs.css';

export function WebInputNavigation() {
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') document.documentElement.dataset.inputNavigation = 'keyboard';
    };
    const pointer = () => {
      delete document.documentElement.dataset.inputNavigation;
    };
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('pointerdown', pointer, true);
      delete document.documentElement.dataset.inputNavigation;
    };
  }, []);
  return null;
}
