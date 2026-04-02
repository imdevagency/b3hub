import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Box,
  CalendarDays,
  FileText,
  LogOut,
  MessageCircle,
  Receipt,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { getRoleName } from '@/lib/utils';

const SIDEBAR_WIDTH = 300;

type Role = 'seller' | 'buyer' | 'driver';

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  role: Role;
  accentColor: string;
}

const ROLE_LABEL: Record<Role, string> = {
  seller: 'Pārdevējs',
  buyer: 'Pasūtītājs',
  driver: 'Šoferis',
};

interface MenuItem {
  icon: (color: string) => React.ReactNode;
  label: string;
  route: string;
}

interface BuildItemsUser {
  isCompany?: boolean;
  companyRole?: string;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  canSkipHire?: boolean;
}

function buildItems(role: Role, user: BuildItemsUser | null | undefined): MenuItem[] {
  const items: MenuItem[] = [];
  const isCompany = user?.isCompany ?? false;

  if (role === 'seller') {
    items.push({
      icon: (c) => <FileText size={20} color={c} />,
      label: 'Piedāvājumi',
      route: '/(seller)/quotes',
    });
  }

  if (role === 'driver') {
    if (user?.canSkipHire) {
      items.push({
        icon: (c) => <Trash2 size={20} color={c} />,
        label: 'Konteineri',
        route: '/(driver)/skips',
      });
    }
    items.push({
      icon: (c) => <Truck size={20} color={c} />,
      label: 'Transportlīdzekļi',
      route: '/(driver)/vehicles',
    });
    items.push({
      icon: (c) => <CalendarDays size={20} color={c} />,
      label: 'Grafiks',
      route: '/(driver)/schedule',
    });
  }
  if (role === 'buyer') {
    if (isCompany) {
      items.push({
        icon: (c) => <Users size={20} color={c} />,
        label: 'Komanda',
        route: '/(buyer)/team',
      });
    }
    // Framework contracts: company members with contract management access
    const canViewContracts =
      isCompany &&
      (user?.companyRole === 'OWNER' ||
        user?.companyRole === 'MANAGER' ||
        !!user?.permCreateContracts ||
        !!user?.permReleaseCallOffs);
    if (canViewContracts) {
      items.push({
        icon: (c) => <FileText size={20} color={c} />,
        label: 'Projekti',
        route: '/(buyer)/framework-contracts',
      });
    }
    items.push({
      icon: (c) => <Receipt size={20} color={c} />,
      label: 'Rēķini',
      route: '/(buyer)/invoices',
    });
    // Certificates: only for skip-hire operators
    if (user?.canSkipHire) {
      items.push({
        icon: (c) => <ShieldCheck size={20} color={c} />,
        label: 'Sertifikāti',
        route: '/(buyer)/certificates',
      });
    }
  }

  items.push({
    icon: (c) => <MessageCircle size={20} color={c} />,
    label: 'Ziņojumi',
    route: '/messages',
  });
  items.push({
    icon: (c) => <Settings size={20} color={c} />,
    label: 'Iestatījumi',
    route: '/settings',
  });

  return items;
}

export function Sidebar({ visible, onClose, role, accentColor }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const items = buildItems(role, user);

  useEffect(() => {
    if (visible) {
      // Show modal first, then animate in
      setModalVisible(true);
      translateX.setValue(-SIDEBAR_WIDTH);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.45,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out, then hide modal
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -SIDEBAR_WIDTH,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible]);

  const navigate = (route: string) => {
    haptics.light();
    onClose();
    setTimeout(() => router.push(route as any), 150);
  };

  const handleLogout = () => {
    haptics.warning();
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials || '?'}</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerName}>{fullName || 'Lietotājs'}</Text>
            <Text style={styles.bannerRole}>{getRoleName(user)}</Text>
          </View>
        </View>

        {/* Menu */}
        <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.row}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>{item.icon('#4b5563')}</View>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <LogOut size={20} color="#4b5563" />
            </View>
            <Text style={styles.rowLabel}>Iziet</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* App version footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>B3Hub • v1.0</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  bannerRole: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  menu: {
    flex: 1,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  rowIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginLeft: 6,
  },
  logoutLabel: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 24,
    marginVertical: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
