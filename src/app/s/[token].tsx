import { PublicPostScreen } from '@/components/public-post-screen';
import { useLocalSearchParams } from 'expo-router';

export default function SharedPostRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <PublicPostScreen token={token} />;
}
