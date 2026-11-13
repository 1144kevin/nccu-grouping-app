import { Image } from 'expo-image';
import { useColorScheme } from 'react-native';
import { useAppearanceStore } from '@/store/appearance-store';

const LIGHT_LOGO = require('../../assets/images/brand-logo.svg');
const DARK_LOGO = require('../../assets/images/brand-logo-dark.svg');

export function BrandLogo({ size = 32, onBrand = false }: { size?: number; onBrand?: boolean }) {
  const mode = useAppearanceStore((state) => state.mode);
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  // Use a pre-inverted asset in dark mode instead of CSS filter: invert(1) so WebKit skips offscreen rasterization.
  const source = !onBrand && dark ? DARK_LOGO : LIGHT_LOGO;
  return (
    <Image
      source={source}
      accessibilityLabel="政缺一咖 Logo"
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
