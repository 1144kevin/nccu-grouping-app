import { Platform } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  ink: '#171717',
  muted: '#77756F',
  subtle: '#A8A59D',
  surface: '#F6F6F4',
  border: '#E6E4DF',
  yellow: '#FFCC00',
  yellowSoft: '#FFF1A8',
  brown: '#8B6847',
  danger: '#DF4F4F',
  success: '#327A51',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  pill: 999,
} as const;

export const typography = {
  regular: Platform.select({ ios: 'PingFang TC', default: 'sans-serif' }),
  rounded: Platform.select({ ios: 'PingFang TC', default: 'sans-serif-medium' }),
} as const;
