import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
  Bell,
  ChevronRight,
  LogOut,
  Receipt,
  Settings,
  Truck,
  User,
  Wallet,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { ModeSwitcher } from '@/components/ui/ModeSwitcher';

const SIDEBAR_WIDTH = 300;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Role = 'seller' | 'buyer' | 'driver';

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  role: Role;
  accentColor: string;
  isMultiRole?: boolean;
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

function buildItems(role: Role): MenuItem[] {
  const items: MenuItem[] = [];

  if (role === 'seller') {
    items.push({
      icon: (c) => <Wallet size={20} color={c} />,
      label: 'Ieņēmumi',
      route: '/(seller)/earnings',
    });
  }
  if (role === 'driver') {
    items.push({
      icon: (c) => <Wallet size={20} color={c} />,
      label: 'Ieņēmumi',
      route: '/(driver)/earnings',
    });
    items.push({
      icon: (c) => <Truck size={20} color={c} />,
      label: 'Transportlīdzekļi',
      route: '/(driver)/vehicles',
    });
  }
  if (role === 'buyer') {
    items.push({
      icon: (c) => <Receipt size={20} color={c} />,
      label: 'Rēķini',
      route: '/(buyer)/invoices',
    });
  }

  items.push({
    icon: (c) => <Bell size={20} color={c} />,
    label: 'Paziņojumi',
    route: '/notifications',
  });
  items.push({
    icon: (c) => <User size={20} color={c} />,
    label: 'Profils',
    route: `/(${role})/profile` as string,
  });
  items.push({
    icon: (c) => <Settings size={20} color={c} />,
    label: 'Iestatījumi',
    route: `/(${role})/profile` as string,
  });

  return items;
}

export function Sidebar({ visible, onClose, role, accentColor, isMultiRole }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const items = buildItems(role);

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
          router.replace('/(auth)/welcome' as any);
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
        <View style={[styles.banner, { backgroundColor: accentColor }]}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials || '?'}</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerName}>{fullName || 'Lietotājs'}</Text>
            <Text style={styles.bannerRole}>{ROLE_LABEL[role]}</Text>
          </View>
        </View>

        {/* Menu */}
        <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
          {/* Mode switcher section for multi-role users */}
          {isMultiRole && (
            <View style={styles.modeSwitcherSection}>
              <Text style={styles.sectionLabel}>LOMA</Text>
              <ModeSwitcher />
            </View>
          )}
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.row, idx < items.length - 1 && styles.rowBorder]}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}>{item.icon('#6b7280')}</View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <ChevronRight size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <LogOut size={20} color="#ef4444" />
            </View>
            <Text style={[styles.rowLabel, styles.logoutLabel]}>Iziet</Text>
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
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  bannerRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  menu: {
    flex: 1,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  rowIcon: {
    width: 32,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    marginLeft: 8,
  },
  logoutLabel: {
    color: '#ef4444',
  },
  modeSwitcherSection: {
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
    marginVertical: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
