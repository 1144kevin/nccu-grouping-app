import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAppearanceStore } from '@/store/appearance-store';
import { lightColors, darkColors } from '@/theme/tokens';

export function AppearanceController() {
  const mode = useAppearanceStore((state) => state.mode);
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const palette = dark ? darkColors : lightColors;
    const root = document.documentElement;
    Object.entries(palette).forEach(([key, value]) =>
      root.style.setProperty(`--app-${key}`, value),
    );
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.setProperty('--app-logo-filter', dark ? 'invert(1)' : 'none');
    document.body.style.backgroundColor = palette.background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.background);
  }, [dark]);
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}
