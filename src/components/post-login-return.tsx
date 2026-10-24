import { useEffect } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { clearSharedPostReturn, pendingSharedPost } from '@/lib/post-login-return';

export function PostLoginReturn() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const path = usePathname();
  const navigation = useRootNavigationState();
  useEffect(() => {
    if (
      !navigation?.key ||
      !ready ||
      !user ||
      user.profile_setup_required ||
      user.deletion_pending ||
      !['/', '/sign-in'].includes(path)
    )
      return;
    const id = pendingSharedPost();
    if (!id) return;
    clearSharedPostReturn();
    router.replace(`/order/${id}`);
  }, [navigation?.key, ready, user, path]);
  return null;
}
