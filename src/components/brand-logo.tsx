import { Image } from 'expo-image';
import { Platform } from 'react-native';

export function BrandLogo({ size = 32, onBrand = false }: { size?: number; onBrand?: boolean }) {
  return (
    <Image
      source={require('../../assets/images/brand-logo.svg')}
      accessibilityLabel="政缺一咖 Logo"
      contentFit="contain"
      style={{
        width: size,
        height: size,
        ...(Platform.OS === 'web' && !onBrand ? { filter: 'var(--app-logo-filter, none)' } : {}),
      }}
    />
  );
}
