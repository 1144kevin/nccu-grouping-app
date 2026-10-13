import { createContext, useContext, type Ref } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps, type TextStyle } from 'react-native';
import { fontSizes, useFontSizeStore } from '@/store/font-size-store';

const InsideText = createContext(false);

function scaledStyle(style: TextStyle | undefined, scale: number, fallback?: number): TextStyle {
  const size = style?.fontSize ?? fallback;
  return {
    ...(size !== undefined ? { fontSize: size * scale } : {}),
    ...(style?.lineHeight !== undefined ? { lineHeight: style.lineHeight * scale } : {}),
  };
}

export function AppText({ style, children, fixedSize = false, ref, ...props }: TextProps & { fixedSize?: boolean; ref?: Ref<NativeText> }) {
  const size = useFontSizeStore((state) => state.fontSize);
  const nested = useContext(InsideText);
  const scaled = fixedSize ? undefined : scaledStyle(StyleSheet.flatten(style), fontSizes[size].scale, nested ? undefined : 14);
  return <NativeText {...props} ref={ref} style={[style, scaled]}><InsideText.Provider value>{children}</InsideText.Provider></NativeText>;
}

export function AppTextInput({ style, ref, ...props }: TextInputProps & { ref?: Ref<NativeTextInput> }) {
  const size = useFontSizeStore((state) => state.fontSize);
  return <NativeTextInput {...props} ref={ref} style={[style, scaledStyle(StyleSheet.flatten(style), fontSizes[size].scale, 16)]} />;
}
