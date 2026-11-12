import { Image } from 'expo-image';
import { Platform, useColorScheme } from 'react-native';
import { useAppearanceStore } from '@/store/appearance-store';

export function BrandLogo({ size = 32, onBrand = false }: { size?: number; onBrand?: boolean }) {
  const mode = useAppearanceStore((state) => state.mode);
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return (
    <Image
      source={require('../../assets/images/brand-logo.svg')}
      accessibilityLabel="政缺一咖 Logo"
      contentFit="contain"
      style={{
        width: size,
        height: size,
        // Only apply invert() in dark mode so light mode skips CSS filter offscreen rasterization (prevents blur on iOS 27 WebKit).
        ...(Platform.OS === 'web' && !onBrand && dark ? { filter: 'invert(1)' } : {}),
      }}
    />
  );
}
