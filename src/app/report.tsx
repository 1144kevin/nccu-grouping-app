import { useLocalSearchParams } from 'expo-router';
import {  } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { DetailHeader, EmptyState, Screen } from '@/components/primitives';
import { ReportComposer } from '@/components/core-reports';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';

export default function ReportScreen() {
  const { kind, targetId } = useLocalSearchParams<{ kind?: string; targetId?: string }>();
  const actor = useAuthStore((state) => state.user?.id);
  const valid =
    CORE_API_ENABLED &&
    CORE_SUPABASE_MODE &&
    (kind === 'post' || kind === 'message' || kind === 'user') &&
    typeof targetId === 'string' &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(targetId);
  return (
    <Screen>
      <DetailHeader title="私下回報內容" />
      {valid ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        >
          <ReportComposer key={`${actor}:${kind}:${targetId}`} kind={kind} targetId={targetId} />
        </ScrollView>
      ) : (
        <EmptyState icon="alert-circle-outline" title="無法開啟這筆檢舉，請從實際內容重新進入" />
      )}
    </Screen>
  );
}
