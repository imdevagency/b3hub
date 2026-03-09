import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  LogOut,
  Receipt,
  Truck,
  User,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';

type Role = 'seller' | 'buyer' | 'driver';

interface MoreHubProps {
  role: Role;
  accentColor: string;
}

const ROLE_LABEL: Record<Role, string> = {
  seller: 'Pārdevējs',
  buyer: 'Pasūtītājs',
  driver: 'Šoferis',
};

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  route: string;
}

function buildItems(role: Role): MenuItem[] {
  const items: MenuItem[] = [];

  if (role === 'seller') {
    items.push({ icon: <Wallet size={22} color="#6b7280" />, label: 'Ieņēmumi', route: '/(seller)/earnings' });
  }
  if (role === 'driver') {
    items.push({ icon: <Wallet size={22} color="#6b7280" />, label: 'Ieņēmumi', route: '/(driver)/earnings' });
    items.push({ icon: <Truck size={22} color="#6b7280" />, label: 'Transportlīdzekļi', route: '/(driver)/vehicles' });
  }
  if (role === 'buyer') {
    items.push({ icon: <Receipt size={22} color="#6b7280" />, label: 'Rēķini', route: '/(buyer)/invoices' });
  }

  items.push({ icon: <Bell size={22} color="#6b7280" />, label: 'Paziņojumi', route: '/notifications' });
  items.push({ icon: <User size={22} color="#6b7280" />, label: 'Profils', route: `/(${role})/profile` });

  return items;
}

export function MoreHub({ role, accentColor }: MoreHubProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const items = buildItems(role);

  const handleLogout = () => {
    haptics.warning();
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome' as any);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User banner */}
      <View style={[styles.banner, { backgroundColor: accentColor }]}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials || '?'}</Text>
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerName}>{fullName || 'Lietotājs'}</Text>
          <Text style={styles.bannerRole}>{ROLE_LABEL[role]}</Text>
        </View>
      </View>

      {/* Menu section */}
      <View style={styles.section}>
        {items.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.row, idx < items.length - 1 && styles.rowBorder]}
            onPress={() => { haptics.light(); router.push(item.route as any); }}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>{item.icon}</View>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <ChevronRight size={18} color="#d1d5db" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout section */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.rowIcon}>
            <LogOut size={22} color="#ef4444" />
          </View>
          <Text style={[styles.rowLabel, styles.logoutLabel]}>Iziet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingBottom: 48,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  rowIcon: {
    width: 36,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginLeft: 4,
  },
  logoutLabel: {
    color: '#ef4444',
  },
});
