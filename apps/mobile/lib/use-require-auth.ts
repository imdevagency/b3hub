import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

/**
 * Returns a `requireAuth` wrapper that redirects unauthenticated users to the
 * register screen before executing the given action.
 *
 * @example
 *   const requireAuth = useRequireAuth();
 *   // ...
 *   onPress: requireAuth(() => router.push('/messages')),
 */
export function useRequireAuth(): (action: () => void) => () => void {
  const { user } = useAuth();
  const router = useRouter();

  return (action: () => void) =>
    () => {
      if (!user) {
        router.push('/(auth)/register' as never);
        return;
      }
      action();
    };
}
