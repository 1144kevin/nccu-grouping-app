import { Image } from 'expo-image';

export function StealthIcon({ size = 24 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/stealth-eagle.svg')}
      contentFit="contain"
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size }}
    />
  );
}
