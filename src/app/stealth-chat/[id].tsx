import { useLocalSearchParams } from 'expo-router';
import { StealthCoordinationChat } from '@/components/stealth-coordination-chat';

export default function StealthChatPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StealthCoordinationChat id={id} />;
}
