import { createContext, useContext, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { fontSizes, useFontSizeStore } from '@/store/font-size-store';
import { colors } from '@/theme/tokens';

const InsideText = createContext(false);

function scaledStyle(style: TextStyle | undefined, scale: number, fallback?: number): TextStyle {
  const size = style?.fontSize ?? fallback;
  return {
    ...(size !== undefined ? { fontSize: size * scale } : {}),
    ...(style?.lineHeight !== undefined ? { lineHeight: style.lineHeight * scale } : {}),
  };
}

export function AppText({
  style,
  children,
  fixedSize = false,
  ref,
  ...props
}: TextProps & { fixedSize?: boolean; ref?: Ref<NativeText> }) {
  const size = useFontSizeStore((state) => state.fontSize);
  const nested = useContext(InsideText);
  const scaled = fixedSize
    ? undefined
    : scaledStyle(StyleSheet.flatten(style), fontSizes[size].scale, nested ? undefined : 14);
  return (
    <NativeText {...props} ref={ref} style={[style, scaled]}>
      <InsideText.Provider value>{children}</InsideText.Provider>
    </NativeText>
  );
}

export function AppTextInput({
  style,
  ref,
  ...props
}: TextInputProps & { ref?: Ref<NativeTextInput> }) {
  const size = useFontSizeStore((state) => state.fontSize);
  const inputStyle = StyleSheet.flatten(style);
  const scaled = scaledStyle(
    { ...inputStyle, fontSize: Math.min(inputStyle?.fontSize ?? 14, 14) },
    fontSizes[size].scale,
    14,
  );
  scaled.color = inputStyle?.color ?? colors.ink;
  // Safari zooms focused inputs below 16px, including sizes reduced by the user's
  // font preference. Keep the input stable without restricting page/pinch zoom.
  if (Platform.OS === 'web') {
    scaled.fontSize = Math.max(16, scaled.fontSize ?? 16);
    if (scaled.lineHeight != null)
      scaled.lineHeight = Math.max(scaled.lineHeight, scaled.fontSize * 1.25);
  }
  return (
    <NativeTextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? colors.subtle}
      selectTextOnFocus={Platform.OS === 'web' ? false : props.selectTextOnFocus}
      ref={ref}
      style={[style, scaled]}
    />
  );
}
