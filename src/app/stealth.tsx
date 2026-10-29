import { QuickStealthScreen } from '@/components/quick-stealth';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { DetailHeader, EmptyState, Screen } from '@/components/primitives';

export default function StealthScreen() {
  return CORE_API_ENABLED && CORE_SUPABASE_MODE ? (
    <QuickStealthScreen />
  ) : (
    <Screen>
      <DetailHeader title="偷揪" />
      <EmptyState icon="robot-outline" title="請使用 Supabase 開發模式體驗偷揪" />
    </Screen>
  );
}
