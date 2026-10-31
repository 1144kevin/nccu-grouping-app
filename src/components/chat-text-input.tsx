import { useLayoutEffect, useRef, useState } from 'react';
import { Platform, type TextInput, type TextInputProps } from 'react-native';
import { AppTextInput } from '@/components/app-text';

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
          minHeight: 40,
          maxHeight: 120,
          height: value ? height : 40,
          paddingVertical: 7,
          lineHeight: 24,
          textAlignVertical: emptyCentered && !value ? 'center' : 'top',
          textAlign: emptyCentered && !value ? 'center' : 'left',
        },
      ]}
    />
  );
}
