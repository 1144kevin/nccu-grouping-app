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
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(`--app-${key}`, value);
      root.style.setProperty(`--app-base-${key}`, value);
    });
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.backgroundColor = palette.background;
    document.body.style.backgroundColor = palette.background;
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColor);
    }
    themeColor.setAttribute('content', palette.background);

    let topBlurFix = document.getElementById('ios-top-blur-fix');
    if (!topBlurFix) {
      topBlurFix = document.createElement('div');
      topBlurFix.id = 'ios-top-blur-fix';
      topBlurFix.className = 'ios-top-blur-fix';
      topBlurFix.setAttribute('aria-hidden', 'true');
      document.body.appendChild(topBlurFix);
    }
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined;
    const isStandalone =
      nav?.standalone === true ||
      (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true);
    topBlurFix.style.position = 'fixed';
    topBlurFix.style.top = '0px';
    topBlurFix.style.left = '0px';
    topBlurFix.style.width = '100%';
    topBlurFix.style.height = '11px';
    topBlurFix.style.backgroundColor = palette.background;
    topBlurFix.style.pointerEvents = 'none';
    topBlurFix.style.zIndex = '9999';
    if (isStandalone) {
      topBlurFix.style.display = 'block';
    }
  }, [dark]);
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}
