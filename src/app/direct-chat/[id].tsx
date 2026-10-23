import { useLocalSearchParams } from 'expo-router';
import { DirectChat } from '@/components/direct-chat';
export default function DirectChatScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <DirectChat id={id} />; }
