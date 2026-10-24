import { Image } from 'expo-image';

export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/brand-logo.svg')}
      accessibilityLabel="政缺一咖 Logo"
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}
