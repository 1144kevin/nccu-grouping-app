import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/app-text';
import { CORE_SUPABASE_MODE } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { stealthApi } from '@/lib/stealth-api';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export function StealthConversations() {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const query = useQuery({
    queryKey: ['core', actor, 'stealth', 'matches'],
    queryFn: stealthApi.matches,
    enabled: !!actor && focused && CORE_SUPABASE_MODE,
    refetchInterval: focused ? 10000 : false,
  });
  const items =
    query.data?.items.filter(
      (m) => m.my_decision === 'accepted' && (m.status !== 'unavailable' || m.coordination_opened),
    ) ?? [];
  if (!items.length) return null;
  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`查看偷揪對話 ${item.my_signal_title}`}
          onPress={() => router.push({ pathname: '/stealth-chat/[id]', params: { id: item.id } })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <MaterialCommunityIcons name="robot-outline" size={32} color={colors.brown} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>
              【偷揪】{item.my_signal_title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {item.coordination_opened || item.status === 'ready'
                ? '進入聊天室協調'
                : '已接受 · 等待夥伴回覆'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}
