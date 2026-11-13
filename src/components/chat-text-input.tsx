import { useLayoutEffect, useRef, useState } from 'react';
import { Platform, type TextInput, type TextInputProps } from 'react-native';
import { AppTextInput } from '@/components/app-text';
import { colors, neutralSurface } from '@/theme/tokens';

const clamp = (height: number) => Math.min(120, Math.max(40, Math.ceil(height)));
export function ChatTextInput({
  value,
  style,
  onContentSizeChange,
  emptyCentered = false,
  ...props
}: TextInputProps & { emptyCentered?: boolean }) {
  const input = useRef<TextInput>(null);
  const [height, setHeight] = useState(40);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !input.current) return;
    const element = input.current as unknown as HTMLTextAreaElement;
    // Reset before measuring so deleting lines shrinks the textarea as well.
    element.style.height = '0px';
    const next = clamp(element.scrollHeight);
    element.style.height = `${next}px`;
  }, [value]);
  return (
    <AppTextInput
      {...props}
      ref={input}
      value={value}
      placeholderTextColor={colors.chatPlaceholder}
      multiline
      numberOfLines={1}
      onContentSizeChange={(event) => {
        if (Platform.OS !== 'web')
          setHeight(value ? clamp(event.nativeEvent.contentSize.height + 14) : 40);
        onContentSizeChange?.(event);
      }}
      style={[
        style,
        {
          ...neutralSurface,
          minHeight: 40,
          backgroundColor: colors.chatInput,
          color: colors.chatInputText,
          borderRadius: 18,
          borderWidth: 0,
          includeFontPadding: false,
          maxHeight: 120,
          height: value ? height : 40,
          paddingVertical: 8,
          paddingLeft: emptyCentered ? 10 : 16,
          paddingRight: 12,
          lineHeight: 24,
          textAlignVertical: 'center',
          textAlign: emptyCentered && !value ? 'center' : 'left',
        },
      ]}
    />
  );
}
