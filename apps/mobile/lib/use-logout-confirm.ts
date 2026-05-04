import { Alert } from 'react-native';
import { useAuth } from './auth-context';
import { haptics } from './haptics';

/**
 * Single source of truth for the logout confirmation flow.
 * Replaces the 7 independent `handleLogout` implementations scattered across
 * more.tsx (buyer/seller/driver/recycler), profile.tsx, settings.tsx, Sidebar.tsx,
 * and fields.tsx — each of which had slightly diverging copy or async behaviour.
 *
 * Usage:
 *   const logout = useLogoutConfirm();
 *   <Button onPress={logout}>Iziet</Button>
 */
export function useLogoutConfirm(): () => void {
  const { logout } = useAuth();

  return () => {
    haptics.warning();
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };
}
