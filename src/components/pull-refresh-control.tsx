import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { RefreshControl } from 'react-native';

// Network polling must never impersonate the user's pull gesture.
export function PullRefreshControl({
  onRefresh,
  ...props
}: Omit<ComponentProps<typeof RefreshControl>, 'refreshing' | 'onRefresh'> & {
  onRefresh: () => unknown | Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <RefreshControl
      {...props}
      refreshing={refreshing}
      onRefresh={() => {
        if (busy.current) return;
        busy.current = true;
        setRefreshing(true);
        void Promise.resolve()
          .then(onRefresh)
          .catch(() => undefined)
          .finally(() => {
            busy.current = false;
            if (mounted.current) setRefreshing(false);
          });
      }}
    />
  );
}
