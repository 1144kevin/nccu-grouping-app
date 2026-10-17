import { useLocalSearchParams } from 'expo-router';
import { CoreEditPostScreen } from '@/components/core-edit-post';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { DetailHeader, Screen } from '@/components/primitives';
import { AppText as Text } from '@/components/app-text';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return CORE_API_ENABLED ? <CoreEditPostScreen id={id} /> : <Screen><DetailHeader title="編輯拼單" /><Text>本機連線模式提供此功能。</Text></Screen>;
}
