import { PageLoading } from '@/components/page-loading';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import { useCorePost } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { useCoreClock } from '@/lib/core-clock';
import { PostComposer } from './post-composer';

export function CoreEditPostScreen({ id }: { id: string }) {
  const query = useCorePost(id);
  const clock = useCoreClock();
  const actor = useAuthStore((state) => state.user?.id);
  const [revision, setRevision] = useState(0);
  if (!query.data)
    return (
      <Screen>
        <DetailHeader title="編輯拼單" />
        {query.isPending ? (
          <PageLoading />
        ) : (
          <View>
            <Text>{coreError(query.error)}</Text>
            <PrimaryButton
              onPress={() => {
                void query.refetch();
              }}
            >
              重試
            </PrimaryButton>
          </View>
        )}
      </Screen>
    );
  if (query.data.my_status !== 'host')
    return (
      <Screen>
        <DetailHeader title="編輯拼單" />
        <Text>只有主揪可以修改這筆拼單。</Text>
      </Screen>
    );
  if (!clock.data)
    return (
      <Screen>
        <DetailHeader title="編輯拼單" />
        {clock.isPending ? (
          <PageLoading accessibilityLabel="正在取得截止時間基準" />
        ) : (
          <Text>{coreError(clock.error)}</Text>
        )}
        <PrimaryButton
          secondary
          onPress={() => {
            void clock.refetch();
          }}
        >
          重新取得時間
        </PrimaryButton>
      </Screen>
    );
  return (
    <PostComposer
      key={`${actor}:${query.data.id}:${revision}`}
      post={query.data}
      onReload={async () => {
        const result = await query.refetch();
        if (!result.isError && result.data) setRevision((value) => value + 1);
      }}
      now={clock.now}
      clockDrift={Math.abs(clock.data.driftMs) > 60_000}
    />
  );
}
