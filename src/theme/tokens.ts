import { Platform } from 'react-native';

export const lightColors = {
  background: '#FFFFFF',
  ink: '#171717',
  muted: '#77756F',
  subtle: '#A8A59D',
  surface: '#F6F6F4',
  border: '#EFEFED',
  yellow: '#FFD700',
  onYellow: '#171717',
  yellowSoft: '#FFF1A8',
  brown: '#8B6847',
  danger: '#DF4F4F',
  dangerSoft: '#FFF0F0',
  success: '#327A51',
  successSoft: '#EDF8F1',
  chatInput: '#F6F6F4',
  chatInputText: '#171717',
  chatPlaceholder: '#A8A59D',
} as const;

export const darkColors: Record<keyof typeof lightColors, string> = {
  ...lightColors,
  background: '#171817',
  ink: '#F3F3EF',
  muted: '#B3B2AB',
  subtle: '#96958E',
  surface: '#242623',
  border: '#383A35',
  yellowSoft: '#FFF1A8',
  brown: '#D3B18A',
  danger: '#FF8484',
  dangerSoft: '#452929',
  success: '#84CBA1',
  successSoft: '#171817',
  chatInput: '#242623',
  chatInputText: '#F3F3EF',
  chatPlaceholder: '#96958E',
};

// Scope text tokens to the actual yellow surface; nested labels/icons stay legible.
export const yellowSurface = (
  Platform.OS === 'web'
    ? {
        '--app-ink': '#171717',
        '--app-muted': '#171717',
        '--app-subtle': '#171717',
        '--app-brown': '#171717',
      }
    : {}
) as Record<never, never>;

export const neutralSurface = (
  Platform.OS === 'web'
    ? {
        '--app-ink': 'var(--app-base-ink, #171717)',
        '--app-muted': 'var(--app-base-muted, #77756F)',
        '--app-subtle': 'var(--app-base-subtle, #A8A59D)',
        '--app-brown': 'var(--app-base-brown, #8B6847)',
      }
    : {}
) as Record<never, never>;

// React Native Web preserves CSS variables, so existing StyleSheets follow theme changes.
export const colors = Object.fromEntries(
  Object.entries(lightColors).map(([key, value]) => [
    key,
    Platform.OS === 'web' ? `var(--app-${key}, ${value})` : value,
  ]),
) as Record<keyof typeof lightColors, string>;

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
