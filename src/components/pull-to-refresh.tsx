import type { PropsWithChildren } from 'react';

// Native scroll views retain their platform RefreshControl.
export function PullToRefresh({
  children,
}: PropsWithChildren<{ onRefresh: () => unknown | Promise<unknown> }>) {
  return <>{children}</>;
}
